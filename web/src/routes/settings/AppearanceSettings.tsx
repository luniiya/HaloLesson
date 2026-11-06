import { useEffect, useRef, useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { ACCENT_PRESETS, DEFAULT_ACCENT, type User } from "@halolesson/shared";
import { api } from "$lib/api";
import { useAuth } from "$lib/auth";
import { applyAccent } from "$lib/theme";
import BookArtwork from "../../components/BookArtwork";
import Button from "../../components/Button";

// Saving waits for the color picker to settle, since dragging fires many changes.
const SAVE_DELAY_MS = 400;

export default function AppearanceSettings() {
  const { user, setUser } = useAuth();
  const [accent, setAccent] = useState(user?.accentColor ?? DEFAULT_ACCENT);
  const [error, setError] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(saveTimer.current), []);
  if (!user) return null;

  function choose(color: string | null) {
    setError("");
    setAccent(color ?? DEFAULT_ACCENT);
    applyAccent(color);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setUser(await api<User>("/api/account", { method: "PATCH", body: JSON.stringify({ accentColor: color }) }));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save your color");
      }
    }, SAVE_DELAY_MS);
  }

  return (
    <section className="settings-card flex flex-col gap-5">
      <div>
        <h2 className="settings-card-title">Accent color</h2>
        <p className="settings-card-hint">Colors buttons, highlights, the logo and the book. Subject colors stay as you set them.</p>
      </div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Accent presets">
            {ACCENT_PRESETS.map((preset) => {
              const selected = accent === preset.color;
              return (
                <button key={preset.color} type="button" role="radio" aria-checked={selected} title={preset.name}
                  className={`color-option grid place-items-center text-white ${selected ? "color-option-selected" : ""}`}
                  style={{ background: preset.color }} onClick={() => choose(preset.color)}>
                  {selected && <IconCheck size={18} stroke={3} aria-hidden="true" />}
                  <span className="sr-only">{preset.name}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="gradient-control">Custom<input type="color" value={accent} onChange={(event) => choose(event.target.value)} aria-label="Custom accent color" /></label>
            {accent !== DEFAULT_ACCENT && <Button variant="ghost" onClick={() => choose(null)}>Reset to default</Button>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Preview</Button>
            <span className="rounded-full bg-accent-pale px-3 py-1 text-xs font-black uppercase tracking-wider text-accent-deep">Highlight</span>
          </div>
        </div>
        <BookArtwork className="mx-auto max-w-48 sm:mx-0" />
      </div>
      {error && <p role="alert" className="notice-error">{error}</p>}
    </section>
  );
}

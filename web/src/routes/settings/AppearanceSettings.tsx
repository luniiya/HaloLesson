import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconBook, IconCheck, IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { ACCENT_PRESETS, DEFAULT_ACCENT, DEFAULT_SECONDARY, type User } from "@halolesson/shared";
import { api } from "$lib/api";
import { useAuth } from "$lib/auth";
import { applyAccent, applySecondary, setTheme, useTheme, type ThemePreference } from "$lib/theme";
import BookArtwork from "../../components/BookArtwork";
import Button from "../../components/Button";

// Saving waits for the color picker to settle, since dragging fires many changes.
const SAVE_DELAY_MS = 400;

export default function AppearanceSettings() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <ThemeCard />
      <ColorCard
        field="accentColor"
        title="Accent color"
        hint="Colors buttons, the logo and the book. Subject colors stay as you set them."
        fallback={DEFAULT_ACCENT}
        apply={applyAccent}
        preview={<>
          <Button>Preview</Button>
          <span className="rounded-full bg-accent-pale px-3 py-1 text-xs font-black uppercase tracking-wider text-accent-deep">Highlight</span>
        </>}
        art={<BookArtwork className="mx-auto max-w-48 sm:mx-0" />}
      />
      <ColorCard
        field="secondaryColor"
        title="Secondary color"
        hint="Marks what’s selected or active: the page you’re on, chosen options, Edit mode, focus outlines."
        fallback={DEFAULT_SECONDARY}
        apply={applySecondary}
        preview={<>
          <span className="nav-item nav-item-active"><IconBook size={20} aria-hidden="true" />Selected</span>
          <span className="rounded-full bg-secondary-pale px-3 py-1 text-xs font-black uppercase tracking-wider text-secondary">Active</span>
        </>}
      />
    </>
  );
}

interface ColorCardProps {
  field: "accentColor" | "secondaryColor";
  title: string;
  hint: string;
  fallback: string;
  apply: (color: string | null) => void;
  preview: ReactNode;
  art?: ReactNode;
}

// One of the user's two colors: presets, a custom picker, reset, and a preview.
// Applies right away and saves to the account once the picker settles.
function ColorCard({ field, title, hint, fallback, apply, preview, art }: ColorCardProps) {
  const { user, setUser } = useAuth();
  const [color, setColor] = useState(user?.[field] ?? fallback);
  const [error, setError] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  function choose(next: string | null) {
    setError("");
    setColor(next ?? fallback);
    apply(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setUser(await api<User>("/api/account", { method: "PATCH", body: JSON.stringify({ [field]: next }) }));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save your color");
      }
    }, SAVE_DELAY_MS);
  }

  return (
    <section className="settings-card flex flex-col gap-5">
      <div>
        <h2 className="settings-card-title">{title}</h2>
        <p className="settings-card-hint">{hint}</p>
      </div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={`${title} presets`}>
            {ACCENT_PRESETS.map((preset) => {
              const selected = color === preset.color;
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
            <label className="gradient-control">Custom<input type="color" value={color} onChange={(event) => choose(event.target.value)} aria-label={`Custom ${title.toLowerCase()}`} /></label>
            {color !== fallback && <Button variant="ghost" onClick={() => choose(null)}>Reset to default</Button>}
          </div>
          <div className="flex flex-wrap items-center gap-3">{preview}</div>
        </div>
        {art}
      </div>
      {error && <p role="alert" className="notice-error">{error}</p>}
    </section>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof IconSun }[] = [
  { value: "auto", label: "Auto", Icon: IconDeviceDesktop },
  { value: "light", label: "Light", Icon: IconSun },
  { value: "dark", label: "Dark", Icon: IconMoon },
];

function ThemeCard() {
  const theme = useTheme();
  return (
    <section className="settings-card flex flex-col gap-5">
      <div>
        <h2 className="settings-card-title">Theme</h2>
        <p className="settings-card-hint">Auto follows your device. Saved on this device only.</p>
      </div>
      <div className="flex gap-3" role="radiogroup" aria-label="Theme">
        {THEME_OPTIONS.map(({ value, label, Icon }) => (
          <button key={value} type="button" role="radio" aria-checked={theme === value}
            className={`theme-option ${theme === value ? "theme-option-selected" : ""}`} onClick={() => setTheme(value)}>
            <span className={`theme-preview theme-preview-${value}`} aria-hidden="true">
              <span className="theme-preview-line w-3/4" />
              <span className="theme-preview-line w-1/2" />
              <span className="mt-auto h-2.5 w-1/3 rounded-md bg-accent" />
            </span>
            <span className="flex items-center gap-1.5"><Icon size={18} stroke={2.5} aria-hidden="true" />{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

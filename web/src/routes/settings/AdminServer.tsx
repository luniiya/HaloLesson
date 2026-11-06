import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import type { Settings } from "@halolesson/shared";
import { api } from "$lib/api";
import { useAuth } from "$lib/auth";

const toggles: Array<{ key: keyof Settings; title: string; hint: string }> = [
  { key: "signupEnabled", title: "Allow sign ups", hint: "When off, only admins can create accounts (from Users)." },
  { key: "requireStrongPasswords", title: "Require strong passwords", hint: "At least 8 characters with 2 of: uppercase, lowercase, numbers, symbols." },
  { key: "requireEmail", title: "Require an email address", hint: "New accounts must give an email, and nobody can remove theirs." },
];

export default function AdminServer() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Settings>("/api/settings").then(setSettings).catch(() => setError("Could not load server settings"));
  }, []);

  if (!user?.isAdmin) return <Navigate to="/settings" replace />;

  async function change(key: keyof Settings, value: boolean) {
    setError("");
    setSettings((current) => current && { ...current, [key]: value });
    try {
      setSettings(await api<Settings>("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ [key]: value }) }));
    } catch (cause) {
      setSettings((current) => current && { ...current, [key]: !value });
      setError(cause instanceof Error ? cause.message : "Could not save");
    }
  }

  return (
    <section className="settings-card">
      <h2 className="settings-card-title">Server</h2>
      <p className="settings-card-hint">Applies to everyone on this haloLesson server. Changes save immediately.</p>
      {error && <p role="alert" className="notice-error mt-4">{error}</p>}
      <ul className="mt-5 divide-y-2 divide-swan rounded-xl border-2 border-swan">
        {toggles.map((toggle) => (
          <li key={toggle.key}>
            <label className="flex cursor-pointer items-center gap-4 px-4 py-4">
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold text-ink">{toggle.title}</span>
                <span className="block text-sm font-semibold leading-6 text-wolf">{toggle.hint}</span>
              </span>
              <span className="toggle">
                <input type="checkbox" checked={settings?.[toggle.key] ?? false} disabled={!settings} onChange={(event) => void change(toggle.key, event.target.checked)} />
                <span className="toggle-thumb" />
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

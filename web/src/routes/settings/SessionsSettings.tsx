import { useCallback, useEffect, useState } from "react";
import { IconDeviceDesktop, IconDeviceMobile } from "@tabler/icons-react";
import type { SessionSummary } from "@halolesson/shared";
import { api } from "$lib/api";
import { formatDate, formatRelative } from "$lib/server";
import Button from "../../components/Button";
import ConfirmDialog from "../../components/ConfirmDialog";

export default function SessionsSettings() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState("");
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  const load = useCallback(() => {
    api<SessionSummary[]>("/api/account/sessions")
      .then(setSessions)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load sessions"));
  }, []);
  useEffect(load, [load]);

  async function revoke(id: string) {
    setError("");
    try {
      await api<void>(`/api/account/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out that session");
    }
  }

  const others = sessions?.filter((session) => !session.current).length ?? 0;

  return (
    <section className="settings-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="settings-card-title">Where you're signed in</h2>
          <p className="settings-card-hint">Sign out any device you don't recognize, then change your password.</p>
        </div>
        {others > 0 && <Button variant="secondary" className="shrink-0" onClick={() => setSigningOutOthers(true)}>Sign out all others</Button>}
      </div>
      {error && <p role="alert" className="notice-error mt-4">{error}</p>}
      {!sessions && !error && <div className="mt-5 h-40 animate-pulse rounded-xl bg-eel" aria-label="Loading sessions" />}
      {sessions && (
        <ul className="mt-5 divide-y-2 divide-swan rounded-xl border-2 border-swan">
          {sessions.map((session) => {
            const DeviceIcon = session.device === "mobile" ? IconDeviceMobile : IconDeviceDesktop;
            return (
              <li key={session.id} className="flex items-center gap-4 px-4 py-3.5">
                <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${session.current ? "bg-owl-pale text-owl-deep" : "bg-eel text-wolf"}`} aria-hidden="true"><DeviceIcon size={24} /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-extrabold">
                    {session.label}
                    {session.current && <span className="rounded-full bg-owl-pale px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-owl-deep">This device</span>}
                  </p>
                  <p className="text-xs font-semibold text-wolf">
                    {session.current ? "Active now" : formatRelative(session.lastSeenAt)}<span className="mx-1.5 text-swan">•</span>Signed in {formatDate(session.createdAt)}
                  </p>
                </div>
                {!session.current && <Button variant="ghost" className="shrink-0 px-3" onClick={() => void revoke(session.id)}>Sign out</Button>}
              </li>
            );
          })}
        </ul>
      )}
      {signingOutOthers && (
        <ConfirmDialog
          title="Sign out everywhere else?"
          confirmLabel="Sign out others"
          onClose={() => setSigningOutOthers(false)}
          onConfirm={async () => {
            await api<void>("/api/account/sessions", { method: "DELETE" });
            load();
          }}
        >
          {others === 1 ? "1 other session" : `${others} other sessions`} will need to log in again. You stay signed in here.
        </ConfirmDialog>
      )}
    </section>
  );
}

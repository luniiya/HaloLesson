import { useCallback, useEffect, useState } from "react";
import { IconDeviceDesktop, IconDeviceMobile, IconPlugConnected, IconRobot } from "@tabler/icons-react";
import type { AgentToken, SessionSummary } from "@halolesson/shared";
import { api } from "$lib/api";
import { formatDate, formatRelative } from "$lib/server";
import Button from "../../components/Button";
import AgentPromptDialog from "../../components/AgentPromptDialog";
import ConfirmDialog from "../../components/ConfirmDialog";

function AgentTokensCard() {
  const [tokens, setTokens] = useState<AgentToken[] | null>(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [revoking, setRevoking] = useState<AgentToken | null>(null);

  const load = useCallback(() => {
    api<AgentToken[]>("/api/agent/tokens")
      .then(setTokens)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load agent tokens"));
  }, []);
  useEffect(load, [load]);

  return (
    <section className="settings-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="settings-card-title">Agent tokens</h2>
          <p className="settings-card-hint">Each agent prompt you copy carries its own token with full access to your lessons. They don't expire; revoke any you no longer use.</p>
        </div>
        <Button variant="secondary" className="shrink-0 gap-2" onClick={() => setConnecting(true)}><IconPlugConnected size={19} />Connect an agent</Button>
      </div>
      {error && <p role="alert" className="notice-error mt-4">{error}</p>}
      {!tokens && !error && <div className="mt-5 h-24 animate-pulse rounded-xl bg-eel" aria-label="Loading agent tokens" />}
      {tokens?.length === 0 && <p className="mt-5 rounded-xl bg-eel px-4 py-3.5 text-sm font-semibold text-wolf">No agents connected yet.</p>}
      {tokens && tokens.length > 0 && (
        <ul className="mt-5 divide-y-2 divide-swan rounded-xl border-2 border-swan">
          {tokens.map((token) => (
            <li key={token.id} className="flex items-center gap-4 px-4 py-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gem/15 text-gem" aria-hidden="true"><IconRobot size={24} /></span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-extrabold">
                  <span className="truncate">{token.name}</span>
                  <span className="font-mono text-xs font-semibold text-hare">…{token.hint}</span>
                </p>
                <p className="text-xs font-semibold text-wolf">
                  Created {formatDate(token.createdAt)}<span className="mx-1.5 text-swan">•</span>{token.lastUsedAt ? `Used ${formatRelative(token.lastUsedAt).toLowerCase()}` : "Never used"}
                </p>
              </div>
              <Button variant="ghost" className="shrink-0 px-3" onClick={() => setRevoking(token)}>Revoke</Button>
            </li>
          ))}
        </ul>
      )}
      {connecting && <AgentPromptDialog onClose={() => { setConnecting(false); load(); }} />}
      {revoking && (
        <ConfirmDialog
          title={`Revoke "${revoking.name}"?`}
          confirmLabel="Revoke token"
          danger
          onClose={() => setRevoking(null)}
          onConfirm={async () => {
            await api<void>(`/api/agent/tokens/${encodeURIComponent(revoking.id)}`, { method: "DELETE" });
            load();
          }}
        >
          Any agent using the token ending in …{revoking.hint} loses access right away. Lessons it already made stay.
        </ConfirmDialog>
      )}
    </section>
  );
}

function SessionsCard() {
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

export default function SessionsSettings() {
  return (
    <>
      <SessionsCard />
      <AgentTokensCard />
    </>
  );
}

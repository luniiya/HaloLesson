import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { IconKey, IconShield, IconShieldOff, IconTrash, IconUserPlus } from "@tabler/icons-react";
import { USERNAME_HTML_PATTERN, type AdminUserSummary, type User } from "@halolesson/shared";
import { api } from "$lib/api";
import { useAuth } from "$lib/auth";
import { formatDate, formatRelative } from "$lib/server";
import Avatar from "../../components/Avatar";
import Button from "../../components/Button";
import ConfirmDialog from "../../components/ConfirmDialog";

type Pending =
  | { kind: "password"; user: AdminUserSummary }
  | { kind: "delete"; user: AdminUserSummary }
  | null;

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setCreated("");
    setBusy(true);
    try {
      const user = await api<User>("/api/admin/users", { method: "POST", body: JSON.stringify({ username, email, password, isAdmin }) });
      setCreated(`Created ${user.username}. Send them their password; they can change it in Settings.`);
      setUsername("");
      setEmail("");
      setPassword("");
      setIsAdmin(false);
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="settings-card flex flex-col gap-4" onSubmit={submit}>
      <div>
        <h2 className="settings-card-title">Add someone</h2>
        <p className="settings-card-hint">Works even when sign ups are closed.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="form-label">Username
          <input className="form-input" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={32} pattern={USERNAME_HTML_PATTERN} autoComplete="off" required />
        </label>
        <label className="form-label"><span>Email <span className="font-semibold text-hare">(optional)</span></span>
          <input type="email" className="form-input" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" />
        </label>
        <label className="form-label">Password
          <input type="password" className="form-input" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
        </label>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-3 text-sm font-extrabold text-wolf">
          <span className="toggle"><input type="checkbox" checked={isAdmin} onChange={(event) => setIsAdmin(event.target.checked)} /><span className="toggle-thumb" /></span>
          Make admin
        </label>
        <Button type="submit" className="gap-2" disabled={busy}><IconUserPlus size={19} />{busy ? "Creating…" : "Create account"}</Button>
      </div>
      {error && <p role="alert" className="notice-error">{error}</p>}
      {created && <p role="status" className="notice-success">{created}</p>}
    </form>
  );
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Pending>(null);

  const load = useCallback(() => {
    api<AdminUserSummary[]>("/api/admin/users")
      .then(setUsers)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load users"));
  }, []);
  useEffect(load, [load]);

  if (!me?.isAdmin) return <Navigate to="/settings" replace />;

  async function toggleAdmin(user: AdminUserSummary) {
    setError("");
    try {
      await api<User>(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ isAdmin: !user.isAdmin }) });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change admin access");
    }
  }

  return (
    <>
      <section className="settings-card">
        <h2 className="settings-card-title">Users {users && <span className="text-hare">({users.length})</span>}</h2>
        {error && <p role="alert" className="notice-error mt-4">{error}</p>}
        {!users && !error && <div className="mt-5 h-40 animate-pulse rounded-xl bg-eel" aria-label="Loading users" />}
        {users && (
          <ul className="mt-5 divide-y-2 divide-swan rounded-xl border-2 border-swan">
            {users.map((user) => (
              <li key={user.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar user={user} className="size-11 text-base" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-extrabold">
                      <span className="truncate">{user.username}</span>
                      {user.isAdmin && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-eel-blue">Admin</span>}
                      {user.id === me.id && <span className="rounded-full bg-owl-pale px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-owl-deep">You</span>}
                    </p>
                    <p className="truncate text-xs font-semibold text-wolf">
                      {user.email ?? "No email"}<span className="mx-1.5 text-swan">•</span>{user.subjectCount} {user.subjectCount === 1 ? "subject" : "subjects"}, {user.skillCount} {user.skillCount === 1 ? "skill" : "skills"}
                      <span className="mx-1.5 text-swan">•</span>Joined {formatDate(user.createdAt)}<span className="mx-1.5 text-swan">•</span>Seen {formatRelative(user.lastSeenAt).toLowerCase()}
                    </p>
                  </div>
                </div>
                {user.id !== me.id && (
                  <div className="flex shrink-0 gap-1 pl-14 sm:pl-0">
                    <button type="button" className="rounded-lg p-2.5 text-wolf hover:bg-eel hover:text-ink" title={user.isAdmin ? "Remove admin" : "Make admin"} aria-label={`${user.isAdmin ? "Remove admin from" : "Make admin"} ${user.username}`} onClick={() => void toggleAdmin(user)}>
                      {user.isAdmin ? <IconShieldOff size={20} /> : <IconShield size={20} />}
                    </button>
                    <button type="button" className="rounded-lg p-2.5 text-wolf hover:bg-eel hover:text-ink" title="Reset password" aria-label={`Reset password for ${user.username}`} onClick={() => setPending({ kind: "password", user })}>
                      <IconKey size={20} />
                    </button>
                    <button type="button" className="rounded-lg p-2.5 text-wolf hover:bg-red-50 hover:text-cardinal" title="Delete user" aria-label={`Delete ${user.username}`} onClick={() => setPending({ kind: "delete", user })}>
                      <IconTrash size={20} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <CreateUserForm onCreated={load} />
      {pending?.kind === "password" && (
        <ConfirmDialog
          title={`Reset ${pending.user.username}'s password`}
          confirmLabel="Set password"
          input={{ label: "New password", type: "password", autoComplete: "new-password" }}
          onClose={() => setPending(null)}
          onConfirm={async (password) => {
            await api<User>(`/api/admin/users/${pending.user.id}`, { method: "PATCH", body: JSON.stringify({ password }) });
          }}
        >
          They'll be signed out everywhere and need this new password to log in.
        </ConfirmDialog>
      )}
      {pending?.kind === "delete" && (
        <ConfirmDialog
          title={`Delete ${pending.user.username}?`}
          confirmLabel="Delete forever"
          danger
          onClose={() => setPending(null)}
          onConfirm={async () => {
            await api<void>(`/api/admin/users/${pending.user.id}`, { method: "DELETE" });
            load();
          }}
        >
          Their {pending.user.subjectCount} subjects and all their practice history will be permanently deleted.
        </ConfirmDialog>
      )}
    </>
  );
}

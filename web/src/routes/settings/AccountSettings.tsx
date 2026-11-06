import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { IconLogout, IconPhotoUp, IconTrash } from "@tabler/icons-react";
import { USERNAME_CHANGE_COOLDOWN_DAYS, USERNAME_HTML_PATTERN, validatePassword, type User } from "@halolesson/shared";
import { api } from "$lib/api";
import { useAuth } from "$lib/auth";
import { formatDate, useServerInfo } from "$lib/server";
import Avatar from "../../components/Avatar";
import Button from "../../components/Button";
import ConfirmDialog from "../../components/ConfirmDialog";

const AVATAR_SIZE = 256;

// Center-crops to a square and re-encodes, so uploads stay small whatever the source.
async function resizeAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", 0.85);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
}

function nextUsernameChange(user: User): Date | null {
  if (!user.usernameChangedAt) return null;
  const next = new Date(new Date(user.usernameChangedAt).getTime() + USERNAME_CHANGE_COOLDOWN_DAYS * 86_400_000);
  return next.getTime() > Date.now() ? next : null;
}

function ProfileCard({ user }: { user: User }) {
  const { setUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveAvatar(avatar: string | null) {
    setError("");
    setBusy(true);
    try {
      setUser(await api<User>("/api/account", { method: "PATCH", body: JSON.stringify({ avatar }) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update your picture");
    } finally {
      setBusy(false);
    }
  }

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await saveAvatar(await resizeAvatar(file));
    } catch {
      setError("That file couldn't be read as an image");
    }
  }

  return (
    <section className="settings-card">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar user={user} className="size-20 text-3xl" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-black">{user.username}</h2>
          <p className="text-sm font-semibold text-wolf">
            {user.isAdmin ? "Admin" : "Learner"}<span className="mx-2 text-swan">•</span>Joined {formatDate(user.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={pick} tabIndex={-1} aria-hidden="true" />
          <Button variant="secondary" className="gap-2" disabled={busy} onClick={() => fileRef.current?.click()}><IconPhotoUp size={19} />{user.avatar ? "Change picture" : "Add picture"}</Button>
          {user.avatar && <Button variant="ghost" disabled={busy} onClick={() => void saveAvatar(null)}>Remove</Button>}
        </div>
      </div>
      {error && <p role="alert" className="notice-error mt-4">{error}</p>}
    </section>
  );
}

function SignInCard({ user }: { user: User }) {
  const { setUser } = useAuth();
  const info = useServerInfo();
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const lockedUntil = nextUsernameChange(user);
  const usernameChanged = username.trim() !== user.username;
  const emailChanged = email.trim().toLowerCase() !== (user.email ?? "");
  const dirty = usernameChanged || emailChanged || password !== "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaved("");
    if (password) {
      if (password !== confirmation) return setError("New passwords do not match");
      const check = validatePassword(password, info?.settings.requireStrongPasswords ?? true);
      if (!check.valid) return setError(check.reason ?? "Invalid password");
    }
    setBusy(true);
    try {
      const updates: Record<string, unknown> = { currentPassword };
      if (usernameChanged) updates.username = username.trim();
      if (emailChanged) updates.email = email.trim() || null;
      if (password) updates.password = password;
      const next = await api<User>("/api/account", { method: "PATCH", body: JSON.stringify(updates) });
      setUser(next);
      setUsername(next.username);
      setEmail(next.email ?? "");
      setPassword("");
      setConfirmation("");
      setCurrentPassword("");
      setSaved(password ? "Saved. Your other sessions were signed out." : "Saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your changes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="settings-card flex flex-col gap-4" onSubmit={submit}>
      <div>
        <h2 className="settings-card-title">Sign-in details</h2>
        <p className="settings-card-hint">Changing these asks for your current password.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="form-label">Username
          <input className="form-input disabled:bg-eel disabled:text-wolf" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={32} pattern={USERNAME_HTML_PATTERN} disabled={Boolean(lockedUntil)} required />
          <span className="text-xs font-semibold text-hare">
            {lockedUntil ? `You can change it again on ${formatDate(lockedUntil.toISOString())}.` : `You can change it once every ${USERNAME_CHANGE_COOLDOWN_DAYS} days.`}
          </span>
        </label>
        <label className="form-label"><span>Email {!info?.settings.requireEmail && <span className="font-semibold text-hare">(optional)</span>}</span>
          <input type="email" className="form-input" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required={info?.settings.requireEmail} />
        </label>
        <label className="form-label">New password
          <input type="password" className="form-input" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Leave blank to keep it" />
        </label>
        <label className="form-label">Confirm new password
          <input type="password" className="form-input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" placeholder="One more time" disabled={!password} required={Boolean(password)} />
        </label>
      </div>
      {dirty && (
        <label className="form-label border-t-2 border-swan pt-4">Current password
          <input type="password" className="form-input" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" placeholder="To confirm it's you" required />
        </label>
      )}
      {error && <p role="alert" className="notice-error">{error}</p>}
      {saved && <p role="status" className="notice-success">{saved}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={!dirty || busy}>{busy ? "Saving…" : "Save changes"}</Button>
      </div>
    </form>
  );
}

export default function AccountSettings() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  if (!user) return null;

  return (
    <>
      <ProfileCard user={user} />
      <SignInCard key={user.id} user={user} />
      <section className="settings-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="settings-card-title">Log out</h2>
          <p className="settings-card-hint">Sign out on this device. Other devices are under Sessions.</p>
        </div>
        <Button variant="secondary" className="gap-2" onClick={() => void logout().then(() => navigate("/login"))}><IconLogout size={19} />Log out</Button>
      </section>
      <section className="settings-card flex flex-col gap-4 border-red-100 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="settings-card-title text-cardinal">Delete account</h2>
          <p className="settings-card-hint">Permanently deletes your account, subjects, and practice history. Export a backup first if you want to keep them.</p>
        </div>
        <Button variant="danger" className="shrink-0 gap-2" onClick={() => setDeleting(true)}><IconTrash size={19} />Delete account</Button>
      </section>
      {deleting && (
        <ConfirmDialog
          title="Delete your account?"
          confirmLabel="Delete forever"
          danger
          input={{ label: "Current password", type: "password", autoComplete: "current-password" }}
          onClose={() => setDeleting(false)}
          onConfirm={async (currentPassword) => {
            await api<void>("/api/account", { method: "DELETE", body: JSON.stringify({ currentPassword }) });
            setUser(null);
            navigate("/login", { replace: true });
          }}
        >
          Everything goes: subjects, skills, exercises, and progress. This can't be undone.
        </ConfirmDialog>
      )}
    </>
  );
}

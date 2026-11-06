import { Link, useNavigate } from "react-router";
import { IconArchive, IconChevronRight, IconLogout, IconSettings, IconSparkles, IconTrash, type Icon } from "@tabler/icons-react";
import { useAuth } from "$lib/auth";
import Avatar from "../components/Avatar";

const ROWS: Array<{ to: string; label: string; hint: string; Symbol: Icon; color: string; drop?: string }> = [
  { to: "/agent", label: "Connect agent", hint: "Let an AI build lessons for you", Symbol: IconSparkles, color: "var(--color-gem)" },
  { to: "/archive", label: "Archive", hint: "Subjects you put away", Symbol: IconArchive, color: "#1cb0f6", drop: "archive" },
  { to: "/trash", label: "Trash", hint: "Deleted items, kept for 30 days", Symbol: IconTrash, color: "var(--color-cardinal)", drop: "trash" },
  { to: "/settings", label: "Settings", hint: "Profile, appearance, sessions, data", Symbol: IconSettings, color: "var(--color-wolf)" },
];

// The mobile Account tab: who you are, plus every page the bottom bar has no room for.
export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div className="mx-auto max-w-xl px-5 pb-28 pt-8 sm:px-8 md:pb-10 md:pt-10">
      <div className="flex flex-col items-center text-center">
        <Avatar user={user} className="size-24 text-3xl" />
        <h1 className="mt-4 text-2xl font-black">{user.username}</h1>
        {(user.email || user.isAdmin) && <p className="mt-0.5 text-sm font-bold text-wolf">{[user.email, user.isAdmin && "Admin"].filter(Boolean).join(" · ")}</p>}
      </div>
      <nav className="mt-8 flex flex-col gap-3" aria-label="Account">
        {ROWS.map(({ to, label, hint, Symbol, color, drop }) => (
          <Link key={to} to={to} data-drop={drop} className="account-row">
            <span className="account-row-icon" style={{ background: color }} aria-hidden="true"><Symbol size={22} stroke={2.4} /></span>
            <span className="min-w-0 flex-1">
              <span className="block">{label}</span>
              <span className="block truncate text-xs font-bold text-wolf">{hint}</span>
            </span>
            <IconChevronRight size={20} className="shrink-0 text-hare" aria-hidden="true" />
          </Link>
        ))}
        <button type="button" className="account-row mt-3 justify-center text-cardinal" onClick={() => void logout().then(() => navigate("/login"))}>
          <IconLogout size={20} aria-hidden="true" />Log out
        </button>
      </nav>
    </div>
  );
}

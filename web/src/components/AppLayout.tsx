import type { ReactNode } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router";
import { IconArchive, IconBook2, IconChartBar, IconSettings, IconSparkles, IconTrash } from "@tabler/icons-react";
import { useAuth } from "$lib/auth";
import Avatar from "./Avatar";
import Logo from "./Logo";

function BookIcon() {
  return <IconBook2 className="size-6" aria-hidden="true" />;
}

function SparkIcon() {
  return <IconSparkles className="size-6" aria-hidden="true" />;
}

// Pages reached from the Account tab, which stays lit on them.
const ACCOUNT_PATHS = ["/account", "/settings", "/agent", "/archive", "/trash"];

// Bottom bar tab: icon in a pill, label underneath.
function MobileTab({ to, end, label, active, children }: { to: string; end?: boolean; label: string; active?: boolean; children: ReactNode }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `mobile-tab ${active ?? isActive ? "mobile-tab-active" : ""}`}>
      <span className="mobile-tab-icon">{children}</span>
      {label}
    </NavLink>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? "nav-item-active" : ""}`;

export default function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="grid min-h-dvh place-items-center bg-surface font-bold text-wolf">Loading your lessons…</div>;
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b-2 border-swan bg-surface px-4 md:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <Link to="/archive" data-drop="archive" aria-label="Archive" className="nav-item p-2"><IconArchive className="size-6" aria-hidden="true" /></Link>
          <Link to="/trash" data-drop="trash" aria-label="Trash" className="nav-item p-2"><IconTrash className="size-6" aria-hidden="true" /></Link>
        </div>
      </header>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r-2 border-swan bg-surface p-5 md:flex">
        <div className="px-2 py-2"><Logo /></div>
        <nav className="mt-8 flex flex-col gap-2" aria-label="Main navigation">
          <NavLink to="/" end className={navClass}>
            <BookIcon />
            Learn
          </NavLink>
          <NavLink to="/stats" className={navClass}>
            <IconChartBar className="size-6" aria-hidden="true" />
            Statistics
          </NavLink>
          <NavLink to="/agent" className={navClass}>
            <SparkIcon />
            Connect agent
          </NavLink>
          {/* data-drop: subjects dragged in Edit mode can be dropped here. */}
          <NavLink to="/archive" data-drop="archive" className={navClass}>
            <IconArchive className="size-6" aria-hidden="true" />
            Archive
          </NavLink>
          <NavLink to="/trash" data-drop="trash" className={navClass}>
            <IconTrash className="size-6" aria-hidden="true" />
            Trash
          </NavLink>
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t-2 border-swan pt-4">
          <NavLink to="/settings" className={navClass}>
            <IconSettings className="size-6" aria-hidden="true" />
            Settings
          </NavLink>
          <Link to="/settings" className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-eel">
            <Avatar user={user} />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">{user.username}</p>
              {user.isAdmin && <p className="text-xs font-semibold text-wolf">Admin</p>}
            </div>
          </Link>
        </div>
      </aside>
      <main className="min-h-dvh md:ml-60">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t-2 border-swan bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Mobile navigation">
        <MobileTab to="/" end label="Learn"><BookIcon /></MobileTab>
        <MobileTab to="/stats" label="Stats"><IconChartBar className="size-6" aria-hidden="true" /></MobileTab>
        {/* Everything that doesn't fit the bar lives on the Account page. */}
        <MobileTab to="/account" label="Account" active={ACCOUNT_PATHS.some((path) => location.pathname.startsWith(path))}><Avatar user={user} className="size-7 text-xs" /></MobileTab>
      </nav>
    </div>
  );
}

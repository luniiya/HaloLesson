import { useState, type ReactNode } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router";
import { IconArchive, IconBook2, IconChartBar, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconSparkles, IconTrash } from "@tabler/icons-react";
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

// Desktop sidebar: full width with labels, or a rail of single icons. Per device.
const SIDEBAR_KEY = "halolesson:sidebar-collapsed";

function storedCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

// One sidebar link. Collapsed, the label stays for screen readers and shows as a tooltip.
function SideLink({ to, end, label, collapsed, drop, children }: { to: string; end?: boolean; label: string; collapsed: boolean; drop?: string; children: ReactNode }) {
  return (
    <NavLink to={to} end={end} data-drop={drop} title={collapsed ? label : undefined} className={navClass}>
      {children}
      <span className={collapsed ? "sr-only" : ""}>{label}</span>
    </NavLink>
  );
}

export default function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(storedCollapsed);
  const toggleSidebar = () => {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "0" : "1");
    } catch {}
  };
  if (loading) {
    return <div className="grid min-h-dvh place-items-center bg-surface font-bold text-wolf">Loading your lessons…</div>;
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className={`min-h-dvh bg-surface text-ink ${collapsed ? "sidebar-collapsed" : ""}`}>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b-2 border-swan bg-surface px-4 md:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <Link to="/archive" data-drop="archive" aria-label="Archive" className="nav-item p-2"><IconArchive className="size-6" aria-hidden="true" /></Link>
          <Link to="/trash" data-drop="trash" aria-label="Trash" className="nav-item p-2"><IconTrash className="size-6" aria-hidden="true" /></Link>
        </div>
      </header>
      <aside className="sidebar fixed inset-y-0 left-0 z-30 hidden flex-col border-r-2 border-swan bg-surface md:flex">
        <div className="px-2 py-2"><Logo compact={collapsed} /></div>
        <nav className="mt-8 flex flex-col gap-2" aria-label="Main navigation">
          <SideLink to="/" end label="Learn" collapsed={collapsed}><BookIcon /></SideLink>
          <SideLink to="/stats" label="Statistics" collapsed={collapsed}><IconChartBar className="size-6" aria-hidden="true" /></SideLink>
          <SideLink to="/agent" label="Connect agent" collapsed={collapsed}><SparkIcon /></SideLink>
          {/* data-drop: subjects dragged in Edit mode can be dropped here. */}
          <SideLink to="/archive" drop="archive" label="Archive" collapsed={collapsed}><IconArchive className="size-6" aria-hidden="true" /></SideLink>
          <SideLink to="/trash" drop="trash" label="Trash" collapsed={collapsed}><IconTrash className="size-6" aria-hidden="true" /></SideLink>
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t-2 border-swan pt-4">
          <button type="button" onClick={toggleSidebar} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : undefined} className="nav-item">
            {collapsed
              ? <IconLayoutSidebarLeftExpand className="size-6" aria-hidden="true" />
              : <IconLayoutSidebarLeftCollapse className="size-6" aria-hidden="true" />}
            <span className={collapsed ? "sr-only" : ""}>{collapsed ? "Expand sidebar" : "Collapse"}</span>
          </button>
          <Link to="/settings" title={collapsed ? user.username : undefined} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-eel">
            <Avatar user={user} />
            <div className={collapsed ? "sr-only" : "min-w-0"}>
              <p className="truncate text-sm font-extrabold">{user.username}</p>
              {user.isAdmin && <p className="text-xs font-semibold text-wolf">Admin</p>}
            </div>
          </Link>
        </div>
      </aside>
      <main className="min-h-dvh md:ml-(--sidebar)">
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

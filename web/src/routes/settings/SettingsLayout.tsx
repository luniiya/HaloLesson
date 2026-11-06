import { NavLink, Outlet } from "react-router";
import { IconDatabase, IconDevices, IconPalette, IconServer, IconUser, IconUsers, type Icon } from "@tabler/icons-react";
import { useAuth } from "$lib/auth";

interface Tab {
  to: string;
  label: string;
  icon: Icon;
}

const accountTabs: Tab[] = [
  { to: "/settings", label: "Account", icon: IconUser },
  { to: "/settings/appearance", label: "Appearance", icon: IconPalette },
  { to: "/settings/sessions", label: "Sessions", icon: IconDevices },
  { to: "/settings/data", label: "Import & export", icon: IconDatabase },
];

const adminTabs: Tab[] = [
  { to: "/settings/users", label: "Users", icon: IconUsers },
  { to: "/settings/server", label: "Server", icon: IconServer },
];

function TabLink({ tab }: { tab: Tab }) {
  const TabIcon = tab.icon;
  return (
    <NavLink to={tab.to} end className={({ isActive }) => `settings-tab ${isActive ? "settings-tab-active" : ""}`}>
      <TabIcon size={20} aria-hidden="true" />
      {tab.label}
    </NavLink>
  );
}

export default function SettingsLayout() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-5xl px-5 pb-28 pt-8 sm:px-8 md:pb-16 md:pt-10">
      <header className="mb-6">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-accent-deep">Settings</p>
        <h1 className="text-[2rem] font-black leading-tight tracking-tight sm:text-4xl">Your account</h1>
      </header>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav aria-label="Settings sections" className="-mx-5 flex gap-1 overflow-x-auto px-5 pb-1 lg:mx-0 lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible lg:px-0">
          {accountTabs.map((tab) => <TabLink key={tab.to} tab={tab} />)}
          {user?.isAdmin && (
            <>
              <p className="hidden px-3.5 pb-1 pt-4 text-xs font-black uppercase tracking-[0.14em] text-hare lg:block">Admin</p>
              <span className="mx-1 w-0.5 shrink-0 self-stretch bg-swan lg:hidden" aria-hidden="true" />
              {adminTabs.map((tab) => <TabLink key={tab.to} tab={tab} />)}
            </>
          )}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router";
import { IconBook2, IconLogout, IconSettings, IconSparkles } from "@tabler/icons-react";
import { useAuth } from "$lib/auth";
import AgentPromptDialog from "./AgentPromptDialog";
import Avatar from "./Avatar";
import Logo from "./Logo";
import Button from "./Button";

function BookIcon() {
  return <IconBook2 className="size-6" aria-hidden="true" />;
}

function SparkIcon() {
  return <IconSparkles className="size-6" aria-hidden="true" />;
}

export default function AppLayout() {
  const { user, loading, logout } = useAuth();
  const [agentOpen, setAgentOpen] = useState(false);
  const location = useLocation();
  if (loading) {
    return <div className="grid min-h-dvh place-items-center bg-white font-bold text-wolf">Loading your lessons…</div>;
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="min-h-dvh bg-white text-ink">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b-2 border-swan bg-white px-4 md:hidden">
        <Logo />
        <Link to="/settings" aria-label="Settings" className="rounded-full"><Avatar user={user} className="size-9 text-sm" /></Link>
      </header>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r-2 border-swan bg-white p-5 md:flex">
        <div className="px-2 py-2"><Logo /></div>
        <nav className="mt-8 flex flex-col gap-2" aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}>
            <BookIcon />
            Learn
          </NavLink>
          <button type="button" className="nav-item text-left" onClick={() => setAgentOpen(true)}><SparkIcon />Connect agent</button>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}>
            <IconSettings className="size-6" aria-hidden="true" />
            Settings
          </NavLink>
        </nav>
        <div className="mt-auto border-t-2 border-swan pt-4">
          <Link to="/settings" className="mb-3 flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-eel">
            <Avatar user={user} />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">{user.username}</p>
              <p className="text-xs font-semibold text-wolf">{user.isAdmin ? "Admin" : "Your learning space"}</p>
            </div>
          </Link>
          <Button variant="ghost" className="w-full gap-2" onClick={() => void logout()}><IconLogout size={19} />Log out</Button>
        </div>
      </aside>
      <main className="min-h-dvh md:ml-60">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-center justify-around border-t-2 border-swan bg-white md:hidden" aria-label="Mobile navigation">
        <NavLink to="/" end className={({ isActive }) => `nav-item px-5 ${isActive ? "nav-item-active" : ""}`}><BookIcon /><span className="text-xs">Learn</span></NavLink>
        <button type="button" className="nav-item px-5 text-xs" onClick={() => setAgentOpen(true)}><SparkIcon />Create</button>
        <NavLink to="/settings" className={({ isActive }) => `nav-item px-5 ${isActive ? "nav-item-active" : ""}`}><IconSettings className="size-6" aria-hidden="true" /><span className="text-xs">Settings</span></NavLink>
      </nav>
      {agentOpen && <AgentPromptDialog onClose={() => setAgentOpen(false)} />}
    </div>
  );
}

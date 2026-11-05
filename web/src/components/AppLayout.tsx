import { useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router";
import { IconBook2, IconSparkles } from "@tabler/icons-react";
import { useAuth } from "$lib/auth";
import AgentPromptDialog from "./AgentPromptDialog";
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
        <span className="grid size-9 place-items-center rounded-full bg-owl-pale text-sm font-black text-owl-deep">
          {user.username.slice(0, 1).toUpperCase()}
        </span>
      </header>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r-2 border-swan bg-white p-5 md:flex">
        <div className="px-2 py-2"><Logo /></div>
        <nav className="mt-8 flex flex-col gap-2" aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}>
            <BookIcon />
            Learn
          </NavLink>
          <button type="button" className="nav-item text-left" onClick={() => setAgentOpen(true)}><SparkIcon />Create with AI</button>
        </nav>
        <div className="mt-auto border-t-2 border-swan pt-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <span className="grid size-10 place-items-center rounded-full bg-owl-pale font-black text-owl-deep">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">{user.username}</p>
              <p className="text-xs font-semibold text-wolf">Your learning space</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full" onClick={() => void logout()}>Log out</Button>
        </div>
      </aside>
      <main className="min-h-dvh md:ml-60">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-center justify-around border-t-2 border-swan bg-white md:hidden" aria-label="Mobile navigation">
        <NavLink to="/" className="nav-item nav-item-active px-5"><BookIcon /><span className="text-xs">Learn</span></NavLink>
        <button type="button" className="nav-item px-5 text-xs" onClick={() => setAgentOpen(true)}><SparkIcon />Create</button>
        <Button variant="ghost" className="px-5 text-xs" onClick={() => void logout()}>Log out</Button>
      </nav>
      {agentOpen && <AgentPromptDialog onClose={() => setAgentOpen(false)} />}
    </div>
  );
}

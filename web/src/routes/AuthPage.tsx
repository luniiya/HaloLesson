import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { MIN_PASSWORD_LENGTH, USERNAME_HTML_PATTERN, validatePassword } from "@halolesson/shared";
import { useAuth } from "$lib/auth";
import { useServerInfo } from "$lib/server";
import Logo from "../components/Logo";
import Button from "../components/Button";
import BookArtwork from "../components/BookArtwork";

export default function AuthPage() {
  const { user, loading, login, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const info = useServerInfo();
  const settingUp = location.pathname === "/setup";
  const registering = settingUp || location.pathname === "/register";
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;
  if (!info) return <div className="grid min-h-dvh place-items-center bg-white font-bold text-wolf">Loading…</div>;
  if (info.needsSetup && !settingUp) return <Navigate to="/setup" replace />;
  if (!info.needsSetup && settingUp) return <Navigate to="/login" replace />;
  const { requireEmail, requireStrongPasswords, signupEnabled } = info.settings;
  const signupClosed = registering && !settingUp && !signupEnabled;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (registering) {
      if (password !== confirmation) {
        setError("Passwords do not match");
        return;
      }
      const check = validatePassword(password, requireStrongPasswords);
      if (!check.valid) {
        setError(check.reason ?? "Invalid password");
        return;
      }
    }
    setSubmitting(true);
    try {
      if (registering) await register(username, email, password);
      else await login(identifier, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from || "/", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-white text-ink lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="auth-hero relative hidden min-h-dvh overflow-hidden bg-[#f0fbe8] px-12 py-10 lg:flex lg:flex-col xl:px-20">
        <div className="relative z-10"><Logo /></div>
        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center py-10 text-center">
          <span className="mb-5 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-owl-deep shadow-[0_2px_0_#d5e8c8]">Practice, on your terms</span>
          <h1 className="text-[2.75rem] font-black leading-[1.08] tracking-tight text-ink xl:text-5xl">Don’t just remember it.<br /><span className="text-owl-deep">Know how to use it.</span></h1>
          <p className="mt-5 max-w-md text-lg font-semibold leading-7 text-wolf">Turn what you’re learning into skills you can practice, revisit, and truly master.</p>
          <BookArtwork className="mascot-float mt-4 w-72 xl:w-80" />
          <div className="flex flex-wrap justify-center gap-3 text-xs font-extrabold text-owl-deep">
            <span className="rounded-full bg-white/80 px-4 py-2">Your subjects</span>
            <span className="rounded-full bg-white/80 px-4 py-2">Real exercises</span>
            <span className="rounded-full bg-white/80 px-4 py-2">Visible mastery</span>
          </div>
        </div>
        <p className="relative z-10 text-center text-xs font-bold text-wolf">Built to complement Anki, not replace it.</p>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-8 sm:px-10 lg:px-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 text-center lg:hidden"><Logo /></div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-eel-blue">{settingUp ? "First-time setup" : registering ? "Start your path" : "Good to see you"}</p>
          <h2 className="text-3xl font-black tracking-tight">{settingUp ? "Create the admin account" : registering ? "Create your learning space" : "Welcome back"}</h2>
          <p className="mb-7 mt-2 text-[15px] font-semibold leading-6 text-wolf">
            {settingUp
              ? "This first account manages the server: who can sign up, and the other accounts."
              : registering ? "Your subjects, skills, and progress. All in one place." : "Jump back into whatever you want to sharpen."}
          </p>
          {error && <p role="alert" className="notice-error mb-5">{error}</p>}
          {signupClosed ? (
            <div className="flex flex-col gap-4">
              <p className="notice-error">Sign ups are closed on this server. Ask the admin to create an account for you.</p>
              <Link to="/login" className="button button-secondary w-full">Back to log in</Link>
            </div>
          ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {registering ? (
              <>
                <label className="form-label">Username
                  <input className="form-input" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={32} pattern={USERNAME_HTML_PATTERN} placeholder="How should we call you?" required autoFocus />
                </label>
                <label className="form-label"><span>Email {!requireEmail && <span className="font-semibold text-hare">(optional)</span>}</span>
                  <input type="email" className="form-input" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required={requireEmail} />
                </label>
              </>
            ) : (
              <label className="form-label">Username or email
                <input className="form-input" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="Your username or email" required autoFocus />
              </label>
            )}
            <label className="form-label">Password
              <input type="password" className="form-input" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={registering ? "new-password" : "current-password"} minLength={registering && requireStrongPasswords ? MIN_PASSWORD_LENGTH : undefined} placeholder={registering ? (requireStrongPasswords ? "At least 8 characters" : "Choose a password") : "Your password"} required />
            </label>
            {registering && (
              <label className="form-label">Confirm password
                <input type="password" className="form-input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" placeholder="One more time" required />
              </label>
            )}
            <Button type="submit" className="mt-3 w-full" disabled={submitting}>
              {submitting ? "Please wait…" : settingUp ? "Create admin account" : registering ? "Create account" : "Log in"}
            </Button>
            {!settingUp && (registering || signupEnabled) && (
              <Link to={registering ? "/login" : "/register"} className="button button-secondary mt-1 w-full">
                {registering ? "I already have an account" : "New to haloLesson"}
              </Link>
            )}
          </form>
          )}
          <p className="mt-7 text-center text-xs font-semibold leading-5 text-wolf">No daily due pile. No pointless quizzes.<br />Just the practice you choose.</p>
        </div>
      </section>
    </main>
  );
}

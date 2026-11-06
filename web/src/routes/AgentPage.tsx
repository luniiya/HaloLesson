import { useRef, useState } from "react";
import { Link } from "react-router";
import { IconCheck, IconCopy, IconEye, IconLoader2, IconPlugConnected, IconShieldLock, IconSparkles, IconTerminal2, type Icon } from "@tabler/icons-react";
import type { CreatedAgentToken } from "@halolesson/shared";
import { api } from "$lib/api";
import { copyText } from "$lib/clipboard";
import Button from "../components/Button";

const STEPS: { Symbol: Icon; title: string; text: string; color: string }[] = [
  { Symbol: IconPlugConnected, title: "Create a prompt", text: "It carries a fresh token for your account.", color: "var(--color-gem)" },
  { Symbol: IconTerminal2, title: "Paste it into your agent", text: "Claude Code, Codex, Cursor, or anything that can make HTTP requests.", color: "var(--color-streak)" },
  { Symbol: IconEye, title: "Watch lessons appear", text: "Subjects, skills and exercises show up here live as it builds them.", color: "var(--color-accent)" },
];

// The Agent tab: mint an agent prompt and copy it.
export default function AgentPage() {
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [created, setCreated] = useState<CreatedAgentToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Each press mints a fresh token, so the prompt is only built on demand.
  async function connect() {
    setError("");
    setBusy(true);
    try {
      // Hold the press animation long enough to read even on a fast server.
      const [next] = await Promise.all([
        api<CreatedAgentToken>("/api/agent/tokens", { method: "POST", body: "{}" }),
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);
      setCreated(next);
      setCopied(await copyText(next.prompt, null));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create an agent token");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-28 pt-8 sm:px-8 md:pb-10 md:pt-10">
      <span className="grid size-14 place-items-center rounded-2xl bg-gem/15 text-gem" aria-hidden="true"><IconSparkles size={30} /></span>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-gem">Agent-assisted authoring</p>
      <h1 className="mt-1 text-[2rem] font-black leading-tight tracking-tight sm:text-4xl">Connect an agent</h1>
      <p className="mt-3 text-[15px] font-semibold leading-6 text-wolf">Let an AI agent build lessons straight into your account, or read your progress and statistics to plan your review.</p>

      <ol className="mt-8 grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ Symbol, title, text, color }, index) => (
          <li key={title} className="rounded-2xl border-2 border-swan p-4">
            <span className="grid size-10 place-items-center rounded-xl text-white" style={{ background: color }} aria-hidden="true"><Symbol size={22} stroke={2.4} /></span>
            <p className="mt-3 text-sm font-black"><span className="text-hare">{index + 1}.</span> {title}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-wolf">{text}</p>
          </li>
        ))}
      </ol>

      <section className="settings-card mt-6">
        {!created ? (
          <>
            <Button className={`w-full gap-2 ${busy ? "button-pressed" : ""}`} disabled={busy} aria-busy={busy} onClick={() => void connect()}>
              {busy ? <><IconLoader2 size={19} className="animate-spin" />Creating token…</> : <><IconPlugConnected size={19} />Create agent prompt</>}
            </Button>
            {error && <p role="alert" className="notice-error mt-4">{error}</p>}
          </>
        ) : (
          <div className="reveal-up">
            <label className="form-label">Agent prompt
              <textarea ref={promptRef} readOnly value={created.prompt} className="form-input min-h-64 resize-y bg-eel font-mono text-xs leading-5" onFocus={(event) => event.target.select()} />
            </label>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button className="w-full gap-2" onClick={() => void copyText(created.prompt, promptRef.current).then(setCopied)}>
                {copied ? <><IconCheck size={19} className="pop-in" />Copied to clipboard</> : <><IconCopy size={19} />Copy prompt</>}
              </Button>
              <Button variant="secondary" className="w-full gap-2 sm:w-auto sm:shrink-0" onClick={() => { setCreated(null); setCopied(false); }}>New prompt</Button>
            </div>
            <p className="mt-4 flex gap-2.5 rounded-xl bg-eel p-3.5 text-xs font-semibold leading-5 text-wolf">
              <IconShieldLock size={18} className="shrink-0 text-ink" aria-hidden="true" />
              <span>This prompt has a token ending in <strong className="font-mono text-ink">…{created.token.hint}</strong> with full access to your lessons. It doesn't expire, so treat it like a password.</span>
            </p>
          </div>
        )}
      </section>
      <p className="mt-4 text-center text-xs font-bold text-wolf">See and revoke connected agents in <Link to="/settings/sessions" className="font-extrabold text-secondary hover:underline">Settings, Sessions</Link>.</p>
    </div>
  );
}

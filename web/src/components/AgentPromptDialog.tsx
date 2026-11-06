import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy, IconLoader2, IconPlugConnected, IconShieldLock, IconSparkles, IconX } from "@tabler/icons-react";
import type { CreatedAgentToken } from "@halolesson/shared";
import { api } from "$lib/api";
import { copyText } from "$lib/clipboard";
import Button from "./Button";

export default function AgentPromptDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [created, setCreated] = useState<CreatedAgentToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

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
    <dialog ref={dialogRef} className="agent-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }} aria-labelledby="agent-dialog-title">
      <div className="agent-dialog-card">
        <button type="button" onClick={onClose} className="absolute right-4 top-3 rounded-lg p-2 text-wolf hover:bg-eel hover:text-ink" aria-label="Close dialog"><IconX size={22} /></button>
        <span className="grid size-12 place-items-center rounded-2xl bg-gem/15 text-gem" aria-hidden="true"><IconSparkles size={26} /></span>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-gem">Agent-assisted authoring</p>
        <h2 id="agent-dialog-title" className="mt-1 text-2xl font-black">Connect agent</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-wolf">Paste the prompt into Claude Code, Codex, Cursor or any agent that can make HTTP requests. It builds lessons straight into your account and you watch them appear here live.</p>
        {!created ? (
          <>
            <Button className={`mt-5 w-full gap-2 ${busy ? "button-pressed" : ""}`} disabled={busy} aria-busy={busy} onClick={() => void connect()}>
              {busy ? <><IconLoader2 size={19} className="animate-spin" />Creating token…</> : <><IconPlugConnected size={19} />Create agent prompt</>}
            </Button>
            {error && <p role="alert" className="notice-error mt-4">{error}</p>}
          </>
        ) : (
          <div className="reveal-up">
            <label className="form-label mt-4">Agent prompt
              <textarea ref={promptRef} readOnly value={created.prompt} className="form-input min-h-52 resize-none bg-eel font-mono text-xs leading-5" onFocus={(event) => event.target.select()} />
            </label>
            <Button className="mt-4 w-full gap-2" onClick={() => void copyText(created.prompt, promptRef.current).then(setCopied)}>
              {copied ? <><IconCheck size={19} className="pop-in" />Copied to clipboard</> : <><IconCopy size={19} />Copy prompt</>}
            </Button>
            <p className="mt-4 flex gap-2.5 rounded-xl bg-eel p-3.5 text-xs font-semibold leading-5 text-wolf">
              <IconShieldLock size={18} className="shrink-0 text-ink" aria-hidden="true" />
              <span>This prompt has a token ending in <strong className="font-mono text-ink">…{created.token.hint}</strong> with full access to your lessons. It doesn't expire, so treat it like a password. Revoke it any time in Settings, Sessions.</span>
            </p>
          </div>
        )}
      </div>
    </dialog>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconCopy, IconPlugConnected, IconShieldLock, IconSparkles, IconX } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import type { CreatedAgentToken } from "@halolesson/shared";
import { api } from "$lib/api";
import Button from "./Button";
import { ImportPanel } from "../routes/settings/DataSettings";

// Offline fallback for agents without tool or network access: they return
// JSON, which the user pastes into the import box.
function jsonPrompt(topic: string) {
  return `Create a haloLesson practice path for: ${topic.trim() || "[describe what you want to practice]"}.

Return only valid JSON with this shape:
{
  "subject": { "name": "", "description": "" },
  "units": [{
    "title": "",
    "description": "",
    "skills": [{
      "title": "",
      "description": "",
      "exercises": [{
        "type": "multiple_choice" or "free_text",
        "prompt": "",
        "options": ["for multiple choice"],
        "correctIndex": 0,
        "answers": ["for free text"],
        "explanation": ""
      }]
    }]
  }]
}

Focus on procedural practice and applying concepts, not passive memorization. Use 3–6 exercises per skill with varied contexts and unambiguous answers. Do not include markdown fences.`;
}

// The Clipboard API needs a secure context, so plain-http LAN servers fall
// back to selecting the textarea. Returns whether anything was copied.
async function copyText(text: string, fallback: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!fallback) return false;
    fallback.select();
    return document.execCommand("copy");
  }
}

export default function AgentPromptDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const jsonRef = useRef<HTMLTextAreaElement>(null);
  const [topic, setTopic] = useState("");
  const [created, setCreated] = useState<CreatedAgentToken | null>(null);
  const [copied, setCopied] = useState<"agent" | "json" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const fallbackPrompt = useMemo(() => jsonPrompt(topic), [topic]);

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
      const next = await api<CreatedAgentToken>("/api/agent/tokens", { method: "POST", body: JSON.stringify({ topic: topic.trim() }) });
      setCreated(next);
      if (await copyText(next.prompt, null)) setCopied("agent");
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
        <h2 id="agent-dialog-title" className="mt-1 text-2xl font-black">Connect an agent</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-wolf">Paste the prompt into Claude Code, Codex, Cursor or any agent that can make HTTP requests. It builds lessons straight into your account and you watch them appear here live.</p>
        <label className="form-label mt-5"><span>What do you want to practice? <span className="font-semibold text-hare">(optional)</span></span>
          <input className="form-input" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. Integration by parts" maxLength={120} disabled={Boolean(created)} />
        </label>
        {!created ? (
          <>
            <Button className="mt-5 w-full gap-2" disabled={busy} onClick={() => void connect()}><IconPlugConnected size={19} />{busy ? "Creating token…" : "Create agent prompt"}</Button>
            {error && <p role="alert" className="notice-error mt-4">{error}</p>}
          </>
        ) : (
          <>
            <label className="form-label mt-4">Agent prompt
              <textarea ref={promptRef} readOnly value={created.prompt} className="form-input min-h-52 resize-none bg-eel font-mono text-xs leading-5" onFocus={(event) => event.target.select()} />
            </label>
            <Button className="mt-4 w-full gap-2" onClick={() => void copyText(created.prompt, promptRef.current).then((ok) => setCopied(ok ? "agent" : null))}>
              {copied === "agent" ? <><IconCheck size={19} />Copied to clipboard</> : <><IconCopy size={19} />Copy prompt</>}
            </Button>
            <p className="mt-4 flex gap-2.5 rounded-xl bg-eel p-3.5 text-xs font-semibold leading-5 text-wolf">
              <IconShieldLock size={18} className="shrink-0 text-ink" aria-hidden="true" />
              <span>This prompt has a token ending in <strong className="font-mono text-ink">…{created.token.hint}</strong> with full access to your lessons. It doesn't expire, so treat it like a password. Revoke it any time in Settings, Sessions.</span>
            </p>
          </>
        )}
        <details className="mt-7 border-t-2 border-swan pt-5">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-wolf hover:text-ink">No tools? Paste JSON instead</summary>
          <p className="mt-3 text-sm font-semibold leading-6 text-wolf">For chat assistants that can't reach this server: copy this prompt, then import what they return.</p>
          <textarea ref={jsonRef} readOnly value={fallbackPrompt} className="form-input mt-3 min-h-40 w-full resize-none bg-eel font-mono text-xs leading-5" onFocus={(event) => event.target.select()} aria-label="JSON prompt" />
          <Button variant="secondary" className="mt-3 w-full gap-2" onClick={() => void copyText(fallbackPrompt, jsonRef.current).then((ok) => setCopied(ok ? "json" : null))}>
            {copied === "json" ? <><IconCheck size={19} />Copied</> : <><IconCopy size={19} />Copy JSON prompt</>}
          </Button>
          <div className="mt-5">
            <ImportPanel onImported={(result) => {
              const first = result.subjects[0];
              if (result.subjects.length === 1 && first) {
                onClose();
                navigate(`/subjects/${first.id}`);
              }
            }} />
          </div>
        </details>
      </div>
    </dialog>
  );
}

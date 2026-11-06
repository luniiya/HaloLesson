import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconCopy, IconSparkles, IconX } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import Button from "./Button";
import { ImportPanel } from "../routes/settings/DataSettings";

export default function AgentPromptDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [topic, setTopic] = useState("");
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const prompt = useMemo(() => `Create a haloLesson practice path for: ${topic.trim() || "[describe what you want to practice]"}.

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

Focus on procedural practice and applying concepts, not passive memorization. Use 3–6 exercises per skill with varied contexts and unambiguous answers. Do not include markdown fences.`, [topic]);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      promptRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
  }

  return (
    <dialog ref={dialogRef} className="agent-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }} aria-labelledby="agent-dialog-title">
      <div className="agent-dialog-card">
        <button type="button" onClick={onClose} className="absolute right-4 top-3 rounded-lg p-2 text-wolf hover:bg-eel hover:text-ink" aria-label="Close dialog"><IconX size={22} /></button>
        <span className="grid size-12 place-items-center rounded-2xl bg-gem/15 text-gem" aria-hidden="true"><IconSparkles size={26} /></span>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-gem">Agent-assisted authoring</p>
        <h2 id="agent-dialog-title" className="mt-1 text-2xl font-black">Turn a topic into practice</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-wolf">Copy this prompt into your coding agent. It will prepare structured lessons for haloLesson, then paste what it returns below.</p>
        <label className="form-label mt-5">What do you want to practice?<input className="form-input" value={topic} onChange={(event) => { setTopic(event.target.value); setCopied(false); }} placeholder="e.g. Integration by parts" maxLength={120} /></label>
        <label className="form-label mt-4">Agent prompt<textarea ref={promptRef} readOnly value={prompt} className="form-input min-h-52 resize-none bg-eel font-mono text-xs leading-5" onFocus={(event) => event.target.select()} /></label>
        <Button className="mt-5 w-full gap-2" onClick={copyPrompt}>{copied ? <><IconCheck size={19} />Copied to clipboard</> : <><IconCopy size={19} />Copy agent prompt</>}</Button>
        <div className="mt-7 border-t-2 border-swan pt-6">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-gem">Then import the result</p>
          <ImportPanel onImported={(result) => {
            const first = result.subjects[0];
            if (result.subjects.length === 1 && first) {
              onClose();
              navigate(`/subjects/${first.id}`);
            }
          }} />
        </div>
      </div>
    </dialog>
  );
}

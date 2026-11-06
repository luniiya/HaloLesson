import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy, IconDownload, IconLink, IconLoader2, IconShare, IconX } from "@tabler/icons-react";
import type { ShareLink } from "@halolesson/shared";
import { api } from "$lib/api";
import { copyText } from "$lib/clipboard";
import { download } from "$lib/server";
import Button from "./Button";

// Share a subject either as a live link (always the latest version, revocable)
// or as a file anyone can import.
export default function ShareDialog({ subjectId, onClose }: { subjectId: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState<ShareLink | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const path = `/api/subjects/${encodeURIComponent(subjectId)}`;
  const url = link ? `${location.origin}/shared/${link.token}` : "";

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    api<{ link: ShareLink | null }>(`${path}/share`)
      .then((data) => setLink(data.link))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load the share link"));
  }, [path]);

  async function change(method: "POST" | "DELETE") {
    setError("");
    setBusy(true);
    try {
      if (method === "POST") {
        const data = await api<{ link: ShareLink }>(`${path}/share`, { method, body: "{}" });
        setLink(data.link);
        setCopied(await copyText(`${location.origin}/shared/${data.link.token}`, null));
      } else {
        await api(`${path}/share`, { method });
        setLink(null);
        setCopied(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="agent-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }} aria-labelledby="share-dialog-title">
      <div className="agent-dialog-card">
        <button type="button" onClick={onClose} className="absolute right-4 top-3 rounded-lg p-2 text-wolf hover:bg-eel hover:text-ink" aria-label="Close dialog"><IconX size={22} /></button>
        <span className="grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent-deep" aria-hidden="true"><IconShare size={26} /></span>
        <h2 id="share-dialog-title" className="mt-4 text-2xl font-black">Share this subject</h2>

        <section className="mt-5 rounded-2xl border-2 border-swan p-4">
          <h3 className="flex items-center gap-2 font-black"><IconLink size={19} aria-hidden="true" />Share a link</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-wolf">Anyone with an account who opens it sees your latest version and can add a copy to their library. Your progress stays private.</p>
          {link === undefined && !error ? (
            <p className="mt-4 text-sm font-bold text-wolf">Loading…</p>
          ) : link ? (
            <div className="reveal-up">
              <input ref={linkRef} readOnly value={url} aria-label="Share link" className="form-input mt-4 bg-eel font-mono text-xs" onFocus={(event) => event.target.select()} />
              <div className="mt-3 flex flex-col-reverse gap-3 sm:flex-row">
                <Button variant="secondary" className="sm:flex-1" disabled={busy} onClick={() => void change("DELETE")}>Stop sharing</Button>
                <Button className="gap-2 sm:flex-1" onClick={() => void copyText(url, linkRef.current).then(setCopied)}>
                  {copied ? <><IconCheck size={19} className="pop-in" />Copied</> : <><IconCopy size={19} />Copy link</>}
                </Button>
              </div>
            </div>
          ) : (
            <Button className="mt-4 w-full gap-2" disabled={busy || link === undefined} aria-busy={busy} onClick={() => void change("POST")}>
              {busy ? <><IconLoader2 size={19} className="animate-spin" />Creating link…</> : <><IconLink size={19} />Create link</>}
            </Button>
          )}
          {error && <p role="alert" className="notice-error mt-4">{error}</p>}
        </section>

        <section className="mt-4 rounded-2xl border-2 border-swan p-4">
          <h3 className="flex items-center gap-2 font-black"><IconDownload size={19} aria-hidden="true" />Export a file</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-wolf">A .halo file anyone can import from Settings, Data, without your progress or notes. Send a newer one later and they can update their copy, keeping their progress.</p>
          <Button variant="secondary" className="mt-4 w-full gap-2" onClick={() => download(`${path}/export`)}><IconDownload size={19} />Download file</Button>
        </section>
      </div>
    </dialog>
  );
}

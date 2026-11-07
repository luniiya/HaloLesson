import { useEffect, useRef, useState } from "react";
import UnlockInOrderToggle from "./UnlockInOrderToggle";
import { Link } from "react-router";
import { IconArchive, IconArrowRight, IconFolderOpen, IconTrash, IconX } from "@tabler/icons-react";
import { SUBJECT_COLORS, libraryStates, type Folder, type Library, type Subject, type SubjectColor, type SubjectIcon, type Tier } from "@halolesson/shared";
import { entryParent, folderPath, libraryApi, type Entry } from "$lib/library";
import Button from "./Button";
import IconPicker from "./IconPicker";
import { defaultGradients } from "./CreateSubjectForm";

interface Props {
  entry: Entry;
  library: Library;
  onOpenFolder: (id: string) => void;
  // Runs after a change so the page can refetch.
  onChanged: () => void;
  onClose: () => void;
}

// What clicking a circle in Edit mode opens: rename, recolor, change icon,
// move to another folder, archive or trash. Reordering is drag and drop on the orbit.
export default function LibraryItemDialog({ entry, library, onOpenFolder, onChanged, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  async function run(action: () => Promise<unknown>) {
    setError("");
    try {
      await action();
      onChanged();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    }
  }

  const { kind, item } = entry;
  const states = libraryStates(library);
  // A folder can't go into itself or anything inside it.
  const inside = new Set<string>();
  if (kind === "folder") {
    inside.add(item.id);
    for (let grew = true; grew;) {
      grew = false;
      for (const folder of library.folders) if (folder.parentId && inside.has(folder.parentId) && !inside.has(folder.id)) { inside.add(folder.id); grew = true; }
    }
  }
  const targets = library.folders.filter((folder) => states.get(folder.id) === "active" && !inside.has(folder.id));

  return (
    <dialog ref={dialogRef} className="agent-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }} aria-labelledby="item-dialog-title">
      <div className="agent-dialog-card">
        <button type="button" onClick={onClose} className="absolute right-4 top-3 rounded-lg p-2 text-wolf hover:bg-eel hover:text-ink" aria-label="Close dialog"><IconX size={22} /></button>
        <h2 id="item-dialog-title" className="truncate pr-10 text-2xl font-black">{kind === "folder" ? "Edit folder" : item.type === "tracker" ? "Edit tracker" : "Edit subject"}</h2>
        {error && <p role="alert" className="notice-error mt-4">{error}</p>}
        {kind === "subject"
          ? <SubjectFields subject={item} onSave={(fields) => run(() => libraryApi.updateSubject(item.id, fields))} />
          : <FolderFields folder={item} onSave={(fields) => run(() => libraryApi.updateFolder(item.id, fields))} />}
        <div className="mt-5 flex flex-col gap-4 border-t-2 border-swan pt-5">
          <label className="form-label">Location
            <select className="form-input" value={entryParent(entry) ?? ""} onChange={(event) => void run(() => libraryApi.move(kind, item.id, event.target.value || null))}>
              <option value="">Top level</option>
              {targets.map((folder) => <option key={folder.id} value={folder.id}>{folderPath(library, folder.id).map((part) => part.name).join(" / ")}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-3">
            {kind === "folder"
              ? <Button variant="secondary" className="gap-2" onClick={() => { onClose(); onOpenFolder(item.id); }}><IconFolderOpen size={19} />Open folder</Button>
              : <Link to={`/subjects/${item.id}`} className="button button-secondary gap-2"><IconArrowRight size={19} />{item.type === "tracker" ? "Open tracker" : "Open subject"}</Link>}
            <span className="flex-1" />
            <Button variant="ghost" className="gap-2" onClick={() => void run(() => libraryApi.archive(kind, item.id, true))}><IconArchive size={19} />Archive</Button>
            <Button variant="ghost" className="gap-2 text-cardinal hover:text-cardinal" onClick={() => void run(() => libraryApi.trash(kind, item.id))}><IconTrash size={19} />Trash</Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

type SubjectTab = "details" | "look" | "progression";

// Subject settings in tabs: what it is, how it looks, and how its skills
// open. Trackers have no skills, so no progression tab. One form saves all tabs.
function SubjectFields({ subject, onSave }: { subject: Subject; onSave: (fields: Parameters<typeof libraryApi.updateSubject>[1]) => void }) {
  const [tab, setTab] = useState<SubjectTab>("details");
  const [name, setName] = useState(subject.name);
  const [description, setDescription] = useState(subject.description);
  const [color, setColor] = useState<SubjectColor>(subject.color);
  const [gradientStart, setGradientStart] = useState(subject.gradientStart);
  const [gradientEnd, setGradientEnd] = useState(subject.gradientEnd);
  const [icon, setIcon] = useState<SubjectIcon | null>(subject.icon);
  const [unlockInOrder, setUnlockInOrder] = useState(subject.unlockInOrder);
  const [unlockTier, setUnlockTier] = useState<Tier>(subject.unlockTier);
  const tabs: Array<[SubjectTab, string]> = [["details", "Details"], ["look", "Look"], ...(subject.type === "subject" ? [["progression", "Progression"] as [SubjectTab, string]] : [])];

  function chooseColor(option: SubjectColor) {
    setColor(option);
    setGradientStart(defaultGradients[option][0]);
    setGradientEnd(defaultGradients[option][1]);
  }

  return (
    <form
      className="mt-5 flex flex-col gap-4"
      // The name is required: when it's empty on another tab, show it.
      onInvalidCapture={() => setTab("details")}
      onSubmit={(event) => { event.preventDefault(); onSave({ name, description, color, gradientStart, gradientEnd, icon, ...(subject.type === "subject" ? { unlockInOrder, unlockTier } : {}) }); }}
    >
      <div className="settings-tabs" role="tablist" aria-label="Subject settings">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`subject-tab-${id}`} aria-selected={tab === id} aria-controls={`subject-panel-${id}`} className="settings-tab" onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <div role="tabpanel" id="subject-panel-details" aria-labelledby="subject-tab-details" hidden={tab !== "details"} className="grid gap-4 sm:grid-cols-2">
        <label className="form-label">Name<input className="form-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
        <label className="form-label">Description<input className="form-input" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></label>
      </div>

      <div role="tabpanel" id="subject-panel-look" aria-labelledby="subject-tab-look" hidden={tab !== "look"} className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-sm font-extrabold text-wolf">Color</legend>
          <div className="flex flex-wrap gap-3">
            {SUBJECT_COLORS.map((option) => (
              <label key={option} className={`color-option color-${option} relative ${color === option ? "color-option-selected" : ""}`} title={option}>
                <input type="radio" name={`color-${subject.id}`} checked={color === option} onChange={() => chooseColor(option)} className="absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0" />
                <span className="sr-only">{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {subject.type === "subject" && <fieldset>
          <legend className="mb-2 text-sm font-extrabold text-wolf">Skill path gradient</legend>
          <div className="flex items-center gap-3 rounded-xl bg-eel p-3">
            <input type="color" value={gradientStart} onChange={(event) => setGradientStart(event.target.value)} aria-label="Gradient start color" />
            <div className="h-3 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${gradientStart}, ${gradientEnd})` }} aria-hidden="true" />
            <input type="color" value={gradientEnd} onChange={(event) => setGradientEnd(event.target.value)} aria-label="Gradient end color" />
          </div>
        </fieldset>}
        <div className="sm:col-span-2"><IconPicker value={icon} onChange={setIcon} name={name} description={description} /></div>
      </div>

      {subject.type === "subject" && (
        <div role="tabpanel" id="subject-panel-progression" aria-labelledby="subject-tab-progression" hidden={tab !== "progression"}>
          <UnlockInOrderToggle checked={unlockInOrder} onChange={setUnlockInOrder} tier={unlockTier} onTierChange={setUnlockTier} />
        </div>
      )}

      <div className="flex justify-end"><Button type="submit">Save changes</Button></div>
    </form>
  );
}

function FolderFields({ folder, onSave }: { folder: Folder; onSave: (fields: { name: string; color: string }) => void }) {
  const [name, setName] = useState(folder.name);
  const [color, setColor] = useState(folder.color);
  return (
    <form className="mt-5 flex flex-wrap items-end gap-4" onSubmit={(event) => { event.preventDefault(); onSave({ name, color }); }}>
      <label className="form-label min-w-48 flex-1">Name<input className="form-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
      <label className="gradient-control">Color<input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Folder color" /></label>
      <Button type="submit">Save changes</Button>
    </form>
  );
}

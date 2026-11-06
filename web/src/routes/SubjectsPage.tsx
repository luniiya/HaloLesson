import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { IconEye, IconPencil } from "@tabler/icons-react";
import { libraryStates, type Library, type Subject, type SubjectType } from "@halolesson/shared";
import { useLibraryEvents } from "$lib/events";
import { libraryApi, type Entry } from "$lib/library";
import AddMenu from "../components/AddMenu";
import Button from "../components/Button";
import ConfirmDialog from "../components/ConfirmDialog";
import CreateSubjectForm from "../components/CreateSubjectForm";
import BookArtwork from "../components/BookArtwork";
import LevelDialog from "../components/LevelDialog";
import LibraryItemDialog from "../components/LibraryItemDialog";
import LibraryOrbit from "../components/LibraryOrbit";
import { layoutOrbit, openChainTo } from "../components/OrbitView";

export default function SubjectsPage() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState<SubjectType | null>(null);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [naming, setNaming] = useState(false);
  const [rating, setRating] = useState<Subject | null>(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const load = useCallback(() => {
    libraryApi.get().then(setLibrary).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load subjects"));
  }, []);
  useEffect(load, [load]);
  useLibraryEvents(() => libraryApi.get().then(setLibrary).catch(() => {}));

  const states = library ? libraryStates(library) : null;

  // Folders opened in place on the orbit (both in and out of Edit mode), kept
  // in the URL so Back returns to them.
  const open = params.get("open")?.split(",").filter(Boolean) ?? [];
  function setOpen(ids: string[]) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (ids.length) next.set("open", ids.join(","));
      else next.delete("open");
      return next;
    }, { replace: true });
  }
  // New subjects and folders go into the innermost open folder.
  const chain = library ? layoutOrbit(library, open).chain : [];
  const folderId = chain.at(-1) ?? null;
  const folder = library?.folders.find((item) => item.id === folderId) ?? null;

  const subjects = library && states ? library.subjects.filter((subject) => states.get(subject.id) === "active") : [];
  const skillCount = subjects.reduce((total, subject) => total + subject.skillCount, 0);
  const everythingGone = !library || !states || ![...states.values()].some((state) => state === "active");

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 pb-28 pt-8 sm:px-8 md:pb-8 md:pt-10 lg:px-10">
      {/* Add is out of the flow, pinned to the mode button: beside it when the
          header has room, below it otherwise, so it never wraps the title or
          pushes the orbit down. */}
      <header className="@container mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[2rem] font-black leading-tight tracking-tight sm:text-4xl">What will you level up?</h1>
        {(editing || !everythingGone) && (
          <div className="relative shrink-0 self-end sm:self-auto">
            <button type="button" className={`button mode-button ${editing ? "mode-button-editing" : ""}`} aria-pressed={editing} title={editing ? "Back to viewing" : "Edit your library"}
              onClick={() => { setEditing(!editing); setCreating(null); }}>
              {editing ? <IconPencil className="mr-2" size={20} stroke={2.5} aria-hidden="true" /> : <IconEye className="mr-2" size={20} stroke={2.5} aria-hidden="true" />}
              {editing ? "Editing" : "Viewing"}
            </button>
            {editing && (
              <div className="absolute right-0 top-full z-30 mt-3 @4xl:right-full @4xl:top-0 @4xl:mr-3 @4xl:mt-0">
                <AddMenu onChoose={(choice) => (choice === "folder" ? setNaming(true) : setCreating(choice))} />
              </div>
            )}
          </div>
        )}
      </header>

      {error && <p role="alert" className="notice-error mb-4">{error}</p>}
      {!library && !error && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading subjects">
          {[0, 1, 2].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl bg-eel" />)}
        </div>
      )}

      {library && !editing && everythingGone && (
        <section className="relative overflow-hidden rounded-3xl border-2 border-swan bg-accent-pale/20 px-6 py-10 text-center sm:py-12">
          <BookArtwork className="mx-auto w-52" />
          <span className="mt-2 inline-block rounded-full bg-accent-pale px-3 py-1 text-xs font-black uppercase tracking-wider text-accent-deep">A fresh start</span>
          <h2 className="mt-4 text-3xl font-black tracking-tight">Build your first practice path</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] font-semibold leading-6 text-wolf">Start with something you’re studying. We’ll turn it into skills you can practice whenever they get rusty.</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button onClick={() => setCreating("subject")}>Create my first subject</Button>
            <Button variant="secondary" onClick={() => setCreating("tracker")}>Track something instead</Button>
          </div>
        </section>
      )}

      {library && (editing || !everythingGone) && (
        <section aria-labelledby="practice-paths-title" className="flex flex-1 flex-col overflow-x-clip">
          <h2 id="practice-paths-title" className="sr-only">Your practice paths</h2>
          <div className="flex flex-1 items-center">
            <LibraryOrbit
              library={library}
              open={open}
              onOpenChange={setOpen}
              editing={editing}
              onEdit={setSelected}
              onRate={setRating}
              onChanged={load}
              onError={setError}
              decorations={<>
                <span className="orbit-speck left-[18%] top-[29%]" aria-hidden="true" />
                <span className="orbit-speck bottom-[23%] right-[17%] bg-secondary/50" aria-hidden="true" />
              </>}
              center={<BookArtwork className="w-40 sm:w-48" />}
            />
          </div>
          <p className="mt-6 text-center text-xs font-extrabold uppercase tracking-wider text-wolf">
            {editing
              ? "Click to customize · + opens a folder · drag to reorder · drop on a folder, Archive or Trash"
              : <>{subjects.length} {subjects.length === 1 ? "subject" : "subjects"}<span className="mx-2 text-swan">•</span>{skillCount} {skillCount === 1 ? "skill" : "skills"}</>}
          </p>
        </section>
      )}

      {library && selected && (
        <LibraryItemDialog key={selected.item.id} entry={selected} library={library} onOpenFolder={(id) => setOpen(openChainTo(library, id))} onChanged={load} onClose={() => setSelected(null)} />
      )}
      {creating && (
        <CreateSubjectForm
          key={creating}
          type={creating}
          folderId={folderId}
          onCancel={() => setCreating(null)}
          onCreated={(subject) => {
            setCreating(null);
            if (editing) load();
            else navigate(`/subjects/${subject.id}`);
          }}
        />
      )}
      {rating && <LevelDialog key={rating.id} subject={rating} onChanged={load} onClose={() => setRating(null)} />}
      {naming && (
        <ConfirmDialog title="New folder" confirmLabel="Create folder" input={{ label: "Folder name", placeholder: "e.g. Languages" }} onConfirm={async (name) => { await libraryApi.createFolder(name, folderId); load(); }} onClose={() => setNaming(false)}>
          {folder ? <>It goes inside <b>{folder.name}</b>. Drag subjects onto it to fill it.</> : "Drag subjects onto it to fill it."}
        </ConfirmDialog>
      )}
    </div>
  );
}

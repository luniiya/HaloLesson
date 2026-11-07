import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { APP_VERSION, EXPORT_FORMAT_VERSION, type ExportFile, type ExportSkill, type ExportSubject } from "@halolesson/shared";

// The .halolesson file: a zip holding the export split into small JSON files, one
// per subject, unit and skill, so it diffs well and stays readable by hand.
//
//   manifest.json                         format, kind, app version, subject order
//   library.json                          folders and placement (backups only)
//   subjects/<slug>-<id>/subject.json     name, colors, icon, type
//   subjects/<slug>-<id>/personal.json    level, notes, progress, answers (backups only)
//   subjects/<slug>-<id>/units/01-<slug>/unit.json
//   subjects/<slug>-<id>/units/01-<slug>/skills/01-<slug>.json   skill, its links and exercises
//   media/                                reserved for exercise images and audio
//
// Reading turns it back into the ExportFile JSON shape, which parseImport validates.

// Zip bombs: refuse archives that unpack to more than this.
const MAX_UNPACKED_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 50_000;

const README = `This is a haloLesson file. Import it in haloLesson: Settings > Data > Import.

It is a zip of plain JSON files: manifest.json describes the file, each folder
under subjects/ is one subject or tracker, with one file per unit and per skill.
`;

function slug(value: string) {
  const ascii = value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  return ascii || "item";
}

const pad = (index: number) => String(index + 1).padStart(2, "0");
const json = (value: unknown) => strToU8(`${JSON.stringify(value, null, 2)}\n`);

export function toHalolesson(file: ExportFile): Uint8Array {
  const files: Zippable = { "README.txt": strToU8(README) };
  const used = new Set<string>();
  const dirs: string[] = [];
  const placement: Record<string, { folder: number | null; position: number; archivedAt: string | null }> = {};

  file.subjects.forEach((subject, index) => {
    const base = `${slug(subject.name)}-${(subject.id ?? String(index)).replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || index}`;
    let name = base;
    for (let n = 2; used.has(name); n += 1) name = `${base}-${n}`;
    used.add(name);
    const dir = `subjects/${name}`;
    dirs.push(name);
    files[`${dir}/subject.json`] = json({
      id: subject.id, type: subject.type ?? "subject", name: subject.name, description: subject.description,
      color: subject.color, gradientStart: subject.gradientStart, gradientEnd: subject.gradientEnd, icon: subject.icon ?? null,
      unlockInOrder: subject.unlockInOrder ?? false,
      unlockTier: subject.unlockTier ?? "easy",
    });
    if (file.kind === "backup") {
      placement[name] = { folder: subject.folder ?? null, position: subject.position ?? index, archivedAt: subject.archivedAt ?? null };
      const progress: Record<string, ExportSkill["progress"]> = {};
      const attempts: Record<string, unknown> = {};
      for (const skill of subject.units.flatMap((unit) => unit.skills)) {
        if (skill.id && skill.progress) progress[skill.id] = skill.progress;
        for (const exercise of skill.exercises) if (exercise.id && exercise.attempts?.length) attempts[exercise.id] = exercise.attempts;
      }
      files[`${dir}/personal.json`] = json({ level: subject.level ?? null, notes: subject.notes ?? "", levelHistory: subject.levelHistory ?? [], progress, attempts });
    }
    subject.units.forEach((unit, unitIndex) => {
      const unitDir = `${dir}/units/${pad(unitIndex)}-${slug(unit.title)}`;
      files[`${unitDir}/unit.json`] = json({ id: unit.id, title: unit.title, description: unit.description });
      unit.skills.forEach((skill, skillIndex) => {
        files[`${unitDir}/skills/${pad(skillIndex)}-${slug(skill.title)}.json`] = json({
          id: skill.id,
          title: skill.title,
          description: skill.description,
          ...(skill.start ? { start: true } : {}),
          ...(skill.links?.length ? { links: skill.links } : {}),
          sessionSize: skill.sessionSize,
          hearts: skill.hearts,
          exercises: skill.exercises.map(({ attempts: _attempts, ...exercise }) => exercise),
        });
      });
    });
  });

  files["manifest.json"] = json({
    format: "halolesson",
    formatVersion: EXPORT_FORMAT_VERSION,
    kind: file.kind ?? "share",
    exportedAt: file.exportedAt,
    appVersion: APP_VERSION,
    subjects: dirs,
  });
  if (file.kind === "backup") files["library.json"] = json({ folders: file.folders ?? [], placement });
  return zipSync(files, { level: 6 });
}

export const isZip = (bytes: Uint8Array) => bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

function readJson(files: Record<string, Uint8Array>, path: string, required = true): Record<string, unknown> | null {
  const data = files[path];
  if (!data) {
    if (required) throw new Error(`The file is missing ${path}`);
    return null;
  }
  try {
    const value = JSON.parse(strFromU8(data)) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new Error(`${path} isn't valid JSON`);
  }
}

// Paths directly under `dir` matching `name`, sorted (the 01-, 02- prefixes keep order).
function children(paths: string[], dir: string, pattern: RegExp) {
  return paths.filter((path) => path.startsWith(`${dir}/`) && pattern.test(path.slice(dir.length + 1))).sort();
}

// An upload is a .halolesson zip or a JSON export (format 1 or 2). Returns the
// ExportFile-shaped JSON for parseImport; nothing is validated here beyond structure.
export function readUpload(bytes: Uint8Array): unknown {
  if (!isZip(bytes)) {
    try {
      return JSON.parse(strFromU8(bytes)) as unknown;
    } catch {
      throw new Error("This isn't a haloLesson file (.halolesson or .json)");
    }
  }
  let size = 0;
  let count = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (entry) => {
        size += entry.originalSize;
        count += 1;
        if (size > MAX_UNPACKED_BYTES || count > MAX_FILES) throw new Error("too big");
        return !entry.name.endsWith("/") && !entry.name.startsWith("media/");
      },
    });
  } catch (error) {
    throw new Error(error instanceof Error && error.message === "too big" ? "This file unpacks to more than 100 MB" : "This .halolesson file is damaged and can't be opened");
  }
  const manifest = readJson(files, "manifest.json")!;
  const paths = Object.keys(files);
  const library = readJson(files, "library.json", false);
  const placement = (library?.placement ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const dirs = Array.isArray(manifest.subjects) ? manifest.subjects.filter((dir): dir is string => typeof dir === "string") : [];

  const subjects = dirs.map((name) => {
    const dir = `subjects/${name}`;
    const subject = readJson(files, `${dir}/subject.json`)!;
    const personal = readJson(files, `${dir}/personal.json`, false);
    const progress = (personal?.progress ?? {}) as Record<string, unknown>;
    const attempts = (personal?.attempts ?? {}) as Record<string, unknown>;
    const units = children(paths, `${dir}/units`, /^[^/]+\/unit\.json$/).map((unitPath) => {
      const unitDir = unitPath.slice(0, -"/unit.json".length);
      const unit = readJson(files, unitPath)!;
      const skills = children(paths, `${unitDir}/skills`, /^[^/]+\.json$/).map((skillPath) => {
        const skill = readJson(files, skillPath)!;
        const exercises = Array.isArray(skill.exercises) ? skill.exercises : [];
        return {
          ...skill,
          progress: typeof skill.id === "string" ? progress[skill.id] : undefined,
          exercises: exercises.map((exercise) => {
            const id = (exercise as Record<string, unknown> | null)?.id;
            return typeof id === "string" && attempts[id] ? { ...(exercise as object), attempts: attempts[id] } : exercise;
          }),
        };
      });
      return { ...unit, skills };
    });
    return {
      ...subject,
      ...(personal ? { level: personal.level, notes: personal.notes, levelHistory: personal.levelHistory } : {}),
      ...(placement[name] ?? {}),
      units,
    } as unknown as ExportSubject;
  });

  return {
    format: manifest.format,
    formatVersion: manifest.formatVersion,
    kind: manifest.kind,
    exportedAt: manifest.exportedAt,
    folders: library?.folders ?? [],
    subjects,
  };
}

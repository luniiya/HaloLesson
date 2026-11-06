import type { Icon } from "@tabler/icons-react";
import { IconAtom, IconBook, IconBulb, IconCode, IconFlask, IconHeartbeat, IconLanguage, IconMathFunction, IconMusic, IconPalette, IconRocket, IconWorld } from "@tabler/icons-react";
import { SUBJECT_ICONS, type Subject, type SubjectIcon } from "@halolesson/shared";

export const subjectIcons: Record<SubjectIcon, Icon> = {
  atom: IconAtom,
  world: IconWorld,
  math: IconMathFunction,
  flask: IconFlask,
  code: IconCode,
  palette: IconPalette,
  book: IconBook,
  music: IconMusic,
  language: IconLanguage,
  heart: IconHeartbeat,
  rocket: IconRocket,
  bulb: IconBulb,
};

// Subjects without a chosen icon keep a stable default derived from their id.
export function iconFor(subject: Pick<Subject, "id" | "icon">): Icon {
  if (subject.icon) return subjectIcons[subject.icon];
  const hash = [...subject.id].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 7);
  return subjectIcons[SUBJECT_ICONS[hash % 6]!];
}

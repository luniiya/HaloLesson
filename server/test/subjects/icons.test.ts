import { expect, test } from "bun:test";
import { SUBJECT_ICONS, isSubjectIcon } from "@halolesson/shared";

test("the original icon ids stay valid", () => {
  for (const id of ["atom", "world", "math", "flask", "code", "palette", "book", "music", "language", "heart", "rocket", "bulb"]) {
    expect(isSubjectIcon(id)).toBe(true);
  }
});

test("icon ids are unique kebab-case", () => {
  expect(new Set(SUBJECT_ICONS).size).toBe(SUBJECT_ICONS.length);
  for (const id of SUBJECT_ICONS) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  expect(isSubjectIcon("nonsense")).toBe(false);
});

import { describe, expect, test } from "bun:test";
import { db } from "../../src/db";
import { importSubjects } from "../../src/dataExport";
import { copySharedSubject, createShareLink, getShareLink, getSharedSubject, revokeShareLink } from "../../src/shares";
import { getSubject } from "../../src/subjects";
import { makeUser } from "../helpers";

function makeSubject(userId: string) {
  return importSubjects(userId, [{
    name: "Maths",
    description: "Numbers",
    color: "green",
    gradientStart: "#58cc02",
    gradientEnd: "#1cb0f6",
    units: [{
      title: "Fractions",
      description: "",
      skills: [{
        title: "Halves",
        description: "Split in two",
        exercises: [{ type: "free_text", prompt: "1/2 of 4?", answers: ["2"], explanation: "" }],
        progress: { tiersCleared: 2, expertClearedAt: null, mastery: 0.6, correctAttempts: 3, totalAttempts: 4, lastPracticedAt: null },
      }],
    }],
  }]).subjects[0]!;
}

describe("share links", () => {
  test("creating twice reuses the link, and only the owner can manage it", () => {
    const owner = makeUser();
    const other = makeUser();
    const subject = makeSubject(owner.id);
    expect(getShareLink(owner.id, subject.id)).toBeNull();
    const link = createShareLink(owner.id, subject.id);
    expect(createShareLink(owner.id, subject.id).token).toBe(link.token);
    expect(() => createShareLink(other.id, subject.id)).toThrow("Subject not found");
    expect(() => revokeShareLink(other.id, subject.id)).toThrow("Subject not found");
  });

  test("the preview shows the latest outline without answers", () => {
    const owner = makeUser();
    const viewer = makeUser();
    const subject = makeSubject(owner.id);
    const { token } = createShareLink(owner.id, subject.id);
    db.run("UPDATE subjects SET name = 'Maths 2' WHERE id = ?", [subject.id]);
    const shared = getSharedSubject(viewer.id, token);
    expect(shared.owner).toBe(owner.username);
    expect(shared.isOwner).toBe(false);
    expect(getSharedSubject(owner.id, token).isOwner).toBe(true);
    expect(shared.subject.name).toBe("Maths 2");
    expect(shared.units[0]!.skills[0]).toEqual({ title: "Halves", description: "Split in two", exerciseCount: 1 });
    expect(JSON.stringify(shared)).not.toContain("1/2 of 4?");
  });

  test("copying creates an independent subject without the owner's progress", () => {
    const owner = makeUser();
    const viewer = makeUser();
    const subject = makeSubject(owner.id);
    const { token } = createShareLink(owner.id, subject.id);
    const copy = copySharedSubject(viewer.id, token);
    expect(copy.id).not.toBe(subject.id);
    expect(copy.skillCount).toBe(1);
    const skill = getSubject(viewer.id, copy.id).units[0]!.skills[0]!;
    expect(skill.mastery).toBe(0);
  });

  test("revoking or deleting the subject kills the link", () => {
    const owner = makeUser();
    const viewer = makeUser();
    const subject = makeSubject(owner.id);
    const first = createShareLink(owner.id, subject.id);
    revokeShareLink(owner.id, subject.id);
    expect(() => getSharedSubject(viewer.id, first.token)).toThrow("Share link not found");
    expect(() => copySharedSubject(viewer.id, first.token)).toThrow("Share link not found");
    const second = createShareLink(owner.id, subject.id);
    expect(second.token).not.toBe(first.token);
    db.run("DELETE FROM subjects WHERE id = ?", [subject.id]);
    expect(() => getSharedSubject(viewer.id, second.token)).toThrow("Share link not found");
  });
});

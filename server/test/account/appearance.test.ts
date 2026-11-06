import { describe, expect, test } from "bun:test";
import { updateAccount } from "../../src/auth";
import { makeUser } from "../helpers";

describe("accent color", () => {
  test("starts unset, saves lowercased without a password, and resets to null", async () => {
    const user = makeUser();
    expect(user.accentColor).toBeNull();
    expect((await updateAccount(user.id, null, { accentColor: "#12B5A5" })).accentColor).toBe("#12b5a5");
    expect((await updateAccount(user.id, null, { accentColor: null })).accentColor).toBeNull();
  });

  test("rejects anything but a 6-digit hex color", async () => {
    const user = makeUser();
    for (const color of ["red", "#fff", "12b5a5", "#12b5a5; background: red", ""]) {
      await expect(updateAccount(user.id, null, { accentColor: color })).rejects.toThrow("Accent color must be a hex color");
    }
  });
});

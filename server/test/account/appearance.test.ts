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

  test("the secondary color saves and resets on its own, with the same rules", async () => {
    const user = makeUser();
    expect(user.secondaryColor).toBeNull();
    const updated = await updateAccount(user.id, null, { secondaryColor: "#EC4F9A" });
    expect(updated).toMatchObject({ secondaryColor: "#ec4f9a", accentColor: null });
    expect((await updateAccount(user.id, null, { secondaryColor: null })).secondaryColor).toBeNull();
    await expect(updateAccount(user.id, null, { secondaryColor: "pink" })).rejects.toThrow("Secondary color must be a hex color");
  });

  test("rejects anything but a 6-digit hex color", async () => {
    const user = makeUser();
    for (const color of ["red", "#fff", "12b5a5", "#12b5a5; background: red", ""]) {
      await expect(updateAccount(user.id, null, { accentColor: color })).rejects.toThrow("Accent color must be a hex color");
    }
  });
});

import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { login } from "../../src/auth";

// Unknown usernames skip password hashing, so these stay fast.
const fail = (name: string) => login(name, "wrong", null);

describe("login lockout", () => {
  afterEach(() => setSystemTime());

  test("locks after 10 failures, then a wrong password after the lock expires gets a fresh count", async () => {
    const name = `ghost_${crypto.randomUUID()}`;
    for (let i = 0; i < 10; i++) await expect(fail(name)).rejects.toThrow("Invalid username/email or password");
    await expect(fail(name)).rejects.toThrow("Try again in 5 minutes");

    setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
    await expect(fail(name)).rejects.toThrow("Invalid username/email or password");
    await expect(fail(name)).rejects.toThrow("Invalid username/email or password");
  });
});

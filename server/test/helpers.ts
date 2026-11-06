import type { User } from "@halolesson/shared";
import { toUser, type UserRow } from "../src/auth";
import { db } from "../src/db";

let counter = 0;

// Inserts a user directly, skipping password hashing so tests stay fast.
export function makeUser(): User {
  counter += 1;
  const id = crypto.randomUUID();
  const username = `user${counter}_${id.slice(0, 6)}`;
  db.run("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)", [id, username, "x", new Date().toISOString()]);
  return toUser(db.query<UserRow, [string]>("SELECT * FROM users WHERE id = ?").get(id)!);
}

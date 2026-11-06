import type { Settings } from "@halolesson/shared";
import { db } from "./db";

interface SettingsRow {
  signup_enabled: number;
  require_strong_passwords: number;
  require_email: number;
}

export function getSettings(): Settings {
  const row = db.query<SettingsRow, []>("SELECT * FROM settings WHERE id = 1").get();
  return {
    signupEnabled: row ? row.signup_enabled === 1 : true,
    requireStrongPasswords: row ? row.require_strong_passwords === 1 : true,
    requireEmail: row ? row.require_email === 1 : false,
  };
}

export function updateSettings(updates: Partial<Settings>): Settings {
  const columns = {
    signupEnabled: "signup_enabled",
    requireStrongPasswords: "require_strong_passwords",
    requireEmail: "require_email",
  } as const;
  for (const key of Object.keys(columns) as Array<keyof Settings>) {
    const value = updates[key];
    if (typeof value === "boolean") db.run(`UPDATE settings SET ${columns[key]} = ? WHERE id = 1`, [value ? 1 : 0]);
  }
  return getSettings();
}

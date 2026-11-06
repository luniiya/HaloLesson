import { DEFAULT_ACCENT, isValidAccent } from "@halolesson/shared";

const STORAGE_KEY = "halolesson:accent";

// The last accent used on this device, so the login page and first paint match
// before /api/auth/me answers.
export function cachedAccent(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidAccent(stored)) return stored;
  } catch {}
  return DEFAULT_ACCENT;
}

export function applyAccent(color: string | null) {
  const accent = color && isValidAccent(color) ? color : DEFAULT_ACCENT;
  document.documentElement.style.setProperty("--accent", accent);
  try {
    localStorage.setItem(STORAGE_KEY, accent);
  } catch {}
}

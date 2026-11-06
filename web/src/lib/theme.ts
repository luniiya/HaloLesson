import { useSyncExternalStore } from "react";
import { DEFAULT_ACCENT, DEFAULT_SECONDARY, isValidAccent } from "@halolesson/shared";

// The user's two colors: the accent (buttons, logo, book) and the secondary
// (selected and active states). Each is a CSS variable on <html>.
const COLORS = {
  accent: { variable: "--accent", key: "halolesson:accent", fallback: DEFAULT_ACCENT },
  secondary: { variable: "--secondary", key: "halolesson:secondary", fallback: DEFAULT_SECONDARY },
};
type ColorRole = keyof typeof COLORS;

// The last colors used on this device, so the login page and first paint match
// before /api/auth/me answers.
function cached(role: ColorRole): string {
  try {
    const stored = localStorage.getItem(COLORS[role].key);
    if (stored && isValidAccent(stored)) return stored;
  } catch {}
  return COLORS[role].fallback;
}

function apply(role: ColorRole, color: string | null) {
  const { variable, key, fallback } = COLORS[role];
  const value = color && isValidAccent(color) ? color : fallback;
  document.documentElement.style.setProperty(variable, value);
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export const cachedAccent = () => cached("accent");
export const cachedSecondary = () => cached("secondary");
export const applyAccent = (color: string | null) => apply("accent", color);
export const applySecondary = (color: string | null) => apply("secondary", color);

export type ThemePreference = "auto" | "light" | "dark";

// Per device, like recoral: index.html reads the same key before first paint.
const THEME_KEY = "halolesson:theme";
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

function storedTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "auto";
}

let theme = storedTheme();

function applyTheme() {
  const dark = theme === "dark" || (theme === "auto" && darkQuery.matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#131f24" : "#ffffff");
}

export function initTheme() {
  applyTheme();
  darkQuery.addEventListener("change", () => {
    if (theme === "auto") applyTheme();
  });
}

export function setTheme(next: ThemePreference) {
  theme = next;
  try {
    if (next === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, next);
  } catch {}
  applyTheme();
  listeners.forEach((listener) => listener());
}

export function useTheme(): ThemePreference {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => theme,
  );
}

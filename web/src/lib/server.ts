import { useEffect, useState } from "react";
import type { Settings } from "@halolesson/shared";
import { api } from "./api";

export interface ServerInfo {
  settings: Settings;
  needsSetup: boolean;
}

export function useServerInfo(): ServerInfo | null {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([api<Settings>("/api/settings"), api<{ needsSetup: boolean }>("/api/setup-status")])
      .then(([settings, status]) => { if (active) setInfo({ settings, needsSetup: status.needsSetup }); })
      .catch(() => {
        if (active) setInfo({ settings: { signupEnabled: true, requireStrongPasswords: true, requireEmail: false }, needsSetup: false });
      });
    return () => { active = false; };
  }, []);
  return info;
}

export function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatRelative(value: string | null): string {
  if (!value) return "Never";
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 5) return "Active now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(value);
}

// Same-origin GET that triggers a browser download, keeping the server's filename.
export function download(path: string) {
  const link = document.createElement("a");
  link.href = path;
  link.download = "";
  document.body.append(link);
  link.click();
  link.remove();
}

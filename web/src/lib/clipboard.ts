// The Clipboard API needs a secure context, so plain-http LAN servers fall
// back to selecting the field. Returns whether anything was copied.
export async function copyText(text: string, fallback: HTMLInputElement | HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!fallback) return false;
    fallback.select();
    return document.execCommand("copy");
  }
}

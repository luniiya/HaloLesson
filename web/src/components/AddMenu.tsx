import { useEffect, useRef, useState } from "react";
import { IconBooks, IconFolder, IconPlus, IconTargetArrow, type Icon } from "@tabler/icons-react";
import Button from "./Button";

export type AddChoice = "subject" | "tracker" | "folder";

const CHOICES: { value: AddChoice; label: string; hint: string; Symbol: Icon; color: string; dark: string }[] = [
  { value: "subject", label: "Subject", hint: "A practice path with skills", Symbol: IconBooks, color: "#58cc02", dark: "#46a302" },
  { value: "tracker", label: "Tracker", hint: "Rate something you learn elsewhere", Symbol: IconTargetArrow, color: "#ff9600", dark: "#cc7a00" },
  { value: "folder", label: "Folder", hint: "Group subjects and trackers", Symbol: IconFolder, color: "#1cb0f6", dark: "#1899d6" },
];

// The page's one Add button: opens a small menu to pick what to create.
export default function AddMenu({ onChoose }: { onChoose: (choice: AddChoice) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button variant="secondary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <IconPlus className="mr-2" size={20} stroke={2.5} />Add
      </Button>
      {open && (
        <div className="add-menu" role="menu">
          {CHOICES.map(({ value, label, hint, Symbol, color, dark }) => (
            <button key={value} type="button" role="menuitem" className="add-menu-item" onClick={() => { setOpen(false); onChoose(value); }}>
              <span className="add-menu-icon" style={{ background: color, boxShadow: `0 3px 0 ${dark}` }} aria-hidden="true"><Symbol size={24} stroke={2.4} /></span>
              <span className="min-w-0">
                <span className="block text-base font-black text-ink">{label}</span>
                <span className="block text-xs font-bold text-wolf">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

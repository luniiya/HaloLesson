import { useId, useMemo, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import type { SubjectIcon } from "@halolesson/shared";
import { SUBJECT_ICON_INFO, autoIcon, iconLabel, searchIcons, subjectIcons } from "$lib/subjectIcons";

interface IconPickerProps {
  // null means Auto: the icon is picked from the subject's name.
  value: SubjectIcon | null;
  onChange: (icon: SubjectIcon | null) => void;
  name: string;
  description?: string;
}

export default function IconPicker({ value, onChange, name, description }: IconPickerProps) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const autoChoice = autoIcon(name, description);
  const AutoSymbol = subjectIcons[autoChoice];
  const results = useMemo(() => (query.trim() ? searchIcons(query) : SUBJECT_ICON_INFO), [query]);

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 text-sm font-extrabold text-wolf">Icon</legend>
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={`icon-auto ${value === null ? "icon-auto-selected" : ""}`}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-swan bg-surface text-ink"><AutoSymbol size={24} stroke={2.4} /></span>
        <span className="min-w-0">
          <span className="block text-sm font-black uppercase tracking-wide text-ink">Auto</span>
          <span className="block truncate text-xs font-bold text-wolf">{name.trim() ? `Picked from the name: ${iconLabel(autoChoice)}` : "Picked from the name"}</span>
        </span>
      </button>
      <div className="relative">
        <label htmlFor={searchId} className="sr-only">Search icons</label>
        <IconSearch size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hare" aria-hidden />
        <input id={searchId} type="search" className="form-input !py-2 pl-10" placeholder="Search icons, e.g. biology" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
      </div>
      {results.length === 0
        ? <p className="rounded-xl border-2 border-dashed border-swan p-4 text-center text-sm font-bold text-wolf">No icons match</p>
        : <div className="icon-picker-grid" role="radiogroup" aria-label="Icon">
            {results.map((info) => {
              const Symbol = info.Icon;
              const selected = value === info.id;
              return (
                <button key={info.id} type="button" role="radio" aria-checked={selected} aria-label={info.label} title={info.label} onClick={() => onChange(info.id)} className={`icon-choice ${selected ? "icon-choice-selected" : ""}`}>
                  <Symbol size={22} stroke={2.4} />
                </button>
              );
            })}
          </div>}
    </fieldset>
  );
}

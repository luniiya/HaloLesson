// The "unlock skills in order" subject setting, shared by the subject dialog and the map's edit bar.
export default function UnlockInOrderToggle({ checked, onChange, className = "", disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; className?: string; disabled?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl bg-eel p-3 ${className}`}>
      <input type="checkbox" role="switch" className="mt-0.5 size-5 shrink-0 accent-[var(--color-secondary)]" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className="block text-sm font-extrabold text-ink">Unlock skills in order</span>
        <span className="block text-xs font-semibold leading-5 text-wolf">Skills stay locked until you finish a skill linked to them. You begin at the start skills.</span>
      </span>
    </label>
  );
}

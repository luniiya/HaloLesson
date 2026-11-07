import { TIER_LABELS, TIERS, type Tier } from "@halolesson/shared";

// The "unlock skills in order" subject setting and the tier a skill must
// clear to open its links, shared by the subject dialog and the map's edit bar.
export default function UnlockInOrderToggle({ checked, onChange, tier, onTierChange, className = "", disabled = false }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  tier: Tier;
  onTierChange: (tier: Tier) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-3 rounded-xl bg-eel p-3 ${className}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" role="switch" className="mt-0.5 size-5 shrink-0 accent-[var(--color-secondary)]" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span>
          <span className="block text-sm font-extrabold text-ink">Unlock skills in order</span>
          <span className="block text-xs font-semibold leading-5 text-wolf">Skills stay locked until you finish a skill linked to them. You begin at the start skills.</span>
        </span>
      </label>
      {checked && (
        <label className="form-label pl-8">A skill is finished once you clear
          <select className="form-input py-2" value={tier} disabled={disabled} onChange={(event) => onTierChange(event.target.value as Tier)}>
            {TIERS.map((option) => <option key={option} value={option}>{TIER_LABELS[option]}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

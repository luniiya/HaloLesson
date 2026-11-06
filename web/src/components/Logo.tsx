import { Link } from "react-router";

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
      <svg viewBox="0 0 48 48" className="size-10 shrink-0" aria-hidden="true">
        <circle cx="24" cy="24" r="23" fill="var(--accent)" />
        <ellipse cx="24" cy="13" rx="15" ry="4.5" fill="none" stroke="white" strokeWidth="3.5" />
        <path d="M14 23v12m20-12v12M14 29c6-7 14-7 20 0" fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
      </svg>
      {!compact && <span className="text-2xl font-black tracking-tight text-accent">haloLesson</span>}
    </Link>
  );
}

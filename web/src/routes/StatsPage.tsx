import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { IconBolt, IconCalendarCheck, IconClock, IconCrown, IconFlame, IconStarFilled, IconTarget, IconTrendingUp, IconTrophy, type Icon } from "@tabler/icons-react";
import { LEVEL_LABELS, libraryStates, STATS_RANGES, type Library, type Stats, type StatsDay, type Subject } from "@halolesson/shared";
import { api } from "$lib/api";
import { useLibraryEvents } from "$lib/events";
import { libraryApi } from "$lib/library";
import { formatDate } from "$lib/server";
import { iconFor } from "$lib/subjectIcons";
import { ActivityCalendar, CategoryColumns, ChartCard, LevelSteps, shortDate, StackedColumns, TrendLine, type LevelPoint } from "../components/charts";
import { subjectColors } from "../components/SubjectNode";

const RANGES: Array<{ value: string; label: string }> = [
  ...STATS_RANGES.map((days) => ({ value: String(days), label: days === 365 ? "Year" : `${days} days` })),
  { value: "all", label: "All time" },
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ACCENT = "var(--color-accent)";
const MISSED = "var(--color-hare)";
const GOLD = "var(--chart-gold)";
// Past this many days the activity chart groups days into weeks.
const WEEKLY_AFTER = 120;

interface Bucket { start: string; end: string; answered: number; correct: number; timeMs: number; mastery: number }

function buckets(daily: StatsDay[]): Bucket[] {
  if (daily.length <= WEEKLY_AFTER) return daily.map((day) => ({ ...day, start: day.date, end: day.date }));
  const weeks: Bucket[] = [];
  daily.forEach((day, index) => {
    if (index % 7 === 0) weeks.push({ start: day.date, end: day.date, answered: 0, correct: 0, timeMs: 0, mastery: 0 });
    const week = weeks.at(-1)!;
    week.end = day.date;
    week.answered += day.answered;
    week.correct += day.correct;
    week.timeMs += day.timeMs;
    week.mastery = day.mastery;
  });
  return weeks;
}

const bucketLabel = (bucket: Bucket, short: boolean) =>
  bucket.start === bucket.end || short ? shortDate(bucket.start) : `${shortDate(bucket.start)} – ${shortDate(bucket.end)}`;

export function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (ms > 0 && minutes === 0) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
const accuracy = (correct: number, answered: number) => (answered ? percent(correct / answered) : "–");
const levelText = (level: number | null) => (level === null ? "Not rated" : `Lv ${level} · ${LEVEL_LABELS[level]}`);

function ago(value: string | null) {
  if (!value) return "Never";
  const days = Math.floor((Date.now() - Date.parse(value)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(value);
}

function StatTile({ Symbol, color, value, label }: { Symbol: Icon | null; color: string; value: ReactNode; label: string }) {
  return (
    <div className="stat-tile">
      {Symbol
        ? <Symbol className="size-8 shrink-0" style={{ color }} stroke={2.4} aria-hidden="true" />
        : <span className="grid size-8 shrink-0 place-items-center rounded-full bg-bee text-[11px] font-black text-white shadow-[0_2px_0_#d99a00]" aria-hidden="true">Lv</span>}
      <div className="min-w-0">
        <p className="stat-tile-value">{value}</p>
        <p className="stat-tile-label">{label}</p>
      </div>
    </div>
  );
}

// A thin meter: the track is a pale step of the fill's own hue.
function Meter({ value, color }: { value: number; color: string }) {
  return (
    <span className="relative block h-2 w-full overflow-hidden rounded-full" style={{ background: `color-mix(in oklab, ${color} 18%, var(--color-surface))` }} aria-hidden="true">
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </span>
  );
}

function ItemBadge({ subject }: { subject: Pick<Subject, "id" | "icon" | "name" | "color" | "gradientStart"> }) {
  const Symbol = iconFor(subject);
  const { color, dark } = subjectColors(subject);
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full text-white" style={{ background: color, boxShadow: `0 3px 0 ${dark}` }} aria-hidden="true">
      <Symbol size={19} stroke={2.4} />
    </span>
  );
}

// Every item's rating now, with a line back to where it stood when the range began.
function LevelDumbbells({ stats, subjects }: { stats: Stats; subjects: Map<string, Subject> }) {
  const rows = [...stats.items].sort((a, b) => (b.level ?? -1) - (a.level ?? -1) || a.name.localeCompare(b.name));
  const x = (level: number) => `${(level / 10) * 100}%`;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((item) => {
        const subject = subjects.get(item.id);
        const start = item.levelAtStart;
        const change = item.level !== null && start !== null ? item.level - start : null;
        return (
          <li key={item.id} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_7rem]">
            <span className="flex min-w-0 items-center gap-2">
              {subject && <ItemBadge subject={subject} />}
              <span className="truncate text-sm font-extrabold">{item.name}</span>
            </span>
            <span className="relative h-6">
              <span className="absolute inset-x-0 top-1/2 h-px bg-swan" aria-hidden="true" />
              {[0, 5, 10].map((tick) => <span key={tick} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-swan" style={{ left: x(tick) }} aria-hidden="true" />)}
              {item.level !== null && start !== null && start !== item.level && (
                <>
                  <span className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full" style={{ left: x(Math.min(start, item.level)), width: `${(Math.abs(item.level - start) / 10) * 100}%`, background: GOLD }} aria-hidden="true" />
                  <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-hare ring-2 ring-surface" style={{ left: x(start) }} title={`Lv ${start} when the range began`} />
                </>
              )}
              {item.level !== null && <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface" style={{ left: x(item.level), background: GOLD }} title={levelText(item.level)} />}
            </span>
            <span className="text-right text-xs font-extrabold text-wolf">
              {item.level === null ? "Not rated" : <><strong className="text-sm font-black text-ink">Lv {item.level}</strong>{change ? <span className="ml-1">{change > 0 ? `+${change}` : change}</span> : null}</>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Stars({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((index) => <IconStarFilled key={index} size={14} className={index < count ? "text-bee" : "text-swan"} aria-hidden="true" />)}
    </span>
  );
}

export default function StatsPage() {
  const [params, setParams] = useSearchParams();
  const scope = params.get("scope") ?? "";
  const range = params.get("range") ?? "30";
  const [library, setLibrary] = useState<Library | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => { libraryApi.get().then(setLibrary).catch(() => {}); }, [reload]);
  useLibraryEvents(() => setReload((value) => value + 1));

  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({ days: range, tzOffset: String(new Date().getTimezoneOffset()) });
    if (scope) query.set("subjectId", scope);
    api<Stats>(`/api/stats?${query}`)
      .then((next) => { if (active) { setStats(next); setError(""); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load statistics"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope, range, reload]);

  function choose(key: "scope" | "range", value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value && !(key === "range" && value === "30")) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }

  const subjects = useMemo(() => new Map((library?.subjects ?? []).map((subject) => [subject.id, subject])), [library]);
  const states = library ? libraryStates(library) : null;
  const listed = (library?.subjects ?? []).filter((subject) => states?.get(subject.id) !== "trashed").sort((a, b) => a.name.localeCompare(b.name));
  const selected = scope ? subjects.get(scope) ?? null : null;
  const isTracker = selected?.type === "tracker";

  return (
    <div className="mx-auto max-w-5xl px-5 pb-28 pt-8 sm:px-8 md:pb-10 md:pt-10 lg:px-10">
      <header className="flex flex-col gap-4">
        <h1 className="text-[2rem] font-black leading-tight tracking-tight sm:text-4xl">Statistics</h1>
        {/* One row of filters that scope everything below. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select className="form-input py-2.5 font-extrabold sm:max-w-xs" value={scope} onChange={(event) => choose("scope", event.target.value)} aria-label="Show statistics for">
            <option value="">Everything</option>
            {listed.some((subject) => subject.type === "subject") && (
              <optgroup label="Subjects">
                {listed.filter((subject) => subject.type === "subject").map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </optgroup>
            )}
            {listed.some((subject) => subject.type === "tracker") && (
              <optgroup label="Trackers">
                {listed.filter((subject) => subject.type === "tracker").map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </optgroup>
            )}
          </select>
          <div className="stats-range self-start overflow-x-auto" role="group" aria-label="Time range">
            {RANGES.map((option) => (
              <button key={option.value} type="button" className="whitespace-nowrap" aria-pressed={range === option.value} onClick={() => choose("range", option.value)}>{option.label}</button>
            ))}
          </div>
        </div>
      </header>

      {error && <p role="alert" className="notice-error mt-6">{error}</p>}
      {!stats && !error && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading statistics">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-eel" />)}
        </div>
      )}
      {/* While a new range loads, the old numbers stay, dimmed. */}
      {stats && (
        <div className={`mt-6 flex flex-col gap-5 transition-opacity ${loading ? "opacity-50" : ""}`} aria-busy={loading}>
          {isTracker && selected ? <TrackerStats stats={stats} subject={selected} /> : <PracticeStats stats={stats} subject={selected} subjects={subjects} />}
        </div>
      )}
    </div>
  );
}

function levelPoints(stats: Stats, subjectId: string): LevelPoint[] {
  return stats.levels.filter((point) => point.subjectId === subjectId).map((point) => ({ at: Date.parse(point.at), level: point.level }));
}

function rangeBounds(stats: Stats) {
  return { from: new Date(`${stats.from}T00:00:00`).getTime(), to: Date.now() };
}

function LevelCard({ stats, subject }: { stats: Stats; subject: Subject }) {
  const points = levelPoints(stats, subject.id);
  const { from, to } = rangeBounds(stats);
  return (
    <ChartCard
      title="Level over time"
      hint={subject.level === null ? "Not rated yet. Rate it from Edit mode on the Learn page." : `Now ${levelText(subject.level)}`}
      empty={points.every((point) => point.level === null) && "No rating in this range. Rate it from Edit mode on the Learn page."}
      table={{ columns: ["Date", "Level"], rows: points.map((point) => [formatDate(new Date(point.at).toISOString()), point.level === null ? "Cleared" : levelText(point.level)]) }}
    >
      <LevelSteps
        points={points} from={from} to={to} color={GOLD}
        describe={(point) => ({ title: shortDate(point.at), value: point.level === null ? "Cleared" : levelText(point.level) })}
      />
    </ChartCard>
  );
}

function TrackerStats({ stats, subject }: { stats: Stats; subject: Subject }) {
  const item = stats.items[0];
  const start = item?.levelAtStart ?? null;
  const change = subject.level !== null && start !== null ? subject.level - start : null;
  const ratings = stats.levels.filter((point) => point.subjectId === subject.id && Date.parse(point.at) >= rangeBounds(stats).from);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile Symbol={null} color={GOLD} value={subject.level === null ? "–" : `Lv ${subject.level}`} label={subject.level === null ? "Not rated" : LEVEL_LABELS[subject.level]!} />
        <StatTile Symbol={IconTrendingUp} color="#58cc02" value={change === null ? "–" : change > 0 ? `+${change}` : String(change)} label="Change in range" />
        <StatTile Symbol={IconCalendarCheck} color="var(--color-gem)" value={stats.totals.ratings} label={stats.totals.ratings === 1 ? "Rating in range" : "Ratings in range"} />
        <StatTile Symbol={IconClock} color="#1cb0f6" value={ago(stats.totals.lastActivityAt)} label="Last rated" />
      </div>
      <LevelCard stats={stats} subject={subject} />
      <ChartCard title="Rating log" hint={`Tracking since ${formatDate(subject.createdAt)}`} empty={ratings.length === 0 && "No ratings in this range."}>
        <ul className="flex flex-col">
          {[...ratings].reverse().map((point, index) => (
            <li key={index} className="flex items-center justify-between gap-3 border-t-2 border-swan py-2.5 first:border-t-0 first:pt-0">
              <span className="text-sm font-extrabold">{point.level === null ? "Rating cleared" : levelText(point.level)}</span>
              <span className="shrink-0 text-xs font-bold text-wolf">{formatDate(point.at)}</span>
            </li>
          ))}
        </ul>
      </ChartCard>
    </>
  );
}

function PracticeStats({ stats, subject, subjects }: { stats: Stats; subject: Subject | null; subjects: Map<string, Subject> }) {
  const { totals } = stats;
  const grouped = buckets(stats.daily);
  const weekly = grouped.length !== stats.daily.length;
  const nothing = totals.answered === 0;
  const empty = nothing && "No practice in this range yet. Practice a skill and it shows up here.";
  const hasLevels = stats.items.some((item) => item.level !== null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile Symbol={IconFlame} color="var(--color-streak)" value={totals.currentStreak} label="Day streak" />
        <StatTile Symbol={IconTrophy} color="var(--color-bee)" value={totals.longestStreak} label="Longest streak" />
        <StatTile Symbol={IconBolt} color="var(--color-bee)" value={totals.answered.toLocaleString()} label="Answers" />
        <StatTile Symbol={IconTarget} color="#58cc02" value={accuracy(totals.correct, totals.answered)} label="Accuracy" />
        <StatTile Symbol={IconClock} color="#1cb0f6" value={formatDuration(totals.timeMs)} label="Time practicing" />
        <StatTile Symbol={IconCalendarCheck} color="var(--color-gem)" value={totals.practiceDays} label={`of ${stats.daily.length} days practiced`} />
        <StatTile Symbol={IconCrown} color="var(--color-bee)" value={`${totals.skillsMastered}/${totals.skillCount}`} label="Skills mastered" />
        {subject
          ? <StatTile Symbol={null} color={GOLD} value={subject.level === null ? "–" : `Lv ${subject.level}`} label={subject.level === null ? "Not rated" : LEVEL_LABELS[subject.level]!} />
          : <StatTile Symbol={IconTrendingUp} color="#58cc02" value={`${totals.skillsStarted}/${totals.skillCount}`} label="Skills started" />}
      </div>

      {subject && <LevelCard stats={stats} subject={subject} />}

      <ChartCard
        title="Activity"
        hint={weekly ? "Answers per week" : "Answers per day"}
        legend={[{ label: "Correct", color: ACCENT }, { label: "Missed", color: MISSED }]}
        empty={empty}
        table={{ columns: [weekly ? "Week" : "Day", "Correct", "Missed", "Time"], rows: grouped.filter((bucket) => bucket.answered).map((bucket) => [bucketLabel(bucket, false), bucket.correct, bucket.answered - bucket.correct, formatDuration(bucket.timeMs)]) }}
      >
        <StackedColumns
          data={grouped}
          series={[{ key: "correct", label: "correct", color: ACCENT }, { key: "missed", label: "missed", color: MISSED }]}
          value={(bucket, key) => (key === "correct" ? bucket.correct : bucket.answered - bucket.correct)}
          label={bucketLabel}
        />
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Mastery"
          hint={subject ? "Average mastery of this subject's skills" : "Average mastery across all skills"}
          empty={totals.skillCount === 0 ? "No skills yet." : grouped.every((bucket) => bucket.mastery === 0) && "Practice a skill to start your mastery line."}
          table={{ columns: [weekly ? "Week" : "Day", "Mastery"], rows: grouped.map((bucket) => [bucketLabel(bucket, false), percent(bucket.mastery)]) }}
        >
          <TrendLine data={grouped} value={(bucket) => bucket.mastery} label={bucketLabel} color="#58cc02" max={1} format={percent} />
        </ChartCard>
        <ChartCard
          title="Practice calendar"
          hint="Darker days had more answers"
          empty={stats.daily.length < 28 ? "Pick 30 days or more to see the calendar." : empty}
          table={{ columns: ["Day", "Answers"], rows: stats.daily.filter((day) => day.answered).map((day) => [formatDate(`${day.date}T12:00:00`), day.answered]) }}
        >
          <ActivityCalendar days={stats.daily} label={(date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Days of the week" hint="When you practice most" empty={empty} table={{ columns: ["Day", "Answers"], rows: WEEKDAYS.map((day, index) => [day, stats.weekdays[index]!]) }}>
          <CategoryColumns labels={WEEKDAYS} values={stats.weekdays} color={ACCENT} tooltip={(index) => ({ title: WEEKDAYS[index]!, value: String(stats.weekdays[index]) })} />
        </ChartCard>
        <ChartCard title="Time of day" hint="Answers by hour" empty={empty} table={{ columns: ["Hour", "Answers"], rows: stats.hours.map((count, hour) => [`${hour}:00`, count]) }}>
          <CategoryColumns
            labels={stats.hours.map((_, hour) => String(hour))}
            values={stats.hours}
            color={ACCENT}
            tooltip={(hour) => ({ title: `${hour}:00 – ${hour}:59`, value: String(stats.hours[hour]) })}
          />
        </ChartCard>
      </div>

      {!subject && stats.items.length > 0 && (
        <ChartCard
          title="Levels"
          hint="Where you rate yourself now; the gray dot is where you stood when the range began"
          empty={!hasLevels && "Nothing rated yet. Rate subjects and trackers from Edit mode on the Learn page."}
          table={{ columns: ["Name", "Level", "At range start"], rows: stats.items.map((item) => [item.name, levelText(item.level), item.levelAtStart === null ? "–" : `Lv ${item.levelAtStart}`]) }}
        >
          <LevelDumbbells stats={stats} subjects={subjects} />
        </ChartCard>
      )}

      {!subject && stats.items.length > 0 && (
        <ChartCard title="Breakdown" hint="Each subject and tracker in this range">
          <ul className="flex flex-col">
            {[...stats.items].sort((a, b) => b.answered - a.answered || a.name.localeCompare(b.name)).map((item) => {
              const known = subjects.get(item.id);
              return (
                <li key={item.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t-2 border-swan py-3 first:border-t-0 first:pt-0">
                  {known ? <ItemBadge subject={known} /> : <span />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold">{item.name}</p>
                    <p className="truncate text-xs font-bold text-wolf">
                      {item.type === "tracker" ? `Tracker · ${levelText(item.level)}` : `${item.completedCount}/${item.skillCount} skills done · ${accuracy(item.correct, item.answered)} accuracy · ${formatDuration(item.timeMs)}`}
                    </p>
                    {item.type === "subject" && item.skillCount > 0 && <div className="mt-1.5 max-w-xs"><Meter value={item.mastery} color="#58cc02" /></div>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black">{item.type === "tracker" ? (item.level === null ? "–" : `Lv ${item.level}`) : item.answered.toLocaleString()}</p>
                    <p className="text-xs font-bold text-wolf">{item.type === "tracker" ? "level" : "answers"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </ChartCard>
      )}

      {subject && (
        <ChartCard title="Skills" hint="Weakest first" empty={stats.skills.length === 0 && "This subject has no skills yet."}>
          <ul className="flex flex-col">
            {[...stats.skills].sort((a, b) => a.mastery - b.mastery).map((skill) => (
              <li key={skill.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t-2 border-swan py-3 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-extrabold"><span className="truncate">{skill.title}</span><Stars count={skill.stars} /></p>
                  <p className="truncate text-xs font-bold text-wolf">{skill.unitTitle} · {accuracy(skill.correct, skill.answered)} accuracy · last {ago(skill.lastPracticedAt).toLowerCase()}</p>
                  <div className="mt-1.5 max-w-xs"><Meter value={skill.mastery} color="#58cc02" /></div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black">{percent(skill.mastery)}</p>
                  <p className="text-xs font-bold text-wolf">{skill.answered} answers</p>
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>
      )}
    </>
  );
}

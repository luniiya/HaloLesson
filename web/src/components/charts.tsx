import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Small hand-rolled SVG charts for the Statistics page. Marks follow one spec:
// columns at most 24px with a 4px rounded cap, 2px lines, 8px dots with a 2px
// surface ring, hairline gridlines, text in text colors only.

const AXIS = { left: 34, right: 14, top: 14, bottom: 26 };

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

// Rounded max and a handful of whole-number ticks from 0.
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((factor) => factor * magnitude).find((value) => value >= raw)!);
  const ticks: number[] = [];
  for (let value = 0; value < max + step; value += step) ticks.push(value);
  return ticks;
}

export const compact = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K` : String(value));

// A column with a rounded data end, square at the baseline.
function columnPath(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

export interface TooltipRow { label: string; value: string; color?: string; line?: boolean }

// One floating readout: values lead, labels follow, series keyed by a short stroke.
function Tooltip({ x, y, width, title, rows }: { x: number; y: number; width: number; title: string; rows: TooltipRow[] }) {
  const flip = x > width - 170;
  return (
    <div className="chart-tooltip" style={{ left: x, top: y, transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -50%)` }} role="status">
      <p className="chart-tooltip-title">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center gap-2">
          {row.color && <span className={row.line ? "chart-key-line" : "chart-key-box"} style={{ background: row.color }} aria-hidden="true" />}
          <strong className="text-ink">{row.value}</strong>
          <span className="text-wolf">{row.label}</span>
        </p>
      ))}
    </div>
  );
}

function YGrid({ ticks, scale, width, format = compact }: { ticks: number[]; scale: (value: number) => number; width: number; format?: (value: number) => string }) {
  return (
    <g aria-hidden="true">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={AXIS.left} x2={width - AXIS.right} y1={scale(tick)} y2={scale(tick)} className="chart-grid" />
          <text x={AXIS.left - 8} y={scale(tick)} dy="0.32em" textAnchor="end" className="chart-axis">{format(tick)}</text>
        </g>
      ))}
    </g>
  );
}

function XLabels({ labels, width, height }: { labels: Array<{ x: number; text: string }>; width: number; height: number }) {
  return (
    <g aria-hidden="true">
      {labels.map((label, index) => (
        <text key={index} x={Math.min(Math.max(label.x, AXIS.left + 16), width - AXIS.right - 16)} y={height - 6} textAnchor="middle" className="chart-axis">{label.text}</text>
      ))}
    </g>
  );
}

// First, middle and last positions, enough to read a time axis without crowding.
function edgeLabels(count: number, x: (index: number) => number, text: (index: number) => string, width: number) {
  if (count === 0) return [];
  const picks = count === 1 ? [0] : width < 420 || count < 5 ? [0, count - 1] : [0, Math.floor((count - 1) / 2), count - 1];
  return picks.map((index) => ({ x: x(index), text: text(index) }));
}

export interface ColumnSeries { key: string; label: string; color: string }

// Stacked columns over time buckets, with a crosshair band and one tooltip per bucket.
export function StackedColumns<T>({ data, series, value, label, height = 210, format = String }: {
  data: T[];
  series: ColumnSeries[];
  value: (item: T, key: string) => number;
  label: (item: T, short: boolean) => string;
  height?: number;
  format?: (value: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((item) => series.reduce((sum, item2) => sum + value(item, item2.key), 0));
  const ticks = niceTicks(Math.max(...totals, 0));
  const max = ticks.at(-1)!;
  const plotWidth = Math.max(0, width - AXIS.left - AXIS.right);
  const band = data.length ? plotWidth / data.length : 0;
  const barWidth = Math.max(1, Math.min(24, band * (band > 6 ? 0.62 : 0.8)));
  const y = (amount: number) => AXIS.top + (height - AXIS.top - AXIS.bottom) * (1 - amount / max);
  const center = (index: number) => AXIS.left + band * index + band / 2;

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible" role="img" aria-label="Column chart">
          <YGrid ticks={ticks} scale={y} width={width} />
          {hover !== null && <rect x={AXIS.left + band * hover} y={AXIS.top} width={band} height={height - AXIS.top - AXIS.bottom} className="chart-hover-band" />}
          {data.map((item, index) => {
            let base = 0;
            const parts = series.map((entry) => ({ entry, amount: value(item, entry.key) })).filter((part) => part.amount > 0);
            return (
              <g key={index}>
                {parts.map(({ entry, amount }, partIndex) => {
                  const top = y(base + amount);
                  const bottom = y(base) - (partIndex > 0 ? 2 : 0);
                  base += amount;
                  const isTop = partIndex === parts.length - 1;
                  const h = Math.max(0, bottom - top);
                  const x = center(index) - barWidth / 2;
                  return isTop
                    ? <path key={entry.key} d={columnPath(x, top, barWidth, h, barWidth >= 6 ? 4 : 1)} fill={entry.color} />
                    : <rect key={entry.key} x={x} y={top} width={barWidth} height={h} fill={entry.color} />;
                })}
              </g>
            );
          })}
          <line x1={AXIS.left} x2={width - AXIS.right} y1={y(0)} y2={y(0)} className="chart-baseline" />
          <XLabels labels={edgeLabels(data.length, center, (index) => label(data[index]!, true), width)} width={width} height={height} />
          <rect
            x={AXIS.left} y={0} width={plotWidth} height={height} fill="transparent"
            onPointerMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              setHover(Math.min(data.length - 1, Math.max(0, Math.floor((event.clientX - box.left) / band))));
            }}
          />
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip
          x={center(hover)} y={height / 2} width={width}
          title={label(data[hover]!, false)}
          rows={series.map((entry) => ({ label: entry.label, value: format(value(data[hover]!, entry.key)), color: entry.color }))}
        />
      )}
    </div>
  );
}

// Plain columns for a fixed set of categories (weekdays, hours).
export function CategoryColumns({ labels, values, color, height = 170, tooltip }: {
  labels: string[];
  values: number[];
  color: string;
  height?: number;
  tooltip: (index: number) => { title: string; value: string };
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(...values, 0), 3);
  const max = ticks.at(-1)!;
  const plotWidth = Math.max(0, width - AXIS.left - AXIS.right);
  const band = plotWidth / values.length;
  const barWidth = Math.max(2, Math.min(24, band - 2));
  const y = (amount: number) => AXIS.top + (height - AXIS.top - AXIS.bottom) * (1 - amount / max);
  const center = (index: number) => AXIS.left + band * index + band / 2;
  const every = Math.ceil(labels.length / Math.max(1, Math.floor(plotWidth / 34)));

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible" role="img" aria-label="Column chart">
          <YGrid ticks={ticks} scale={y} width={width} />
          {values.map((amount, index) => (
            <g key={index} onPointerEnter={() => setHover(index)}>
              <rect x={AXIS.left + band * index} y={AXIS.top} width={band} height={height - AXIS.top - AXIS.bottom} className={hover === index ? "chart-hover-band" : ""} fill="transparent" />
              {amount > 0 && <path d={columnPath(center(index) - barWidth / 2, y(amount), barWidth, y(0) - y(amount), barWidth >= 6 ? 4 : 1)} fill={color} />}
            </g>
          ))}
          <line x1={AXIS.left} x2={width - AXIS.right} y1={y(0)} y2={y(0)} className="chart-baseline" />
          <XLabels labels={labels.flatMap((text, index) => (index % every === 0 ? [{ x: center(index), text }] : []))} width={width} height={height} />
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={center(hover)} y={height / 2} width={width} title={tooltip(hover).title} rows={[{ label: "answers", value: tooltip(hover).value, color, line: false }]} />
      )}
    </div>
  );
}

// One series over time buckets: a 2px line over a 10% wash, end value labelled.
export function TrendLine<T>({ data, value, label, color, max, format, height = 210 }: {
  data: T[];
  value: (item: T) => number;
  label: (item: T, short: boolean) => string;
  color: string;
  max: number;
  format: (value: number) => string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];
  const plotWidth = Math.max(0, width - AXIS.left - AXIS.right - 30);
  const x = (index: number) => AXIS.left + (data.length > 1 ? (plotWidth * index) / (data.length - 1) : plotWidth / 2);
  const y = (amount: number) => AXIS.top + (height - AXIS.top - AXIS.bottom) * (1 - amount / max);
  const points = data.map((item, index) => `${x(index)},${y(value(item))}`).join(" ");
  const last = data.length - 1;

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      {width > 0 && data.length > 0 && (
        <svg width={width} height={height} className="block overflow-visible" role="img" aria-label="Line chart">
          <YGrid ticks={ticks} scale={y} width={width - 30} format={format} />
          <polygon points={`${x(0)},${y(0)} ${points} ${x(last)},${y(0)}`} fill={color} opacity={0.1} />
          <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={AXIS.top} y2={y(0)} className="chart-crosshair" />}
          <circle cx={x(hover ?? last)} cy={y(value(data[hover ?? last]!))} r={4} fill={color} className="chart-dot" />
          <text x={x(last) + 8} y={y(value(data[last]!))} dy="0.32em" className="chart-value">{format(value(data[last]!))}</text>
          <XLabels labels={edgeLabels(data.length, x, (index) => label(data[index]!, true), width)} width={width} height={height} />
          <rect
            x={AXIS.left} y={0} width={plotWidth} height={height} fill="transparent"
            onPointerMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              setHover(Math.round(((event.clientX - box.left) / Math.max(1, plotWidth)) * last));
            }}
          />
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={x(hover)} y={height / 2} width={width} title={label(data[hover]!, false)} rows={[{ label: "average mastery", value: format(value(data[hover]!)), color, line: true }]} />
      )}
    </div>
  );
}

export interface LevelPoint { at: number; level: number | null }

// A self-rating over time: a step line (a rating holds until the next one), a dot
// on every rating, gaps where the rating was cleared.
export function LevelSteps({ points, from, to, color, describe, height = 220 }: {
  points: LevelPoint[];
  from: number;
  to: number;
  color: string;
  describe: (point: LevelPoint) => { title: string; value: string };
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const plotWidth = Math.max(0, width - AXIS.left - AXIS.right - 30);
  const x = (at: number) => AXIS.left + (to > from ? (plotWidth * (Math.max(from, at) - from)) / (to - from) : plotWidth);
  const y = (level: number) => AXIS.top + (height - AXIS.top - AXIS.bottom) * (1 - level / 10);
  const segments: string[] = [];
  points.forEach((point, index) => {
    if (point.level === null) return;
    const end = points[index + 1]?.at ?? to;
    segments.push(`M${x(point.at)},${y(point.level)}H${x(end)}${points[index + 1]?.level != null ? `V${y(points[index + 1]!.level!)}` : ""}`);
  });
  const current = points.at(-1);

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible" role="img" aria-label="Level over time">
          <YGrid ticks={[0, 2, 4, 6, 8, 10]} scale={y} width={width - 30} />
          <path d={segments.join("")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((point, index) => point.level !== null && (
            <circle key={index} cx={x(point.at)} cy={y(point.level)} r={hover === index ? 6 : 4} fill={color} className="chart-dot" />
          ))}
          {current?.level != null && <text x={x(to) + 8} y={y(current.level)} dy="0.32em" className="chart-value">Lv {current.level}</text>}
          <XLabels labels={[{ x: x(from), text: shortDate(from) }, { x: x(to), text: "Today" }]} width={width} height={height} />
          <rect
            x={AXIS.left - 8} y={0} width={plotWidth + 16} height={height} fill="transparent"
            onPointerMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const pointer = event.clientX - box.left + AXIS.left - 8;
              let best: number | null = null;
              points.forEach((point, index) => {
                if (point.level !== null && (best === null || Math.abs(x(point.at) - pointer) < Math.abs(x(points[best]!.at) - pointer))) best = index;
              });
              setHover(best);
            }}
          />
        </svg>
      )}
      {hover !== null && points[hover]?.level != null && (
        <Tooltip x={x(points[hover]!.at)} y={y(points[hover]!.level!)} width={width} title={describe(points[hover]!).title} rows={[{ label: "", value: describe(points[hover]!).value, color, line: true }]} />
      )}
    </div>
  );
}

// Days as squares in week columns, Monday on top; darker means more answers.
export function ActivityCalendar({ days, label }: { days: Array<{ date: string; answered: number }>; label: (date: string, answered: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
  const cell = 13;
  const gap = 3;
  const weeks = Math.max(1, Math.min(53, Math.floor((width - 30 + gap) / (cell + gap))));
  const weekday = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  // As many whole weeks as fit, the last column ending on the last day's weekday.
  const lastRow = days.length ? weekday(days.at(-1)!.date) : 6;
  const cells = days.slice(-((weeks - 1) * 7 + lastRow + 1));
  const firstRow = cells.length ? weekday(cells[0]!.date) : 0;
  const place = (index: number) => ({ column: Math.floor((index + firstRow) / 7), row: (index + firstRow) % 7 });
  const columns = cells.length ? place(cells.length - 1).column + 1 : 0;
  const max = Math.max(1, ...cells.map((day) => day.answered));
  const step = (answered: number) => (answered === 0 ? 0 : Math.min(4, Math.ceil((answered / max) * 4)));
  const height = 7 * (cell + gap);

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={Math.min(width, 30 + columns * (cell + gap))} height={height + 4} className="block" role="img" aria-label="Practice calendar">
          {["Mon", "", "Wed", "", "Fri", "", ""].map((text, row) => text && <text key={row} x={0} y={row * (cell + gap) + cell / 2} dy="0.32em" className="chart-axis">{text}</text>)}
          {cells.map((day, index) => {
            const { column, row } = place(index);
            const cx = 30 + column * (cell + gap);
            const cy = row * (cell + gap);
            return (
              <rect
                key={day.date} x={cx} y={cy} width={cell} height={cell} rx={3}
                className={`chart-heat chart-heat-${step(day.answered)} ${hover?.index === index ? "chart-heat-hover" : ""}`}
                onPointerEnter={() => setHover({ index, x: cx + cell / 2, y: cy + cell / 2 })}
              />
            );
          })}
        </svg>
      )}
      {hover && cells[hover.index] && (
        <Tooltip x={hover.x} y={hover.y} width={width} title={label(cells[hover.index]!.date, cells[hover.index]!.answered)} rows={[{ label: "answers", value: String(cells[hover.index]!.answered) }]} />
      )}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs font-bold text-wolf" aria-hidden="true">
        Less{[0, 1, 2, 3, 4].map((level) => <span key={level} className={`chart-heat-key chart-heat-${level}`} />)}More
      </div>
    </div>
  );
}

// Card around a chart with a chart/table switch, so nothing hides behind hover.
export function ChartCard({ title, hint, legend, table, empty, children }: {
  title: string;
  hint?: string;
  legend?: Array<{ label: string; color: string; line?: boolean }>;
  table?: { columns: string[]; rows: Array<Array<string | number>> };
  empty?: string | false;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="stats-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-ink">{title}</h2>
          {hint && <p className="mt-0.5 text-sm font-semibold text-wolf">{hint}</p>}
        </div>
        {table && !empty && (
          <div className="stats-switch" role="group" aria-label={`${title} view`}>
            <button type="button" aria-pressed={!showTable} onClick={() => setShowTable(false)}>Chart</button>
            <button type="button" aria-pressed={showTable} onClick={() => setShowTable(true)}>Table</button>
          </div>
        )}
      </div>
      {legend && !empty && !showTable && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-extrabold text-wolf">
          {legend.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span className={item.line ? "chart-key-line" : "chart-key-box"} style={{ background: item.color }} aria-hidden="true" />{item.label}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4">
        {empty ? (
          <p className="grid min-h-32 place-items-center rounded-xl bg-eel px-4 text-center text-sm font-bold text-wolf">{empty}</p>
        ) : showTable && table ? (
          <div className="max-h-80 overflow-auto rounded-xl border-2 border-swan">
            <table className="stats-table">
              <thead><tr>{table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        ) : children}
      </div>
    </section>
  );
}

export function shortDate(value: number | string) {
  const date = typeof value === "number" ? new Date(value) : new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

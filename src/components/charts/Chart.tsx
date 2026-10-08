"use client";

/**
 * Charts drawn from the numbers the API returned.
 *
 * No charting library: these are two shapes over at most a few dozen points, and
 * a dependency that renders a few hundred kilobytes of JavaScript to draw a
 * polyline is a poor trade for a screen that must load on a workshop's
 * connection.
 *
 * Every chart is drawn from the series *including* its zero points. The backend
 * emits a bucket for every day in the period, zero-filled, and dropping them here
 * would make the line close the gap and show a slope that never happened.
 */

export interface Point {
  label: string;
  value: number;
}

export function LineChart({
  series,
  height = 160,
  format = (v: number) => String(v),
}: {
  series: { name: string; color: string; points: Point[] }[];
  height?: number;
  format?: (value: number) => string;
}) {
  const width = 720;
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-500">No data for this period.</p>;
  }

  const max = Math.max(1, ...all.map((p) => p.value));
  const count = Math.max(...series.map((s) => s.points.length));
  const stepX = count > 1 ? width / (count - 1) : width;
  const padY = 12;
  const scaleY = (value: number) => height - padY - (value / max) * (height - padY * 2);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${series.map((s) => s.name).join(" and ")} over time`}
      >
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1={0}
            x2={width}
            y1={padY + fraction * (height - padY * 2)}
            y2={padY + fraction * (height - padY * 2)}
            stroke="var(--color-ink-200)"
            strokeWidth="1"
          />
        ))}
        {series.map((s) => {
          const path = s.points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${scaleY(p.value)}`)
            .join(" ");
          return (
            <g key={s.name}>
              <path d={path} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              {s.points.map((p, i) => (
                <circle key={i} cx={i * stepX} cy={scaleY(p.value)} r="2.5" fill={s.color} />
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-4">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-xs text-ink-600">
              <span className="inline-block size-2.5 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
        <span className="tabular text-xs text-ink-500">
          peak {format(max)} · {all.length} point(s)
        </span>
      </figcaption>
    </figure>
  );
}

export function BarList({
  items,
  format = (v: number) => String(v),
}: {
  items: { label: string; value: number; hint?: string }[];
  format?: (value: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink-700">{item.label}</span>
            <span className="tabular shrink-0 font-medium text-ink-900">{format(item.value)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
          {item.hint ? <p className="mt-0.5 text-xs text-ink-500">{item.hint}</p> : null}
        </li>
      ))}
    </ul>
  );
}
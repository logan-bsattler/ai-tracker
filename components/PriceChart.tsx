'use client';

import { useState } from 'react';

export interface Series {
  label: string;
  color: string;
  points: { date: string; value: number }[];
}

const money = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

/**
 * Multi-series price history. Shares one x-axis of every date any series was
 * observed, so lines captured on different days still line up.
 */
export default function PriceChart({ series, height = 260 }: { series: Series[]; height?: number }) {
  const [hover, setHover] = useState<string | null>(null);

  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const values = series.flatMap((s) => s.points.map((p) => p.value));

  if (dates.length < 2 || values.length === 0) {
    return (
      <div className="muted flex items-center justify-center rounded-lg border border-dashed py-10 text-sm hairline"
        style={{ height }}>
        Two capture rounds are needed before a trend appears.
      </div>
    );
  }

  const width = 720;
  const padL = 52;
  const padR = 16;
  const padT = 14;
  const padB = 30;

  // Pad the value range by 8% so lines never graze the frame.
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const cushion = (rawMax - rawMin || rawMax * 0.1) * 0.08;
  const min = Math.max(0, rawMin - cushion);
  const max = rawMax + cushion;

  const x = (date: string) =>
    padL + (dates.indexOf(date) / (dates.length - 1)) * (width - padL - padR);
  const y = (v: number) =>
    height - padB - ((v - min) / (max - min || 1)) * (height - padT - padB);

  const ticks = [min, (min + max) / 2, max];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 460 }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)}
              stroke="var(--border)" strokeDasharray="3 3" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end"
              fontSize="10" fill="var(--text-dim)">{money(t)}</text>
          </g>
        ))}

        {dates.map((d, i) => (
          (i === 0 || i === dates.length - 1 || dates.length <= 6) && (
            <text key={d} x={x(d)} y={height - 10}
              textAnchor={i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'}
              fontSize="10" fill="var(--text-dim)">{d.slice(5)}</text>
          )
        ))}

        {series.map((s) => {
          const pts = [...s.points].sort((a, b) => a.date.localeCompare(b.date));
          if (pts.length === 0) return null;
          const dim = hover != null && hover !== s.label;
          return (
            <g key={s.label} opacity={dim ? 0.22 : 1}
              onMouseEnter={() => setHover(s.label)} onMouseLeave={() => setHover(null)}>
              <polyline
                points={pts.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')}
                fill="none" stroke={s.color} strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p) => (
                <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r="3" fill={s.color}>
                  <title>{`${s.label} · ${p.date} · ${money(p.value)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((s) => (
          <button key={s.label} type="button"
            className="flex items-center gap-1.5 text-xs"
            onMouseEnter={() => setHover(s.label)} onMouseLeave={() => setHover(null)}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="muted">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

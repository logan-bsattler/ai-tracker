interface Point { date: string; value: number }

/**
 * Tiny inline trend line. Hand-drawn SVG rather than a chart library — a
 * polyline and two circles don't justify a dependency.
 */
export default function Sparkline({
  points, width = 96, height = 26,
}: { points: Point[]; width?: number; height?: number }) {
  if (points.length < 2) {
    return <span className="muted text-xs">—</span>;
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;

  const x = (i: number) => (i / (points.length - 1)) * (width - pad * 2) + pad;
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  const path = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  const last = points[points.length - 1];
  const rising = last.value > points[points.length - 2].value;
  const stroke = rising ? 'var(--up)' : 'var(--down)';

  return (
    <svg width={width} height={height} role="img"
      aria-label={`Price trend, ${points.length} observations, latest $${last.value}`}>
      <polyline points={path} fill="none" stroke={stroke} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
      <circle cx={x(points.length - 1)} cy={y(last.value)} r="2.5" fill={stroke} />
    </svg>
  );
}

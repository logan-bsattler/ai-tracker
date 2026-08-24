'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PriceChart, { type Series } from './PriceChart';
import type { AllRankings, RankingRow } from '@/lib/view';

const money = (n: number | null) =>
  n == null ? '—' : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const LINE_COLORS = ['var(--accent)', 'var(--color-coral-500)', '#8b5cf6', '#eab308', '#3b82f6'];

/** Row of the comparison matrix: a label plus one cell per resort. */
function Row({
  label, rows, render, highlight,
}: {
  label: string;
  rows: RankingRow[];
  render: (r: RankingRow) => React.ReactNode;
  /** Index of the column that "wins" this row, if any. */
  highlight?: number;
}) {
  return (
    <tr>
      <th scope="row" className="whitespace-nowrap">{label}</th>
      {rows.map((r, i) => (
        <td key={r.id} className={i === highlight ? 'font-semibold' : ''}
          style={i === highlight ? { color: 'var(--accent)' } : undefined}>
          {render(r)}
        </td>
      ))}
    </tr>
  );
}

/** Index of the row that minimizes (or maximizes) `pick`, ignoring nulls. */
function bestBy(rows: RankingRow[], pick: (r: RankingRow) => number | null, lowest = true) {
  let best = -1;
  let bestVal = lowest ? Infinity : -Infinity;
  rows.forEach((r, i) => {
    const v = pick(r);
    if (v == null) return;
    if (lowest ? v < bestVal : v > bestVal) { bestVal = v; best = i; }
  });
  return best === -1 ? undefined : best;
}

/**
 * Selection comes from the URL and is resolved in the browser, so this works
 * identically on the dev server and on the static GitHub Pages build.
 */
export default function CompareView({ data }: { data: AllRankings }) {
  const params = useSearchParams();
  const requestedTrip = params.get('trip');
  const trip = data.trips.find((t) => t.id === requestedTrip) ?? data.trips[0] ?? null;
  const allRows = trip ? data.byTrip[trip.id] ?? [] : [];

  const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
  const rows = ids
    .map((id) => allRows.find((r) => r.id === id))
    .filter((r): r is RankingRow => Boolean(r));

  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h1 className="mb-2 text-lg font-semibold">Nothing to compare yet</h1>
        <p className="muted mb-4 text-sm">
          Tick two or more resorts on the Rankings page, then choose &ldquo;Compare side by side&rdquo;.
        </p>
        <Link className="btn btn-primary" href={trip ? `/?trip=${trip.id}` : '/'}>
          Go to rankings ({allRows.length} resorts)
        </Link>
      </div>
    );
  }

  const series: Series[] = rows
    .map((r, i) => ({
      label: r.name,
      color: LINE_COLORS[i % LINE_COLORS.length],
      points: r.history,
    }))
    .filter((s) => s.points.length > 0);

  const cheapest = bestBy(rows, (r) => r.price);
  const bestScore = bestBy(rows, (r) => r.score, false);
  const bestValue = bestBy(rows, (r) => r.valueIndex);
  const closest = bestBy(rows, (r) => r.transferMinutes);
  const smallestUpgrade = bestBy(rows, (r) => r.upgradeCost);

  return (
    <>
      <div className="mb-5">
        <Link href={trip ? `/?trip=${trip.id}` : '/'} className="muted text-xs hover:underline">
          ← Rankings
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Compare</h1>
        <p className="muted mt-1 text-sm">
          {trip ? `${trip.checkIn} → ${trip.checkOut} · ${trip.adults} adults` : 'No trip selected'}
          {' · '}best value in each row is highlighted
        </p>
      </div>

      <div className="card mb-5 overflow-x-auto">
        <table className="grid">
          <thead>
            <tr>
              <th style={{ width: 190 }}></th>
              {rows.map((r) => (
                <th key={r.id} style={{ minWidth: 190 }}>
                  <Link href={`/resorts/${r.id}${trip ? `?trip=${trip.id}` : ''}`}
                    className="text-sm font-semibold normal-case tracking-normal hover:underline"
                    style={{ color: 'var(--text)' }}>
                    {r.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Destination" rows={rows} render={(r) => r.destination} />
            <Row label="Airport transfer" rows={rows} highlight={closest}
              render={(r) => r.transferMinutes != null ? `${r.transferMinutes} min` : '—'} />
            <Row label="Room you'd book" rows={rows} render={(r) => (
              r.targetName == null ? '—' : r.targetUrl ? (
                <a href={r.targetUrl} target="_blank" rel="noreferrer" className="hover:underline">
                  {r.targetName} <span className="muted">↗</span>
                </a>
              ) : r.targetName
            )} />
            <Row label="Price" rows={rows} highlight={cheapest}
              render={(r) => (
                <span className="num">
                  {money(r.price)}
                  {r.onSale && <span className="chip chip-on ml-1">sale</span>}
                </span>
              )} />
            <Row label="Taxes in price?" rows={rows} render={(r) => (
              r.taxesIncluded
                ? <span className="muted">Included</span>
                : <span style={{ color: 'var(--up)' }}>Excluded — not comparable</span>
            )} />
            <Row label="Cheapest room" rows={rows} render={(r) => (
              r.entryName == null ? '—' : r.entryUrl ? (
                <a href={r.entryUrl} target="_blank" rel="noreferrer" className="muted hover:underline">
                  {r.entryName} <span>↗</span>
                </a>
              ) : <span className="muted">{r.entryName}</span>
            )} />
            <Row label="Entry room price" rows={rows}
              render={(r) => <span className="num muted">{money(r.entryPrice)}</span>} />
            <Row label="Cost to upgrade" rows={rows} highlight={smallestUpgrade}
              render={(r) => <span className="num">{money(r.upgradeCost)}</span>} />
            <Row label="Lowest ever seen" rows={rows}
              render={(r) => <span className="num muted">{money(r.low)}</span>} />
            <Row label="Change since last" rows={rows}
              render={(r) => r.delta == null ? '—' : (
                <span className="num" style={{ color: r.delta < 0 ? 'var(--down)' : 'var(--up)' }}>
                  {r.delta > 0 ? '+' : ''}{money(r.delta)}
                </span>
              )} />
            <Row label="Match score" rows={rows} highlight={bestScore}
              render={(r) => <span className="num">{r.score}%</span>} />
            <Row label="$ per match point" rows={rows} highlight={bestValue}
              render={(r) => <span className="num">{money(r.valueIndex)}</span>} />

            {data.criteria.map((c) => (
              <Row key={c.key} label={c.label} rows={rows} render={(r) => (
                r.met[c.key] === true
                  ? r.entryMet[c.key] === true
                    ? <span style={{ color: 'var(--accent)' }}>Yes</span>
                    : <span className="muted">Upgrade only</span>
                  : <span className="muted">No</span>
              )} />
            ))}

            <Row label="Tags" rows={rows} render={(r) => (
              <div className="flex flex-wrap gap-1">
                {r.tags.length ? r.tags.map((t) => <span key={t} className="chip">{t}</span>)
                  : <span className="muted">—</span>}
              </div>
            )} />
            <Row label="Book" rows={rows} render={(r) => (
              r.bookingUrl
                ? <a className="btn" href={r.bookingUrl} target="_blank" rel="noreferrer">Open ↗</a>
                : <span className="muted">no link</span>
            )} />
          </tbody>
        </table>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Price history</h2>
        <PriceChart series={series} />
      </section>
    </>
  );
}

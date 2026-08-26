'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useRankConfig } from './useRankConfig';
import { rankResorts, type RankingRow } from '@/lib/rank';
import type { AllRankings } from '@/lib/view';

const money = (n: number | null) =>
  n == null ? '—' : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** One resort's row across every tracked week. */
interface WeekRow {
  id: string;
  name: string;
  destination: string;
  byTrip: Map<string, RankingRow>;
  /**
   * Lowest tax-included price across all weeks. Used to order resorts and to
   * feed each week's "from $X" figure — both compare across resorts, where an
   * ex-tax quote would unfairly look cheapest.
   */
  cheapest: number | null;
  /**
   * The single cheapest week for this resort, any tax status. Comparing a
   * resort's own weeks to each other is always valid (same quoting basis
   * throughout), so this is what gets highlighted and linked to.
   */
  bestTripId: string | null;
}

/**
 * Every resort against every tracked week, so you can see at a glance which
 * week is cheapest for a given resort, and which resort is cheapest for a
 * given week — the thing the single-trip Rankings view can't show at once.
 *
 * Uses the viewer's own criteria weighting (same as Rankings and Compare) so
 * "price" means the same room here as it does everywhere else in the app.
 */
export default function WeeksView({ data }: { data: AllRankings }) {
  const { config, isCustom } = useRankConfig();

  const trips = useMemo(
    () => [...data.trips].sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
    [data.trips],
  );

  const perTrip = useMemo(
    () => trips.map((trip) => ({
      trip,
      ...rankResorts(data.resortsByTrip[trip.id] ?? [], data.criteria, config),
    })),
    [data, trips, config],
  );

  const rows = useMemo<WeekRow[]>(() => {
    const byResort = new Map<string, WeekRow>();

    for (const { trip, rows: tripRows } of perTrip) {
      for (const r of tripRows) {
        if (r.status === 'closed') continue;
        let row = byResort.get(r.id);
        if (!row) {
          row = {
            id: r.id, name: r.name, destination: r.destination,
            byTrip: new Map(), cheapest: null, bestTripId: null,
          };
          byResort.set(r.id, row);
        }
        row.byTrip.set(trip.id, r);
        if (r.price != null && r.taxesIncluded && (row.cheapest == null || r.price < row.cheapest)) {
          row.cheapest = r.price;
        }
        const best = row.bestTripId ? row.byTrip.get(row.bestTripId)!.price : null;
        if (r.price != null && (best == null || r.price < best)) {
          row.bestTripId = trip.id;
        }
      }
    }

    return [...byResort.values()].sort(
      (a, b) => (a.cheapest ?? Infinity) - (b.cheapest ?? Infinity),
    );
  }, [perTrip]);

  // Cheapest price seen in each week, across all resorts — so a column header
  // can answer "is this a cheap week to travel at all" at a glance.
  const cheapestPerTrip = useMemo(() => {
    const out = new Map<string, number>();
    for (const { trip, rows: tripRows } of perTrip) {
      const priced = tripRows.filter((r) => r.status !== 'closed' && r.price != null && r.taxesIncluded);
      if (priced.length === 0) continue;
      out.set(trip.id, Math.min(...priced.map((r) => r.price!)));
    }
    return out;
  }, [perTrip]);

  const anyExTax = rows.some((r) => [...r.byTrip.values()].some((c) => !c.taxesIncluded));

  if (trips.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h1 className="mb-2 text-lg font-semibold">No weeks tracked yet</h1>
        <p className="muted text-sm">
          Add a date range on the <Link className="underline" href="/trips">Trips</Link> page to start comparing weeks.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Weeks</h1>
        <p className="muted mt-1 text-sm">
          {rows.length} resorts × {trips.length} weeks · the highlighted cell in each
          row is that resort&rsquo;s cheapest week
        </p>
        {isCustom && (
          <p className="muted mt-1 text-xs">
            Using your own criteria weighting — <Link className="underline" href="/criteria">change or reset it</Link>.
          </p>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="grid">
          <thead>
            <tr>
              <th className="sticky left-0 z-10" style={{ minWidth: 180, background: 'var(--surface)' }}>
                Resort
              </th>
              {trips.map((t) => (
                <th key={t.id} className="text-right" style={{ minWidth: 110 }}>
                  <Link href={`/?trip=${t.id}`} className="hover:underline"
                    style={{ color: 'var(--text)' }} title={`${t.checkIn} → ${t.checkOut}`}>
                    {t.label}
                  </Link>
                  <div className="muted mt-0.5 num font-normal normal-case tracking-normal">
                    {cheapestPerTrip.has(t.id) ? `from ${money(cheapestPerTrip.get(t.id)!)}` : '—'}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="sticky left-0 z-10" style={{ background: 'var(--surface)' }}>
                  <Link href={`/resorts/${r.id}${r.bestTripId ? `?trip=${r.bestTripId}` : ''}`}
                    className="text-sm font-semibold normal-case tracking-normal hover:underline"
                    style={{ color: 'var(--text)' }}>
                    {r.name}
                  </Link>
                  <div className="muted mt-0.5 text-xs font-normal normal-case tracking-normal">
                    {r.destination}
                  </div>
                </th>
                {trips.map((t) => {
                  const cell = r.byTrip.get(t.id);
                  const isCheapest = t.id === r.bestTripId;
                  return (
                    <td key={t.id} className="text-right">
                      {cell?.price == null ? (
                        <span className="muted">—</span>
                      ) : (
                        <>
                          <span className={`num ${isCheapest ? 'font-semibold' : ''}`}
                            style={isCheapest ? { color: 'var(--accent)' } : undefined}>
                            {money(cell.price)}
                          </span>
                          {(cell.onSale || !cell.taxesIncluded) && (
                            <div className="mt-0.5 flex justify-end gap-1">
                              {cell.onSale && <span className="chip chip-on">sale</span>}
                              {!cell.taxesIncluded && (
                                <span className="chip" style={{ color: 'var(--up)' }}>ex-tax</span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {anyExTax && (
        <p className="mt-3 text-xs" style={{ color: 'var(--up)' }}>
          ex-tax marks a resort that quotes before taxes and fees for that week. Its price is
          lower than what you would actually pay, so it is left out of each week&rsquo;s
          &ldquo;from&rdquo; figure and never counted as that resort&rsquo;s cheapest week.
        </p>
      )}
    </>
  );
}

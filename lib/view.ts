import { buildBookingUrl } from './booking';
import { read } from './db';
import { scoreAll } from './scoring';
import type { Criterion, Trip } from './types';
import { effectivePrice } from './types';

/** Flat, serializable shape handed to client components. */
export interface RankingRow {
  id: string;
  name: string;
  destination: string;
  transferMinutes: number | null;
  stars: number | null;
  status: string;
  tags: string[];
  score: number;
  disqualified: boolean;
  missingRequired: string[];
  /** Amenity state of the room you'd actually book. */
  met: Record<string, boolean>;
  /** Amenities the entry room already has — drives the "upgrade needed" hint. */
  entryMet: Record<string, boolean>;
  entryName: string | null;
  entryPrice: number | null;
  targetName: string | null;
  price: number | null;
  onSale: boolean;
  listPrice: number | null;
  delta: number | null;
  low: number | null;
  isLow: boolean;
  upgradeCost: number | null;
  valueIndex: number | null;
  source: string | null;
  capturedAt: string | null;
  bookingUrl: string | null;
  history: { date: string; value: number }[];
}

export function resolveTrip(tripId: string | undefined): Trip | null {
  const db = read();
  const active = db.trips.filter((t) => !t.archived);
  return active.find((t) => t.id === tripId) ?? active[0] ?? null;
}

export function buildRankings(trip: Trip | null): {
  rows: RankingRow[];
  criteria: Criterion[];
} {
  const db = read();
  const scored = scoreAll(db, trip);

  const rows: RankingRow[] = scored.map((s) => {
    const latest = s.target?.pricing.latest ?? null;
    const price = s.price;
    const entryPrice = s.entry?.pricing.latest
      ? effectivePrice(s.entry.pricing.latest)
      : null;

    // Collapse history to one point per day (the cheapest source that day) so
    // the chart shows the price you could actually have paid.
    const byDay = new Map<string, number>();
    for (const p of s.target?.pricing.history ?? []) {
      const day = p.capturedAt.slice(0, 10);
      const v = effectivePrice(p);
      byDay.set(day, Math.min(byDay.get(day) ?? Infinity, v));
    }

    return {
      id: s.resort.id,
      name: s.resort.name,
      destination: s.resort.destination,
      transferMinutes: s.resort.transferMinutes,
      stars: s.resort.stars,
      status: s.resort.status,
      tags: s.resort.tags,
      score: s.score,
      disqualified: s.disqualified,
      missingRequired: s.target?.missingRequired ?? [],
      met: s.target?.room.amenities ?? {},
      entryMet: s.entry?.room.amenities ?? {},
      entryName: s.entry?.room.name ?? null,
      entryPrice,
      targetName: s.target?.room.name ?? null,
      price,
      onSale: latest?.salePrice != null && latest.salePrice > 0,
      listPrice: latest?.price ?? null,
      delta: s.target?.pricing.delta ?? null,
      low: s.target?.pricing.low ?? null,
      isLow: price != null && s.target?.pricing.low != null && price <= s.target.pricing.low,
      upgradeCost: price != null && entryPrice != null ? price - entryPrice : null,
      valueIndex: s.valueIndex,
      source: latest?.source ?? null,
      capturedAt: latest?.capturedAt ?? null,
      bookingUrl: buildBookingUrl(s.resort, trip),
      history: [...byDay.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, value]) => ({ date, value })),
    };
  });

  return {
    rows,
    criteria: [...db.criteria].sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

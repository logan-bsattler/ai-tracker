import { buildBookingUrl } from './booking';
import { read } from './db';
import { scoreAll } from './scoring';
import type { Criterion, Trip } from './types';
import { effectivePrice, includesTaxes } from './types';

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
  entryUrl: string | null;
  entryPrice: number | null;
  targetName: string | null;
  targetUrl: string | null;
  /** How many rooms at this resort have a price for this trip. */
  pricedRooms: number;
  price: number | null;
  onSale: boolean;
  /** False when the quote excludes taxes, so it is not comparable as-is. */
  taxesIncluded: boolean;
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

    /**
     * Where a room's name should link to, best available first:
     *   1. an explicit room link, if the resort has a per-room page
     *   2. the resort's booking URL, rebuilt for the trip currently selected
     *   3. the page the last price was read from
     *
     * The booking URL outranks the stored snapshot URL because it is generated
     * for whichever trip you are looking at now, whereas a snapshot's URL is
     * frozen to the dates it was captured for - and would quietly send you to
     * the wrong week after a trip switch.
     */
    const linkFor = (r: typeof s.target) =>
      r?.room.url || buildBookingUrl(s.resort, trip) || r?.pricing.latest?.url || null;
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
      entryUrl: linkFor(s.entry),
      entryPrice,
      targetName: s.target?.room.name ?? null,
      targetUrl: linkFor(s.target),
      pricedRooms: s.rooms.filter((r) => r.pricing.latest != null).length,
      price,
      onSale: latest?.salePrice != null && latest.salePrice > 0,
      taxesIncluded: latest ? includesTaxes(latest) : true,
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

/**
 * Every trip's rankings in one payload.
 *
 * The published site is a static export with no server to read `?trip=` or
 * `?ids=`, so selection happens in the browser instead. The whole data set is
 * a few dozen rows, so shipping all of it to the client costs far less than
 * the machinery needed to avoid it — and it makes the dev and static builds
 * behave identically.
 */
export interface AllRankings {
  trips: Trip[];
  byTrip: Record<string, RankingRow[]>;
  criteria: Criterion[];
}

export function buildAllRankings(): AllRankings {
  const db = read();
  const trips = db.trips.filter((t) => !t.archived);
  const byTrip: Record<string, RankingRow[]> = {};
  for (const trip of trips) byTrip[trip.id] = buildRankings(trip).rows;

  return {
    trips,
    byTrip,
    criteria: [...db.criteria].sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

import { buildBookingUrl } from './booking';
import { read } from './db';
import { pricingFor } from './scoring';
import type { Trip } from './types';
import { effectivePrice, includesTaxes } from './types';
import type { CriterionLite, ResortLite, RoomLite } from './rank';

export type { RankingRow } from './rank';

/**
 * Everything the pages need, per trip, as plain data.
 *
 * Scores and the room pick are deliberately NOT computed here: they depend on
 * the criteria configuration, which a viewer can change in the browser on the
 * published site. lib/rank.ts turns this into rows, on either side.
 */
export interface AllRankings {
  trips: Trip[];
  resortsByTrip: Record<string, ResortLite[]>;
  criteria: CriterionLite[];
}

export function resortsFor(trip: Trip | null): ResortLite[] {
  const db = read();
  const tripId = trip?.id ?? null;

  const roomsFor = (resortId: string): RoomLite[] =>
    db.rooms
      .filter((r) => r.resortId === resortId)
      .map((room) => {
        const pricing = pricingFor(db, room.id, tripId);
        const latest = pricing.latest;

        // One point per day — the cheapest source seen that day — so the trend
        // reflects what could actually have been paid.
        const byDay = new Map<string, number>();
        for (const p of pricing.history) {
          const day = p.capturedAt.slice(0, 10);
          byDay.set(day, Math.min(byDay.get(day) ?? Infinity, effectivePrice(p)));
        }

        return {
          id: room.id,
          name: room.name,
          url: room.url ?? null,
          amenities: room.amenities,
          price: latest ? effectivePrice(latest) : null,
          listPrice: latest?.price ?? null,
          onSale: latest?.salePrice != null && latest.salePrice > 0,
          taxesIncluded: latest ? includesTaxes(latest) : true,
          low: pricing.low,
          delta: pricing.delta,
          history: [...byDay.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, value]) => ({ date, value })),
        } satisfies RoomLite;
      });

  return db.resorts.map((resort) => ({
    id: resort.id,
    name: resort.name,
    destination: resort.destination,
    transferMinutes: resort.transferMinutes,
    stars: resort.stars,
    status: resort.status,
    tags: resort.tags,
    bookingUrl: buildBookingUrl(resort, trip),
    pinnedRoomId: resort.pinnedRoomId ?? null,
    rooms: roomsFor(resort.id),
  }));
}

export function resolveTrip(tripId: string | undefined): Trip | null {
  const db = read();
  const active = db.trips.filter((t) => !t.archived);
  return active.find((t) => t.id === tripId) ?? active[0] ?? null;
}

/**
 * Every trip's data in one payload.
 *
 * The whole set is a few hundred rows, so shipping all of it costs far less
 * than the machinery needed to avoid it — and it is what lets the published
 * static site switch trips, compare resorts and re-weight criteria with no
 * server at all.
 */
export function buildAllRankings(): AllRankings {
  const db = read();
  const trips = db.trips.filter((t) => !t.archived);

  const resortsByTrip: Record<string, ResortLite[]> = {};
  for (const trip of trips) resortsByTrip[trip.id] = resortsFor(trip);

  return {
    trips,
    resortsByTrip,
    criteria: [...db.criteria]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ key: c.key, label: c.label, mode: c.mode })),
  };
}

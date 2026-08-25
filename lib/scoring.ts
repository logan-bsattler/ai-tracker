import type { Criterion, Database, PriceSnapshot, Resort, Room, Trip } from './types';
import { effectivePrice } from './types';

export interface RoomPricing {
  latest: PriceSnapshot | null;
  /** Every snapshot for this room+trip, oldest first. */
  history: PriceSnapshot[];
  /** Lowest effective price ever observed. */
  low: number | null;
  /** Change vs. the previous observation, in dollars. Negative is a drop. */
  delta: number | null;
}

export interface ScoredRoom {
  room: Room;
  pricing: RoomPricing;
  /** 0-100 share of available criterion weight that this room satisfies. */
  score: number;
  metKeys: string[];
  missedKeys: string[];
  /** Fails at least one criterion marked `required`. */
  disqualified: boolean;
  missingRequired: string[];
}

export interface ScoredResort {
  resort: Resort;
  rooms: ScoredRoom[];
  entry: ScoredRoom | null;
  /** The room you'd actually book — the basis for ranking. */
  target: ScoredRoom | null;
  /** Effective price of the target room, the headline number. */
  price: number | null;
  score: number;
  disqualified: boolean;
  /** Dollars per criterion-point — the "is the upgrade worth it" number. */
  valueIndex: number | null;
}

/** Best price source per room: cheapest latest observation across sources. */
export function pricingFor(
  db: Database, roomId: string, tripId: string | null,
): RoomPricing {
  const rows = db.prices
    .filter((p) => p.roomId === roomId && (!tripId || p.tripId === tripId))
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  if (rows.length === 0) return { latest: null, history: [], low: null, delta: null };

  // "Latest" = among snapshots taken in the most recent capture round, the
  // cheapest one. Comparing across sources is the whole point of tracking them.
  const newestStamp = rows[rows.length - 1].capturedAt;
  const newestDay = newestStamp.slice(0, 10);
  const sameRound = rows.filter((p) => p.capturedAt.slice(0, 10) === newestDay);
  const latest = sameRound.reduce((best, p) =>
    effectivePrice(p) < effectivePrice(best) ? p : best, sameRound[0]);

  const earlier = rows.filter((p) => p.capturedAt.slice(0, 10) < newestDay);
  let delta: number | null = null;
  if (earlier.length > 0) {
    const prevDay = earlier[earlier.length - 1].capturedAt.slice(0, 10);
    const prevRound = earlier.filter((p) => p.capturedAt.slice(0, 10) === prevDay);
    const prev = prevRound.reduce((best, p) =>
      effectivePrice(p) < effectivePrice(best) ? p : best, prevRound[0]);
    delta = effectivePrice(latest) - effectivePrice(prev);
  }

  const low = Math.min(...rows.map(effectivePrice));
  return { latest, history: rows, low, delta };
}

export function scoreRoom(
  room: Room, criteria: Criterion[], pricing: RoomPricing,
): ScoredRoom {
  const active = criteria.filter((c) => c.weight > 0);
  const total = active.reduce((s, c) => s + c.weight, 0);
  const met = active.filter((c) => room.amenities[c.key] === true);
  const earned = met.reduce((s, c) => s + c.weight, 0);

  const missingRequired = criteria
    .filter((c) => c.mode === 'required' && room.amenities[c.key] !== true)
    .map((c) => c.key);

  return {
    room,
    pricing,
    score: total > 0 ? Math.round((earned / total) * 100) : 0,
    metKeys: met.map((c) => c.key),
    missedKeys: active.filter((c) => room.amenities[c.key] !== true).map((c) => c.key),
    disqualified: missingRequired.length > 0,
    missingRequired,
  };
}

/** Effective price of a scored room, or null when it has never been priced. */
function priceOf(r: ScoredRoom): number | null {
  return r.pricing.latest ? effectivePrice(r.pricing.latest) : null;
}

/**
 * Which room would you actually book?
 *
 *   1. the pinned room, if one is set
 *   2. the cheapest room meeting every criterion marked `required`
 *   3. failing that, the best-matching room, cheapest among equals
 *
 * Rule 3 is the default when nothing is marked required, and it lands in the
 * same place as "cheapest room that has everything" whenever such a room
 * exists. Marking criteria required only matters when no room has it all —
 * then it decides whether the resort is disqualified rather than merely
 * scored low.
 */
function pickTarget(
  rooms: ScoredRoom[], resort: Resort, hasRequired: boolean,
): ScoredRoom | null {
  if (rooms.length === 0) return null;

  if (resort.pinnedRoomId) {
    const pinned = rooms.find((r) => r.room.id === resort.pinnedRoomId);
    if (pinned) return pinned;
  }

  const priced = rooms.filter((r) => priceOf(r) != null);
  const pool = priced.length > 0 ? priced : rooms;
  const cheapestFirst = (a: ScoredRoom, b: ScoredRoom) =>
    (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity);

  // Only meaningful once something is actually marked required — otherwise no
  // room is ever disqualified and "cheapest that qualifies" would collapse to
  // "cheapest", making the pick identical to the entry room everywhere.
  if (hasRequired) {
    const qualifying = pool.filter((r) => !r.disqualified);
    if (qualifying.length > 0) return [...qualifying].sort(cheapestFirst)[0];
  }

  return [...pool].sort((a, b) => b.score - a.score || cheapestFirst(a, b))[0];
}

export function scoreResort(
  db: Database, resort: Resort, trip: Trip | null,
): ScoredResort {
  const rooms = db.rooms
    .filter((r) => r.resortId === resort.id)
    .map((room) => scoreRoom(room, db.criteria, pricingFor(db, room.id, trip?.id ?? null)));

  // Cheapest is whatever actually costs least right now, not whichever room
  // the spreadsheet once labelled the cheapest.
  const priced = rooms.filter((r) => priceOf(r) != null);
  const entry = priced.length > 0
    ? [...priced].sort((a, b) => priceOf(a)! - priceOf(b)!)[0]
    : rooms.find((r) => r.room.tier === 'entry') ?? null;

  const hasRequired = db.criteria.some((c) => c.mode === 'required');
  const target = pickTarget(rooms, resort, hasRequired);

  const price = target?.pricing.latest ? effectivePrice(target.pricing.latest) : null;
  const score = target?.score ?? 0;

  return {
    resort,
    rooms,
    entry,
    target,
    price,
    score,
    disqualified: target?.disqualified ?? false,
    valueIndex: price != null && score > 0 ? Math.round(price / score) : null,
  };
}

export function scoreAll(db: Database, trip: Trip | null): ScoredResort[] {
  return db.resorts.map((r) => scoreResort(db, r, trip));
}

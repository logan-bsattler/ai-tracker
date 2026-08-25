// ---------------------------------------------------------------------------
// Ranking, as a pure function of data + a criteria configuration.
//
// This runs in both places: the server uses it to render the published pages,
// and the browser re-runs it when you reorder or switch off criteria on the
// live site. Nothing here touches the filesystem or the database — callers
// hand it plain values.
// ---------------------------------------------------------------------------

export interface RoomLite {
  id: string;
  name: string;
  url: string | null;
  amenities: Record<string, boolean>;
  /** Latest effective price (sale price when there is one), for this trip. */
  price: number | null;
  listPrice: number | null;
  onSale: boolean;
  taxesIncluded: boolean;
  low: number | null;
  delta: number | null;
  history: { date: string; value: number }[];
}

export interface ResortLite {
  id: string;
  name: string;
  destination: string;
  transferMinutes: number | null;
  stars: number | null;
  status: string;
  tags: string[];
  bookingUrl: string | null;
  pinnedRoomId: string | null;
  rooms: RoomLite[];
}

export type CriterionMode = 'optional' | 'required' | 'off';

export interface CriterionLite {
  key: string;
  label: string;
  mode: CriterionMode;
}

/**
 * A viewer's override of the published criteria. `order` is a list of keys,
 * most important first; `off` and `required` are key lists. Any field may be
 * omitted, in which case the published setting stands.
 */
export interface RankConfig {
  order?: string[];
  /** Keys switched off. Anything not listed keeps its published mode. */
  off?: string[];
  /** Keys marked required. */
  required?: string[];
}

export interface EffectiveCriterion extends CriterionLite {
  /** Derived from position among the enabled criteria: first is worth most. */
  weight: number;
}

/** Apply a viewer's overrides to the published criteria list. */
export function effectiveCriteria(
  published: CriterionLite[], config?: RankConfig | null,
): EffectiveCriterion[] {
  const byKey = new Map(published.map((c) => [c.key, c]));

  const order = config?.order?.length
    ? [
        ...config.order.filter((k) => byKey.has(k)),
        // Anything the config predates keeps its published position, at the end.
        ...published.map((c) => c.key).filter((k) => !config.order!.includes(k)),
      ]
    : published.map((c) => c.key);

  const list = order.map((key) => {
    const c = byKey.get(key)!;
    let mode = c.mode;
    // A config that names either list is authoritative for both, so a viewer
    // can clear a published `required` as well as set one.
    if (config?.off || config?.required) {
      mode = config.off?.includes(key) ? 'off'
        : config.required?.includes(key) ? 'required'
        : 'optional';
    }
    return { key, label: c.label, mode, weight: 0 };
  });

  const scoring = list.filter((c) => c.mode !== 'off');
  scoring.forEach((c, i) => { c.weight = scoring.length - i; });
  return list;
}

export interface ScoredRoomLite {
  room: RoomLite;
  score: number;
  met: string[];
  missing: string[];
  disqualified: boolean;
}

export function scoreRoomLite(room: RoomLite, criteria: EffectiveCriterion[]): ScoredRoomLite {
  const active = criteria.filter((c) => c.mode !== 'off' && c.weight > 0);
  const total = active.reduce((s, c) => s + c.weight, 0);
  const met = active.filter((c) => room.amenities[c.key] === true);
  const earned = met.reduce((s, c) => s + c.weight, 0);

  const missingRequired = criteria
    .filter((c) => c.mode === 'required' && room.amenities[c.key] !== true)
    .map((c) => c.key);

  return {
    room,
    score: total > 0 ? Math.round((earned / total) * 100) : 0,
    met: met.map((c) => c.key),
    missing: active.filter((c) => room.amenities[c.key] !== true).map((c) => c.key),
    disqualified: missingRequired.length > 0,
  };
}

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
  met: Record<string, boolean>;
  entryMet: Record<string, boolean>;
  entryName: string | null;
  entryUrl: string | null;
  entryPrice: number | null;
  targetName: string | null;
  targetUrl: string | null;
  price: number | null;
  onSale: boolean;
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
  pricedRooms: number;
  history: { date: string; value: number }[];
}

/**
 * Which room would you actually book?
 *
 *   1. the pinned room, if one is set
 *   2. the cheapest room meeting every criterion marked required
 *   3. failing that, the best-matching room, cheapest among equals
 *
 * Rule 2 only applies once something is actually marked required — otherwise
 * no room is ever disqualified and it would collapse into "cheapest", making
 * the pick identical to the entry room at every resort.
 */
function pickTarget(
  rooms: ScoredRoomLite[], resort: ResortLite, hasRequired: boolean,
): ScoredRoomLite | null {
  if (rooms.length === 0) return null;

  if (resort.pinnedRoomId) {
    const pinned = rooms.find((r) => r.room.id === resort.pinnedRoomId);
    if (pinned) return pinned;
  }

  const priced = rooms.filter((r) => r.room.price != null);
  const pool = priced.length > 0 ? priced : rooms;
  const cheapest = (a: ScoredRoomLite, b: ScoredRoomLite) =>
    (a.room.price ?? Infinity) - (b.room.price ?? Infinity);

  if (hasRequired) {
    const qualifying = pool.filter((r) => !r.disqualified);
    if (qualifying.length > 0) return [...qualifying].sort(cheapest)[0];
  }

  return [...pool].sort((a, b) => b.score - a.score || cheapest(a, b))[0];
}

export function rankResorts(
  resorts: ResortLite[],
  published: CriterionLite[],
  config?: RankConfig | null,
): { rows: RankingRow[]; criteria: EffectiveCriterion[] } {
  const criteria = effectiveCriteria(published, config);
  const hasRequired = criteria.some((c) => c.mode === 'required');

  const rows = resorts.map((resort) => {
    const scored = resort.rooms.map((r) => scoreRoomLite(r, criteria));

    const priced = scored.filter((r) => r.room.price != null);
    const entry = priced.length > 0
      ? [...priced].sort((a, b) => a.room.price! - b.room.price!)[0]
      : null;
    const target = pickTarget(scored, resort, hasRequired);

    const price = target?.room.price ?? null;
    const entryPrice = entry?.room.price ?? null;
    const score = target?.score ?? 0;

    return {
      id: resort.id,
      name: resort.name,
      destination: resort.destination,
      transferMinutes: resort.transferMinutes,
      stars: resort.stars,
      status: resort.status,
      tags: resort.tags,
      score,
      disqualified: target?.disqualified ?? false,
      missingRequired: target
        ? criteria.filter((c) => c.mode === 'required' && target.room.amenities[c.key] !== true)
            .map((c) => c.key)
        : [],
      met: target?.room.amenities ?? {},
      entryMet: entry?.room.amenities ?? {},
      entryName: entry?.room.name ?? null,
      entryUrl: entry?.room.url || resort.bookingUrl || null,
      entryPrice,
      targetName: target?.room.name ?? null,
      targetUrl: target?.room.url || resort.bookingUrl || null,
      price,
      onSale: target?.room.onSale ?? false,
      taxesIncluded: target?.room.taxesIncluded ?? true,
      listPrice: target?.room.listPrice ?? null,
      delta: target?.room.delta ?? null,
      low: target?.room.low ?? null,
      isLow: price != null && target?.room.low != null && price <= target.room.low,
      upgradeCost: price != null && entryPrice != null ? price - entryPrice : null,
      valueIndex: price != null && score > 0 ? Math.round(price / score) : null,
      source: null,
      capturedAt: target?.room.history[target.room.history.length - 1]?.date ?? null,
      bookingUrl: resort.bookingUrl,
      pricedRooms: priced.length,
      history: target?.room.history ?? [],
    } satisfies RankingRow;
  });

  return { rows, criteria };
}

/* -- URL encoding, so a weighting can be shared as a link ----------------- */

export function encodeConfig(c: RankConfig): URLSearchParams {
  const p = new URLSearchParams();
  if (c.order?.length) p.set('c', c.order.join('.'));
  if (c.off?.length) p.set('off', c.off.join('.'));
  if (c.required?.length) p.set('req', c.required.join('.'));
  return p;
}

export function decodeConfig(params: URLSearchParams): RankConfig | null {
  const split = (v: string | null) => (v ? v.split('.').filter(Boolean) : undefined);
  const order = split(params.get('c'));
  const off = split(params.get('off'));
  const required = split(params.get('req'));
  if (!order && !off && !required) return null;
  return { order, off, required };
}

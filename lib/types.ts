// ---------------------------------------------------------------------------
// Core domain types.
//
// The spreadsheet encoded amenities as "Yes" / "No" / "Best Room", where
// "Best Room" meant *the amenity only comes with the upgraded room*. That is
// really a per-room fact, not a per-resort fact, so here amenities live on the
// room. The old "Best Room" value falls out naturally: the cheap room says no,
// the upgrade room says yes.
// ---------------------------------------------------------------------------

export type Id = string;

// ---------------------------------------------------------------------------
// Media.
//
// Everything here is somebody else's content, so the shapes below are built to
// point at it rather than copy it:
//
//   photos  — hotlinked from the resort's own site, with a credit. The resort
//             publishes these to be seen; we never re-host them.
//   reviews — the aggregate score only. "4.4 from 16,531 reviews" is a fact
//             about a page; the review text itself belongs to the review site,
//             so we link out instead of reproducing any of it.
//   videos  — YouTube ids. YouTube is built to be embedded and the creator
//             keeps their view count, so embedding is the friendly option.
// ---------------------------------------------------------------------------

/** One image, hosted wherever it already lives. */
export interface Photo {
  url: string;
  caption: string | null;
  /** Shown as attribution under the image. */
  credit: string | null;
}

/** An aggregate rating. Deliberately never individual reviews — see above. */
export interface ReviewScore {
  /** "TripAdvisor", "Google", "Booking.com", … */
  source: string;
  score: number;
  /** Scales differ: TripAdvisor is out of 5, Booking.com out of 10. */
  outOf: number;
  count: number | null;
  /** Where to go and actually read them. */
  url: string | null;
  capturedAt: string;
}

/** A walkthrough or review video. */
export interface VideoRef {
  youtubeId: string;
  title: string;
  channel: string | null;
}

export interface Resort {
  id: Id;
  name: string;
  destination: string;
  /** Airport code or name the transfer time is measured from. */
  airport: string;
  /** Ground transfer time from the airport, in minutes. */
  transferMinutes: number | null;
  stars: number | null;
  /** Adults-only, 18+, family, etc. Free-form tag list. */
  tags: string[];
  /**
   * Direct booking URL. May contain {checkIn} {checkOut} {adults} {children}
   * {nights} placeholders, which are substituted per trip so one click lands
   * on the right availability search.
   */
  bookingUrlTemplate: string | null;
  websiteUrl: string | null;
  /** Hero shot. Falls back to the first entry in `photos` when unset. */
  imageUrl: string | null;
  photos: Photo[];
  videos: VideoRef[];
  reviews: ReviewScore[];
  /**
   * Used for the map. Absent means the map falls back to searching the
   * resort's name, which is usually good enough for a beach resort.
   */
  lat: number | null;
  lng: number | null;
  notes: string;
  status: 'active' | 'closed' | 'watchlist';
  /**
   * Pin a specific room as the one you'd book, overriding the automatic pick.
   * Null means let scoring choose — see pickTarget() in scoring.ts.
   */
  pinnedRoomId: Id | null;
  createdAt: string;
}

export interface Room {
  id: Id;
  resortId: Id;
  name: string;
  /**
   * Kept from the spreadsheet import, but no longer what drives the ranking:
   * with every room tracked, "cheapest" and "the one you'd book" are derived
   * from live prices and criteria instead. See scoring.ts.
   */
  tier: 'entry' | 'target' | 'other';
  /** criteriaKey -> met. Absent key means "unknown", which scores as not met. */
  amenities: Record<string, boolean>;
  /**
   * Direct link to this specific room, when the resort has one. Most booking
   * engines list every room on a single availability page, so this is usually
   * empty and the link falls back to the resort's dated booking URL.
   */
  url: string | null;
  photos: Photo[];
  notes: string;
}

/**
 * How much a criterion binds:
 *
 *   optional — counts toward the match score, by its weight
 *   required — as above, and a room missing it is disqualified outright
 *   off      — plays no part in scoring at all, without being deleted
 *
 * One tri-state rather than two booleans, because "off but required" never
 * meant anything and was reachable in the old two-checkbox version.
 */
export type CriterionMode = 'optional' | 'required' | 'off';

/** A user-defined comparison criterion, e.g. "Soaking Tub". */
export interface Criterion {
  id: Id;
  key: string;
  label: string;
  /**
   * Derived from rank, never edited directly: the criterion at the top of the
   * list carries the most weight. Recomputed by recomputeWeights() whenever
   * the list is reordered or a mode changes. Anything off is 0.
   */
  weight: number;
  mode: CriterionMode;
  /** Position in the priority list. 0 is most important. */
  sortOrder: number;
}

/**
 * Weight follows position: with N enabled criteria the first is worth N, the
 * last 1. Ranking things against each other is far easier than inventing
 * numbers for them, and the numbers were never meaningful on their own.
 */
export function recomputeWeights(criteria: Criterion[]): void {
  const ordered = [...criteria].sort((a, b) => a.sortOrder - b.sortOrder);
  ordered.forEach((c, i) => { c.sortOrder = i; });
  const scoring = ordered.filter((c) => c.mode !== 'off');
  scoring.forEach((c, i) => { c.weight = scoring.length - i; });
  for (const c of ordered) if (c.mode === 'off') c.weight = 0;
}

/** A set of travel dates being shopped. Every price belongs to one. */
export interface Trip {
  id: Id;
  label: string;
  checkIn: string;  // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  adults: number;
  children: number;
  archived: boolean;
}

export type PriceSource =
  | 'resort-direct'
  | 'cheapcaribbean'
  | 'allinclusiveoutlet'
  | 'costco'
  | 'expedia'
  | 'other';

/**
 * One observation of one room's price, for one trip, from one source, at one
 * point in time. Never updated in place — a new price is a new row, which is
 * what makes the history charts possible.
 */
export interface PriceSnapshot {
  id: Id;
  roomId: Id;
  tripId: Id;
  source: PriceSource;
  /** Total package/stay price as advertised, before any sale. */
  price: number;
  /** Discounted price if the resort is running a sale. */
  salePrice: number | null;
  currency: string;
  /**
   * Whether `price` already includes taxes and fees.
   *
   * Most resorts quote all-in, but some (Punta Cana Princess) quote before
   * tax, which in the Dominican Republic is roughly 28% once ITBIS and the
   * service charge are added. Comparing the two directly makes an ex-tax
   * resort look far cheaper than it is, so the figure travels with the flag
   * rather than being silently grossed up to something nobody quoted.
   */
  taxesIncluded: boolean;
  url: string | null;
  notes: string;
  capturedAt: string; // ISO timestamp
}

export interface Database {
  resorts: Resort[];
  rooms: Room[];
  criteria: Criterion[];
  trips: Trip[];
  prices: PriceSnapshot[];
  meta: { version: number };
}

/** The price you actually pay: the sale price when there is one. */
export function effectivePrice(p: PriceSnapshot): number {
  return p.salePrice != null && p.salePrice > 0 ? p.salePrice : p.price;
}

/**
 * Older snapshots predate the flag. They were all captured from tax-inclusive
 * quotes, so absent means included.
 */
export function includesTaxes(p: PriceSnapshot): boolean {
  return p.taxesIncluded !== false;
}

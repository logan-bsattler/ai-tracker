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
  imageUrl: string | null;
  notes: string;
  status: 'active' | 'closed' | 'watchlist';
  createdAt: string;
}

export interface Room {
  id: Id;
  resortId: Id;
  name: string;
  /**
   * 'entry'   = cheapest bookable room (the old "Cheapest Room" column)
   * 'target'  = the room you'd actually book (the old "Best Room for Us")
   * 'other'   = anything else worth tracking
   */
  tier: 'entry' | 'target' | 'other';
  /** criteriaKey -> met. Absent key means "unknown", which scores as not met. */
  amenities: Record<string, boolean>;
  notes: string;
}

/** A user-defined comparison criterion, e.g. "Soaking Tub". */
export interface Criterion {
  id: Id;
  key: string;
  label: string;
  /** Relative importance when computing a match score. 0 disables it. */
  weight: number;
  /** Hard requirement: rooms that fail it are flagged as disqualified. */
  required: boolean;
  sortOrder: number;
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

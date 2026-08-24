import type { Resort, Trip } from './types';

/**
 * Resorts each run their own booking engine, so instead of scraping them we
 * store a URL template per resort and inject the trip's dates. One click from
 * any resort row lands on that resort's own availability search, pre-filled.
 *
 * Supported placeholders (case-sensitive):
 *   {checkIn} {checkOut}          ISO  2027-04-17
 *   {checkInUS} {checkOutUS}      US   04/17/2027
 *   {checkInUSEnc} {checkOutUSEnc} US, URL-encoded  04%2F17%2F2027
 *   {checkInEU} {checkOutEU}      EU   17/04/2027
 *   {checkInEUEnc} {checkOutEUEnc} EU, URL-encoded  17%2F04%2F2027
 *   {checkInCompact}              flat 20270417
 *   {adults} {children} {nights}
 *
 * The *Enc variants exist because some engines (Iberostar) carry the date
 * inside a query value and reject a literal slash there.
 */
export function buildBookingUrl(resort: Resort, trip: Trip | null): string | null {
  const tpl = resort.bookingUrlTemplate?.trim();
  if (!tpl) return resort.websiteUrl?.trim() || null;
  if (!trip) return tpl.replace(/\{[a-zA-Z]+\}/g, '');

  const us = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${m}/${d}/${y}`;
  };
  const eu = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const subs: Record<string, string> = {
    checkIn: trip.checkIn,
    checkOut: trip.checkOut,
    checkInUS: us(trip.checkIn),
    checkOutUS: us(trip.checkOut),
    checkInUSEnc: encodeURIComponent(us(trip.checkIn)),
    checkOutUSEnc: encodeURIComponent(us(trip.checkOut)),
    checkInEU: eu(trip.checkIn),
    checkOutEU: eu(trip.checkOut),
    checkInEUEnc: encodeURIComponent(eu(trip.checkIn)),
    checkOutEUEnc: encodeURIComponent(eu(trip.checkOut)),
    checkInCompact: trip.checkIn.replace(/-/g, ''),
    checkOutCompact: trip.checkOut.replace(/-/g, ''),
    adults: String(trip.adults),
    children: String(trip.children),
    nights: String(nights(trip)),
  };

  return tpl.replace(/\{([a-zA-Z]+)\}/g, (m, key) => subs[key] ?? m);
}

export function nights(trip: Trip): number {
  const ms = Date.parse(trip.checkOut) - Date.parse(trip.checkIn);
  return Math.max(1, Math.round(ms / 86_400_000));
}

export const SOURCE_LABELS: Record<string, string> = {
  'resort-direct': 'Resort Direct',
  cheapcaribbean: 'CheapCaribbean',
  allinclusiveoutlet: 'All Inclusive Outlet',
  costco: 'Costco Travel',
  expedia: 'Expedia',
  other: 'Other',
};

/** Search URLs for the aggregators, for quick cross-checking against direct. */
export function comparisonLinks(resort: Resort, trip: Trip | null) {
  const q = encodeURIComponent(resort.name);
  const dates = trip ? `&checkIn=${trip.checkIn}&checkOut=${trip.checkOut}` : '';
  return [
    { label: 'CheapCaribbean', url: `https://www.cheapcaribbean.com/search?q=${q}${dates}` },
    { label: 'All Inclusive Outlet', url: `https://www.allinclusiveoutlet.com/search?q=${q}` },
    { label: 'Google', url: `https://www.google.com/search?q=${q}+all+inclusive+rates` },
  ];
}

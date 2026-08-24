// ---------------------------------------------------------------------------
// Prints the worklist for a refresh run: every resort to price, the URL to
// open, and the rooms to look for.
//
//   node scripts/refresh-queue.mjs              # human-readable
//   node scripts/refresh-queue.mjs --json       # machine-readable
//   node scripts/refresh-queue.mjs --trip 2027  # a specific date range
//   node scripts/refresh-queue.mjs --stale 7    # only resorts not priced in 7 days
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

const db = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'db.json'), 'utf8'));

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const key = process.argv[i].slice(2);
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[key] = true;
  else { args[key] = next; i++; }
}

const activeTrips = db.trips.filter((t) => !t.archived);
const trip = args.trip && args.trip !== true
  ? activeTrips.find((t) => t.id === args.trip || t.label.toLowerCase().includes(String(args.trip).toLowerCase()))
  : activeTrips[0];

if (!trip) {
  console.error('no matching active trip');
  process.exit(1);
}

const nights = Math.max(1, Math.round((Date.parse(trip.checkOut) - Date.parse(trip.checkIn)) / 86_400_000));

/** Mirrors lib/booking.ts so the CLI and the app build identical URLs. */
function buildBookingUrl(resort) {
  const tpl = resort.bookingUrlTemplate;
  if (!tpl) return null;
  const us = (iso) => { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };
  const eu = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const subs = {
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
    nights: String(nights),
  };
  return tpl.replace(/\{([a-zA-Z]+)\}/g, (m, k) => subs[k] ?? m);
}

const staleDays = args.stale && args.stale !== true ? Number(args.stale) : null;
const now = Date.now();

const items = db.resorts
  .filter((r) => r.status !== 'closed')
  .map((resort) => {
    const rooms = db.rooms.filter((r) => r.resortId === resort.id);
    const prices = db.prices.filter(
      (p) => p.tripId === trip.id && rooms.some((r) => r.id === p.roomId),
    );
    const lastSeen = prices.map((p) => p.capturedAt).sort().pop() ?? null;

    const effective = (p) => (p.salePrice != null && p.salePrice > 0 ? p.salePrice : p.price);
    const lastFor = (room) => {
      const forRoom = prices
        .filter((p) => p.roomId === room.id)
        .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
        .pop();
      return forRoom ? effective(forRoom) : null;
    };

    return {
      resortId: resort.id,
      resort: resort.name,
      destination: resort.destination,
      bookingUrl: buildBookingUrl(resort),
      websiteUrl: resort.websiteUrl,
      searchUrl: `https://www.cheapcaribbean.com/search?q=${encodeURIComponent(resort.name)}`,
      lastSeen,
      staleDays: lastSeen ? Math.floor((now - Date.parse(lastSeen)) / 86_400_000) : null,
      rooms: rooms.map((r) => ({ tier: r.tier, name: r.name, lastPrice: lastFor(r) })),
    };
  })
  .filter((i) => staleDays == null || i.staleDays == null || i.staleDays >= staleDays);

const payload = {
  trip: {
    id: trip.id, label: trip.label, checkIn: trip.checkIn, checkOut: trip.checkOut,
    nights, adults: trip.adults, children: trip.children,
  },
  needsBookingUrl: items.filter((i) => !i.bookingUrl).map((i) => i.resort),
  items,
};

if (args.json) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  const t = payload.trip;
  console.log(`Trip: ${t.label}  ${t.checkIn} -> ${t.checkOut}  (${t.nights} nights, ${t.adults} adults)`);
  console.log(`${items.length} resorts to price\n`);
  for (const i of items) {
    const age = i.staleDays == null ? 'never priced' : `${i.staleDays}d old`;
    console.log(`${i.resort}  [${i.destination}]  (${age})`);
    console.log(`  url: ${i.bookingUrl ?? i.websiteUrl ?? '(none — search: ' + i.searchUrl + ')'}`);
    for (const r of i.rooms) {
      console.log(`  ${r.tier.padEnd(6)} ${r.name}${r.lastPrice != null ? `  (last $${r.lastPrice})` : ''}`);
    }
    console.log('');
  }
  if (payload.needsBookingUrl.length) {
    console.log(`No booking URL set for: ${payload.needsBookingUrl.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Records one price observation from the command line.
//
// This is the write end of the automated refresh: the scheduled Claude job
// reads a booking page, then calls this once per room it found a price for.
// Keeping the write in a script (rather than letting the agent edit db.json
// directly) means the file can only ever change in one validated shape.
//
//   node scripts/record-price.mjs --resort "TRS Turquesa" --room target \
//        --price 2545 --sale 2160 --source resort-direct --url https://...
//
// Options:
//   --resort   resort id, or any unambiguous part of its name   (required)
//   --room     entry | target | a room id | part of a room name (default target)
//   --price    list price                                       (required)
//   --sale     discounted price, if the resort is running one
//   --source   resort-direct | cheapcaribbean | allinclusiveoutlet |
//              costco | expedia | other                    (default resort-direct)
//   --trip     trip id or part of its label      (default: first active trip)
//   --url      page the price came from
//   --notes    free text
//   --ex-tax   the quote excludes taxes and fees (default: taxes included)
//   --dry-run  print what would be written, change nothing
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

const SOURCES = [
  'resort-direct', 'cheapcaribbean', 'allinclusiveoutlet', 'costco', 'expedia', 'other',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

function fail(message) {
  console.error('error: ' + message);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

if (!fs.existsSync(DB_PATH)) fail('data/db.json not found — run from the project root.');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

/**
 * Match by id, then by exact name, then by a unique name fragment.
 *
 * The exact-name step matters because real room names nest: "Junior Suite
 * Deluxe" is a prefix of "Junior Suite Deluxe Corner", so fragment matching
 * alone would call the exact name ambiguous.
 */
function pick(items, needle, label, nameOf) {
  if (!needle || needle === true) return null;
  const exact = items.find((i) => i.id === needle);
  if (exact) return exact;

  const q = String(needle).toLowerCase();
  const byName = items.filter((i) => nameOf(i).toLowerCase() === q);
  if (byName.length === 1) return byName[0];

  const matches = items.filter((i) => nameOf(i).toLowerCase().includes(q));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) fail(`no ${label} matches "${needle}"`);
  fail(`"${needle}" matches ${matches.length} ${label}s: ${matches.map(nameOf).join(', ')}`);
}

// -- resort ---------------------------------------------------------------
if (!args.resort) fail('--resort is required');
const resort = pick(db.resorts, args.resort, 'resort', (r) => r.name);

// -- room -----------------------------------------------------------------
const rooms = db.rooms.filter((r) => r.resortId === resort.id);
if (rooms.length === 0) fail(`${resort.name} has no rooms`);

const roomArg = args.room === undefined ? 'target' : args.room;
let room;
if (roomArg === 'entry' || roomArg === 'target') {
  room = rooms.find((r) => r.tier === roomArg);
  if (!room) fail(`${resort.name} has no "${roomArg}" room`);
} else {
  room = pick(rooms, roomArg, 'room', (r) => r.name);
}

// -- trip -----------------------------------------------------------------
const activeTrips = db.trips.filter((t) => !t.archived);
if (activeTrips.length === 0) fail('no active trips — add a date range first');
const trip = args.trip
  ? pick(activeTrips, args.trip, 'trip', (t) => t.label)
  : activeTrips[0];

// -- price ----------------------------------------------------------------
const toNumber = (v, name) => {
  if (v === undefined || v === true) return null;
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0) fail(`--${name} must be a positive number, got "${v}"`);
  return n;
};

const price = toNumber(args.price, 'price');
if (price == null) fail('--price is required');
const salePrice = toNumber(args.sale, 'sale');
if (salePrice != null && salePrice > price) {
  fail(`--sale (${salePrice}) is higher than --price (${price}); check which is which`);
}

const source = args.source === undefined ? 'resort-direct' : String(args.source);
if (!SOURCES.includes(source)) fail(`--source must be one of: ${SOURCES.join(', ')}`);

const snapshot = {
  id: `price_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
  roomId: room.id,
  tripId: trip.id,
  source,
  price,
  salePrice,
  currency: 'USD',
  taxesIncluded: args['ex-tax'] !== true,
  url: typeof args.url === 'string' ? args.url : null,
  notes: typeof args.notes === 'string' ? args.notes : '',
  capturedAt: new Date().toISOString(),
};

// Report the change so the job's log shows movement, not just a write.
const previous = db.prices
  .filter((p) => p.roomId === room.id && p.tripId === trip.id)
  .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
  .pop();
const effective = (p) => (p.salePrice != null && p.salePrice > 0 ? p.salePrice : p.price);
const delta = previous ? effective(snapshot) - effective(previous) : null;

const summary =
  `${resort.name} · ${room.name} · ${trip.label}\n` +
  `  ${source}  $${price}${salePrice != null ? ` (sale $${salePrice})` : ''}` +
  (snapshot.taxesIncluded ? '' : ' [EX-TAX]') +
  (delta == null ? '  [first observation]'
    : delta === 0 ? '  [unchanged]'
    : `  [${delta > 0 ? '+' : ''}$${delta} vs $${effective(previous)}]`);

if (args['dry-run']) {
  console.log('dry run — nothing written\n' + summary);
  process.exit(0);
}

db.prices.push(snapshot);

const tmp = `${DB_PATH}.${process.pid}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
fs.renameSync(tmp, DB_PATH);

console.log('recorded: ' + summary);

// Imports a resort's full room list, derives each room's amenities from its
// own name and description, and records a price for any room that has one.
//
//   node scripts/import-rooms.mjs rooms.json [--trip <id|label>] [--dry-run]
//
// Input shape:
//   { "resort": "TRS Turquesa",
//     "url": "https://...",
//     "exTax": false,
//     "rooms": [ { "name": "...", "desc": "...", "price": 5200, "sale": 3143 } ] }
//
// Amenities are matched against the resort's own wording, never guessed from
// price or tier. A room that doesn't say it has something is recorded as not
// having it — the same standard the price capture uses.
import fs from 'node:fs';

const RULES = {
  'ocean-front': /ocean[\s-]?front|oceanfront|beach[\s-]?front|beachfront|sea[\s-]?front|beach[\s-]?side|beachside/i,
  oceanview: /ocean[\s-]?view|oceanview|sea[\s-]?view|ocean[\s-]?front|oceanfront|beach[\s-]?front|beachfront|beach[\s-]?side|beachside/i,
  'swim-up': /swim[\s-]?up|swim[\s-]?out/i,
  'plunge-pool': /plunge pool|private pool|private plunge|with pool|swimming pool\b/i,
  'butler-club': /butler|excellence club|preferred club|elegance club|the level|premium level|privileged|club tier|concierge/i,
  'soaking-tub': /jacuzzi|whirlpool|hot[\s-]?tub|soaking tub|jetted|hydro[\s-]?massage/i,
};

/** Ocean front implies ocean view; the regexes above already encode that. */
function derive(text, inherited) {
  const out = {};
  for (const [key, rx] of Object.entries(RULES)) out[key] = rx.test(text);
  // Room service is a resort-level service, never stated per room, so it is
  // carried over from the rooms already tracked rather than invented.
  out['room-service'] = inherited['room-service'] ?? false;
  return out;
}

const args = {};
const positional = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) { positional.push(a); continue; }
  const key = a.slice(2);
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[key] = true;
  else { args[key] = next; i++; }
}

const payload = JSON.parse(fs.readFileSync(positional[0], 'utf8'));
const path = 'data/db.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));

const resort = db.resorts.find(
  (r) => r.id === payload.resort || r.name.toLowerCase().includes(String(payload.resort).toLowerCase()),
);
if (!resort) { console.error('no resort matching ' + payload.resort); process.exit(1); }

const active = db.trips.filter((t) => !t.archived);
const trip = args.trip
  ? active.find((t) => t.id === args.trip || t.label.toLowerCase().includes(String(args.trip).toLowerCase()))
  : active[0];
if (!trip) { console.error('no matching trip'); process.exit(1); }

const existing = db.rooms.filter((r) => r.resortId === resort.id);
// Whatever the tracked rooms already say about room service.
const inherited = {
  'room-service': existing.some((r) => r.amenities['room-service'] === true),
};

const capturedAt = new Date().toISOString();
let addedRooms = 0, updatedRooms = 0, prices = 0;
const lines = [];

for (const r of payload.rooms) {
  const text = `${r.name} ${r.desc ?? ''}`;
  const amenities = derive(text, inherited);

  let room = db.rooms.find(
    (x) => x.resortId === resort.id && x.name.toLowerCase() === r.name.toLowerCase(),
  );
  if (room) {
    // Only ever add. A room already carrying curated amenities from the
    // spreadsheet must not be downgraded because a truncated description
    // happens not to mention something — derivation is weaker evidence than
    // a human having looked.
    const merged = { ...room.amenities };
    for (const [k, v] of Object.entries(amenities)) if (v) merged[k] = true;
    room.amenities = merged;
    updatedRooms++;
  } else {
    room = {
      id: `room_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      resortId: resort.id,
      name: r.name,
      tier: 'other',
      amenities,
      url: r.url ?? null,
      notes: '',
    };
    db.rooms.push(room);
    addedRooms++;
  }

  if (r.price != null) {
    db.prices.push({
      id: `price_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      roomId: room.id,
      tripId: trip.id,
      source: payload.source ?? 'resort-direct',
      price: r.price,
      salePrice: r.sale ?? null,
      currency: 'USD',
      taxesIncluded: payload.exTax !== true,
      url: payload.url ?? null,
      notes: r.notes ?? '',
      capturedAt,
    });
    prices++;
  }

  const on = Object.entries(amenities).filter(([, v]) => v).map(([k]) => k);
  lines.push(`  ${r.price != null ? ('$' + r.price).padStart(7) : '      -'}  ${r.name.slice(0, 46).padEnd(48)} ${on.join(' ')}`);
}

if (args['dry-run']) {
  console.log(`DRY RUN — ${resort.name} / ${trip.label}`);
  console.log(lines.join('\n'));
  process.exit(0);
}

fs.writeFileSync(path, JSON.stringify(db, null, 2));
console.log(`${resort.name} / ${trip.label}: +${addedRooms} rooms, ${updatedRooms} updated, ${prices} prices`);
console.log(lines.join('\n'));

// One-off: the resorts renamed or retired the room categories the spreadsheet
// recorded, so the refresh job could no longer match them and skipped those
// rooms. Each new name below was read off the resort's own booking page for
// the April 2027 dates on 2026-08-24.
//
// Renaming keeps each room's price history attached. The only prior snapshots
// are the spreadsheet baseline, which already sits on an archived trip labelled
// "dates unknown", so nothing gains a false precision it didn't have.
import fs from 'node:fs';

const RENAMES = [
  {
    resort: 'Serenade All Suites',
    from: 'Junior Suite Garden View',
    to: 'Luxury Tropical Garden View',
    // Cheapest room on offer. Garden/pool view, no jacuzzi.
    amenities: { 'room-service': true, oceanview: false, 'soaking-tub': false },
  },
  {
    resort: 'Serenade All Suites',
    from: 'Junior Suite Ocean Front View',
    to: 'Luxury Suite Ocean View Outdoor Jacuzzi',
    // Sea view + outdoor jacuzzi, per the resort's own description.
    amenities: { 'room-service': true, oceanview: true, 'soaking-tub': true },
  },
  {
    resort: 'Excellence Oyster Bay',
    from: 'Junior Suite Run of the House',
    to: 'Junior Suite',
    amenities: { 'room-service': true, oceanview: false, 'soaking-tub': false },
  },
  {
    resort: 'Excellence Oyster Bay',
    from: 'Excellence Club Junior Suite Ocean Front',
    to: 'Excellence Club Junior Suite Partial Ocean View',
    // JUDGEMENT CALL: there is no longer an "Excellence Club Junior Suite Ocean
    // Front". This is the closest equivalent - same tier, Excellence Club, with
    // an ocean view - and the cheapest club suite that has one. The nearest
    // true ocean-front club option is the Rooftop Terrace Suite with Plunge
    // Pool at about $680 more.
    amenities: { 'room-service': true, oceanview: true, 'soaking-tub': true },
  },
  {
    resort: 'JOIA Rose Hall by Iberostar',
    from: 'Suite',
    to: 'Jacuzzi Suite',
    // Cheapest room on offer. Named for its jacuzzi, so it gains the tub the
    // plain "Suite" did not have.
    amenities: { 'room-service': true, oceanview: false, 'soaking-tub': true },
  },
];

const path = 'data/db.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));
let done = 0;

for (const r of RENAMES) {
  const resort = db.resorts.find((x) => x.name === r.resort);
  if (!resort) { console.error('no resort: ' + r.resort); continue; }
  const room = db.rooms.find((x) => x.resortId === resort.id && x.name === r.from);
  if (!room) { console.error(`no room "${r.from}" at ${r.resort}`); continue; }

  room.name = r.to;
  room.amenities = { ...room.amenities, ...r.amenities };
  const note = `Renamed from "${r.from}" (2026-08-24); the resort no longer offers that category.`;
  room.notes = room.notes ? `${room.notes} ${note}` : note;
  done++;
  console.log(`${r.resort}: "${r.from}" -> "${r.to}"`);
}

fs.writeFileSync(path, JSON.stringify(db, null, 2));
console.log(`\nrenamed ${done} rooms`);

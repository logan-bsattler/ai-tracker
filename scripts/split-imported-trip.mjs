// One-off repair.
//
// The spreadsheet's prices were captured for dates it never recorded. They were
// seeded against a placeholder trip, and when that trip was later re-dated to
// April 2027 they were silently relabelled as April 2027 prices — so the first
// real refresh compared 2027 rates against an unrelated date range and reported
// a 1.4x-2.5x "increase" that is mostly an artifact.
//
// This moves the imported snapshots onto their own archived trip. Nothing is
// deleted: the spreadsheet baseline is still there, just no longer pretending
// to describe dates it doesn't.
import fs from 'node:fs';

const path = 'data/db.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));

const LEGACY_ID = 'trip_spreadsheet_baseline';
const CUTOFF = '2026-01-01'; // imported rows are stamped 2025-01-15

if (db.trips.some((t) => t.id === LEGACY_ID)) {
  console.log('already split; nothing to do');
  process.exit(0);
}

const active = db.trips.find((t) => t.id === 'trip_imported');
if (!active) throw new Error('trip_imported not found');

db.trips.push({
  id: LEGACY_ID,
  label: 'Original spreadsheet (dates unknown)',
  // The sheet never recorded its dates. These are placeholders purely so the
  // record is well-formed; the label is the honest part.
  checkIn: '2025-01-15',
  checkOut: '2025-01-22',
  adults: active.adults,
  children: active.children,
  archived: true,
});

let moved = 0;
for (const p of db.prices) {
  if (p.tripId === 'trip_imported' && p.capturedAt < CUTOFF) {
    p.tripId = LEGACY_ID;
    moved++;
  }
}

fs.writeFileSync(path, JSON.stringify(db, null, 2));

const remaining = db.prices.filter((p) => p.tripId === 'trip_imported').length;
console.log(`moved ${moved} imported snapshots to "${LEGACY_ID}" (archived)`);
console.log(`April 2027 now holds ${remaining} observations, all captured for those dates`);

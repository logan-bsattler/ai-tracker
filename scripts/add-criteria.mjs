// Adds the four new criteria and re-scopes the existing "Oceanview".
//
// Ocean front and ocean view are split because resorts price them very
// differently — at Rose Hall the gap is over $1,300 for the same week. Rooms
// that were flagged oceanview keep that flag; ocean-front is set only where a
// room's own name or description says so, which the room import does.
import fs from 'node:fs';

const NEW = [
  { key: 'ocean-front', label: 'Ocean Front', weight: 2, required: false },
  { key: 'swim-up', label: 'Swim-up / Swim-out', weight: 1, required: false },
  { key: 'plunge-pool', label: 'Private Plunge Pool', weight: 1, required: false },
  { key: 'butler-club', label: 'Butler / Club Tier', weight: 1, required: false },
];

const path = 'data/db.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));

// Clarify the existing one now that it has a sibling.
const ov = db.criteria.find((c) => c.key === 'oceanview');
if (ov) ov.label = 'Ocean View';

let added = 0;
for (const c of NEW) {
  if (db.criteria.some((x) => x.key === c.key)) continue;
  db.criteria.push({
    id: `crit_${c.key}`,
    ...c,
    sortOrder: db.criteria.length,
  });
  added++;
}

// New criteria start unset on every room; the import fills them in.
for (const room of db.rooms) {
  for (const c of NEW) {
    if (room.amenities[c.key] === undefined) room.amenities[c.key] = false;
  }
}

fs.writeFileSync(path, JSON.stringify(db, null, 2));
console.log(`added ${added} criteria; ${db.criteria.length} total`);
for (const c of db.criteria) console.log(`  ${c.label} (weight ${c.weight}${c.required ? ', required' : ''})`);

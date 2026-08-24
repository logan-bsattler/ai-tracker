// ---------------------------------------------------------------------------
// Imports the original "All Inclusive.xlsx" into the app's data store.
//
// Faithful translation of the sheet's semantics:
//   Room Service / Oceanview / Soaking Tub = "Yes"       -> both rooms have it
//                                            "24-hour"   -> both, + a resort tag
//                                            "No"        -> neither room has it
//                                            "Best Room" -> only the target room
//   Column M ("Criteria") was a rollup formula; the scoring engine replaces it.
//   Column N was `if(sale="", price2, sale)`; effectivePrice() replaces it.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

const CAPTURED_AT = '2025-01-15T12:00:00.000Z'; // when the sheet was last updated

// [name, location, airport, cheapRoom, price1, targetRoom, price2, sale, stars,
//  roomService, oceanview, soakingTub]
const ROWS = [
  ['Bahia Principe Luxury Ambar', 'Punta Cana', '32 min', 'Junior Suite Deluxe', 1324, 'Junior Suite Deluxe Corner', 1417, 1331, 5, '24-hour', 'No', 'Best Room'],
  ['Barcelo Bavaro Beach', 'Punta Cana', '26 min', 'Superior Room', 1367, 'Superior Ocean Front Premium Level', 2139, 1596, 5, 'Best Room', 'Best Room', 'No'],
  ['Punta Cana Princess', 'Punta Cana', '34 min', 'Deluxe Suite', 1112, 'Honeymoon Suite', 1714, 1655, 5, 'No', 'Best Room', 'Yes'],
  ['Catalonia Royal Bavaro', 'Punta Cana', '22 min', 'Superior Junior Suite', 897, 'Privileged Duplex Suite & Swimming Pool', 1926, null, 5, '24-hour', 'No', 'Yes'],
  ['Serenade All Suites', 'Punta Cana', '18 min', 'Junior Suite Garden View', 1474, 'Junior Suite Ocean Front View', 2947, 2106, 5, 'Yes', 'Best Room', 'Best Room'],
  ['TRS Turquesa', 'Punta Cana', '33 min', 'Junior Suite Garden / Pool View', 1958, 'Jacuzzi Terrace Suite Beachside', 2545, 2160, 5, '24-hour', 'Best Room', 'Yes'],
  ['Majestic Elegance', 'Punta Cana', '31 min', 'ELEGANCE CLUB Junior Suite with Jacuzzi 18+', 1782, 'ELEGANCE CLUB Ocean View Suite (Outdoor Jacuzzi) 18+', 2318, null, 5, '24-hour', 'Best Room', 'Yes'],
  ['Excellence El Carmen', 'Punta Cana', '49 min', 'Junior Suite Garden View or Pool View', 2068, 'Excellence Club Junior Suite Ocean View', 2533, 2518, 5, 'Yes', 'Best Room', 'Yes'],
  ['Melia Punta Cana Beach', 'Punta Cana', '25 min', 'Deluxe Room', 1530, 'The Level Garden Suite by Stay Well', 2890, 2695, 5, 'Yes', 'No', 'Best Room'],
  ['JOIA Bavaro by Iberostar', 'Punta Cana', '28 min', 'Suite', 2443, 'Ocean View Butler Suite', 2937, 2725, 5, '24-hour', 'Best Room', 'Yes'],
  ['JOIA Rose Hall by Iberostar', 'Montego Bay', '22 min', 'Suite', 2705, 'Ocean View Suite', 3297, 2905, 5, '24-hour', 'Best Room', 'Yes'],
  ['Excellence Oyster Bay', 'Oyster Bay', '40 min', 'Junior Suite Run of the House', 2657, 'Excellence Club Junior Suite Ocean Front', 3417, 3284, 5, '24-hour', 'Best Room', 'Yes'],
  ['Sanctuary Cap Cana', 'Punta Cana', '20 min', 'Junior Suite Ocean View', 3021, 'Premium Luxury Junior Suite Ocean View', 3355, null, 5, 'Yes', 'Yes', 'Yes'],
  ['TRS Cap Cana', 'Punta Cana', '15 min', 'Junior Suite Marina View', 2616, 'Suite Jacuzzi Terrace Ocean View', 3080, 'CLOSED', 5, '24-hour', 'Best Room', 'Best Room'],
];

const CRITERIA = [
  { key: 'room-service', label: 'Room Service', weight: 2, required: false, sortOrder: 0 },
  { key: 'oceanview', label: 'Oceanview', weight: 3, required: false, sortOrder: 1 },
  { key: 'soaking-tub', label: 'Soaking Tub', weight: 3, required: false, sortOrder: 2 },
];

/** Which rooms does this sheet value apply to? */
function resolve(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'yes' || v === '24-hour') return { entry: true, target: true };
  if (v === 'best room') return { entry: false, target: true };
  return { entry: false, target: false };
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const db = { resorts: [], rooms: [], criteria: [], trips: [], prices: [], meta: { version: 1 } };

db.criteria = CRITERIA.map((c) => ({ id: 'crit_' + c.key, ...c }));

// The sheet tracked one shopping trip. Dates weren't recorded in it, so this
// seeds a placeholder you can rename or re-date on the Trips page.
const trip = {
  id: 'trip_imported',
  label: 'Imported from spreadsheet',
  checkIn: '2026-02-14',
  checkOut: '2026-02-21',
  adults: 2,
  children: 0,
  archived: false,
};
db.trips.push(trip);

for (const row of ROWS) {
  const [name, location, airport, cheapRoom, price1, targetRoom, price2, sale, stars, rs, ov, tub] = row;
  const id = 'res_' + slug(name);
  const closed = String(sale).toUpperCase() === 'CLOSED';
  const tags = [];
  if (String(rs).toLowerCase() === '24-hour') tags.push('24-hour room service');
  if (/18\+/.test(targetRoom)) tags.push('adults-only room');

  db.resorts.push({
    id,
    name,
    destination: location,
    airport: location === 'Punta Cana' ? 'PUJ' : 'MBJ',
    transferMinutes: parseInt(String(airport), 10) || null,
    stars,
    tags,
    bookingUrlTemplate: null,
    websiteUrl: null,
    imageUrl: null,
    notes: closed ? 'Marked CLOSED in the original spreadsheet.' : '',
    status: closed ? 'closed' : 'active',
    createdAt: CAPTURED_AT,
  });

  const resolved = { 'room-service': resolve(rs), oceanview: resolve(ov), 'soaking-tub': resolve(tub) };
  const pick = (tier) => Object.fromEntries(
    Object.entries(resolved).map(([k, v]) => [k, v[tier]]),
  );

  const entryId = 'room_' + slug(name) + '_entry';
  const targetId = 'room_' + slug(name) + '_target';

  db.rooms.push(
    { id: entryId, resortId: id, name: cheapRoom, tier: 'entry', amenities: pick('entry'), notes: '' },
    { id: targetId, resortId: id, name: targetRoom, tier: 'target', amenities: pick('target'), notes: '' },
  );

  const snap = (roomId, price, salePrice) => ({
    id: 'price_' + roomId + '_import',
    roomId,
    tripId: trip.id,
    source: 'resort-direct',
    price,
    salePrice,
    currency: 'USD',
    url: null,
    notes: 'Imported from spreadsheet',
    capturedAt: CAPTURED_AT,
  });

  if (price1 != null) db.prices.push(snap(entryId, price1, null));
  if (price2 != null) {
    const salePrice = closed || sale == null ? null : Number(sale);
    db.prices.push(snap(targetId, price2, salePrice));
  }
}

const out = path.join(process.cwd(), 'data', 'db.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(db, null, 2));
console.log(
  'Seeded ' + db.resorts.length + ' resorts, ' + db.rooms.length + ' rooms, ' +
  db.prices.length + ' prices -> ' + out,
);

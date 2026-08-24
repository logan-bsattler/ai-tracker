// Second capture round (2026-08-24). Each template below was loaded with the
// April 2027 dates and confirmed to return that hotel's live availability.
import fs from 'node:fs';

const BOOKING = {
  // BookCore, same engine family as Excellence, but this deployment takes
  // adults/children as extra path segments.
  'Bahia Principe Luxury Ambar':
    'https://en.book.bahia-principe.com/bookcore/availability/bpluxamb/{checkIn}/{checkOut}/{adults}/{children}/',
  'TRS Turquesa':
    'https://bookings.palladiumhotelgroup.com/bookcore/availability/suitesturquesa/{checkIn}/{checkOut}/{adults}/{children}/',
  // Paraty Tech. Rejects ISO dates; wants DD/MM/YYYY.
  'Serenade All Suites':
    'https://www.serenadepuntacana.com/booking1?startDate={checkInEUEnc}&endDate={checkOutEUEnc}&numRooms=1&adultsRoom1={adults}&childrenRoom1={children}',
};

// Engines identified but no working deep link yet — recorded so the next
// attempt starts from what was already learned rather than from scratch.
const LEADS = {
  'Barcelo Bavaro Beach': 'Engine: reservation-api.barcelo.com XHR, hotel_id 7389. No GET deep link found.',
  'Punta Cana Princess': 'Engine: Mirai, idtokenprovider=100376314. Dispatcher loads but ignores checkin=.',
  'Catalonia Royal Bavaro': 'Engine: Mirai, hotelBackCode=CRB. Public min-price API at apiweb.cataloniahotels.com.',
  'Majestic Elegance': 'Engine: Hotetec SPA. No GET form exposed.',
  'Melia Punta Cana Beach': 'Engine: Melia SPA, hotelCode 5917. Query params ignored.',
  'Sanctuary Cap Cana': 'Marriott (PUJLC) serves a bot-protection interstitial. Not automatable.',
};

const path = 'data/db.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));
let set = 0;

for (const [name, tpl] of Object.entries(BOOKING)) {
  const r = db.resorts.find((x) => x.name === name);
  if (!r) { console.error('missing ' + name); continue; }
  r.bookingUrlTemplate = tpl;
  set++;
}

for (const [name, note] of Object.entries(LEADS)) {
  const r = db.resorts.find((x) => x.name === name);
  if (!r) { console.error('missing ' + name); continue; }
  if (!r.notes.includes('Engine:') && !r.notes.includes('Marriott (')) {
    r.notes = r.notes ? `${r.notes} ${note}` : note;
  }
}

fs.writeFileSync(path, JSON.stringify(db, null, 2));
const total = db.resorts.filter((r) => r.bookingUrlTemplate).length;
console.log(`added ${set} templates; ${total} resorts now have deep links`);

// Third capture round (2026-08-26). Barcelo's marketing site (barcelo.com) has
// no query-param deep link, but its checkout flow redirects to
// reservation.barcelo.com with the dates in the URL — confirmed by loading it
// with the April 2027 trip dates and seeing them echoed back on the page.
import fs from 'node:fs';

const BOOKING = {
  'Barcelo Bavaro Beach':
    'https://reservation.barcelo.com/?country=US&rooms=1&arrive={checkIn}&marketcampaign=us&hotel=7389&currency=USD&store=en-us&depart={checkOut}&adult={adults}&locale=en-US&marketprice=USA',
};

const path = 'data/db.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));
let set = 0;

for (const [name, tpl] of Object.entries(BOOKING)) {
  const r = db.resorts.find((x) => x.name === name);
  if (!r) { console.error('missing ' + name); continue; }
  r.bookingUrlTemplate = tpl;
  r.notes = r.notes.replace(
    'No GET deep link found.',
    'GET deep link found on reservation.barcelo.com (not barcelo.com), confirmed 2026-08-26.',
  );
  set++;
}

fs.writeFileSync(path, JSON.stringify(db, null, 2));
const total = db.resorts.filter((r) => r.bookingUrlTemplate).length;
console.log(`added ${set} templates; ${total} resorts now have deep links`);

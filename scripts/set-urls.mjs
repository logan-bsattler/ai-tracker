// One-off: writes the booking URL templates and official hotel-page URLs
// captured on 2026-08-24 into data/db.json.
//
// `booking` entries were verified by loading them with the April 2027 dates and
// confirming the engine echoed those dates back. `site` entries are the
// official hotel page — used when the engine has no usable deep link, so the
// refresh job opens the page and drives the widget itself.
import fs from 'node:fs';

const URLS = {
  'Excellence El Carmen': {
    site: 'https://www.excellenceresorts.com/hotels/',
    booking: 'https://booking.excellenceresorts.com/en/bookcore/availability/excellenceelcarmen/{checkIn}/{checkOut}/',
  },
  'Excellence Oyster Bay': {
    site: 'https://www.excellenceresorts.com/hotels/',
    booking: 'https://booking.excellenceresorts.com/en/bookcore/availability/excellenceoyster/{checkIn}/{checkOut}/',
  },
  'JOIA Bavaro by Iberostar': {
    site: 'https://www.iberostar.com/en/hotels/punta-cana/joia-bavaro-by-iberostar/',
    booking: 'https://www.iberostar.com/en/bookings/?vo_booking%5Bcheck_in_date%5D={checkInUSEnc}&vo_booking%5Bcheck_out_date%5D={checkOutUSEnc}&vo_booking%5Bhotel_id%5D=78',
  },
  'JOIA Rose Hall by Iberostar': {
    site: 'https://www.iberostar.com/en/hotels/montego-bay/joia-rose-hall-by-iberostar/',
    booking: 'https://www.iberostar.com/en/bookings/?vo_booking%5Bcheck_in_date%5D={checkInUSEnc}&vo_booking%5Bcheck_out_date%5D={checkOutUSEnc}&vo_booking%5Bhotel_id%5D=79',
  },

  // Engines with no deep link confirmed yet — the job opens these and uses the
  // on-page booking widget.
  'Bahia Principe Luxury Ambar': {
    site: 'https://www.bahia-principe.com/en/dominican-republic/punta-cana/resort-ambar/',
    note: 'Renamed by the chain to "Bahia Principe Escape Ambar".',
  },
  'Barcelo Bavaro Beach': { site: 'https://www.barcelo.com/en-us/barcelo-bavaro-beach/' },
  'Punta Cana Princess': { site: 'https://www.princess-hotels.com/en/punta-cana/punta-cana-princess/' },
  'Catalonia Royal Bavaro': { site: 'https://www.cataloniahotels.com/en/hotel/catalonia-royal-bavaro-adults-only' },
  'Serenade All Suites': { site: 'https://www.serenadepuntacana.com/' },
  'TRS Turquesa': { site: 'https://www.palladiumhotelgroup.com/en/hotels/republicadominicana/puntacana/trs-turquesa-hotel' },
  'Majestic Elegance': { site: 'https://www.majestic-resorts.com/punta-cana/resorts/majestic-elegance-punta-cana' },
  'Melia Punta Cana Beach': { site: 'https://www.melia.com/en/hotels/dominican-republic/punta-cana/melia-punta-cana-beach-resort' },
  'Sanctuary Cap Cana': {
    site: 'https://www.marriott.com/en-us/hotels/pujlc-sanctuary-cap-cana-a-luxury-collection-resort-dominican-republic-adult-all-inclusive/overview/',
    note: 'Marriott Luxury Collection property, code PUJLC.',
  },
  'TRS Cap Cana': {
    site: 'https://www.palladiumhotelgroup.com/en/hotels/republicadominicana',
    note: 'Marked closed, so excluded from the refresh queue.',
  },
};

const path = 'data/db.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));

let booking = 0;
let site = 0;
for (const [name, cfg] of Object.entries(URLS)) {
  const resort = db.resorts.find((r) => r.name === name);
  if (!resort) { console.error('no resort named ' + name); continue; }
  if (cfg.booking) { resort.bookingUrlTemplate = cfg.booking; booking++; }
  if (cfg.site) { resort.websiteUrl = cfg.site; site++; }
  if (cfg.note) {
    resort.notes = resort.notes ? `${resort.notes} ${cfg.note}` : cfg.note;
  }
}

fs.writeFileSync(path, JSON.stringify(db, null, 2));
console.log(`set ${booking} booking templates and ${site} hotel-page URLs`);

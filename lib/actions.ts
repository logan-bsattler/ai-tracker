'use server';

import { revalidatePath } from 'next/cache';
import { mutate, newId } from './db';
import type { Criterion, PriceSource, Resort, Room, Trip } from './types';

// ---------------------------------------------------------------------------
// All writes funnel through here. Every action revalidates broadly — the data
// set is tiny and pages cross-reference each other, so targeted invalidation
// would be more bookkeeping than it's worth.
// ---------------------------------------------------------------------------

function refresh() {
  revalidatePath('/', 'layout');
}

const str = (v: FormDataEntryValue | null) => (v == null ? '' : String(v).trim());
const numOrNull = (v: FormDataEntryValue | null) => {
  const s = str(v).replace(/[$,\s]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/* -- Resorts ------------------------------------------------------------- */

export async function saveResort(form: FormData) {
  const id = str(form.get('id'));
  const fields = {
    name: str(form.get('name')),
    destination: str(form.get('destination')),
    airport: str(form.get('airport')),
    transferMinutes: numOrNull(form.get('transferMinutes')),
    stars: numOrNull(form.get('stars')),
    tags: str(form.get('tags')).split(',').map((t) => t.trim()).filter(Boolean),
    bookingUrlTemplate: str(form.get('bookingUrlTemplate')) || null,
    websiteUrl: str(form.get('websiteUrl')) || null,
    imageUrl: str(form.get('imageUrl')) || null,
    notes: str(form.get('notes')),
    status: (str(form.get('status')) || 'active') as Resort['status'],
    pinnedRoomId: str(form.get('pinnedRoomId')) || null,
  };
  if (!fields.name) return;

  mutate((db) => {
    const existing = db.resorts.find((r) => r.id === id);
    if (existing) {
      Object.assign(existing, fields);
      return;
    }
    const resortId = newId('res');
    db.resorts.push({ id: resortId, createdAt: new Date().toISOString(), ...fields });
    // A resort with no rooms can't be priced, so give it the two the workflow
    // assumes: the cheapest option and the one you'd actually book.
    db.rooms.push(
      { id: newId('room'), resortId, name: 'Cheapest room', tier: 'entry', amenities: {}, url: null, notes: '' },
      { id: newId('room'), resortId, name: 'Best room for us', tier: 'target', amenities: {}, url: null, notes: '' },
    );
  });
  refresh();
}

export async function deleteResort(form: FormData) {
  const id = str(form.get('id'));
  mutate((db) => {
    const roomIds = new Set(db.rooms.filter((r) => r.resortId === id).map((r) => r.id));
    db.resorts = db.resorts.filter((r) => r.id !== id);
    db.rooms = db.rooms.filter((r) => r.resortId !== id);
    db.prices = db.prices.filter((p) => !roomIds.has(p.roomId));
  });
  refresh();
}

/* -- Rooms --------------------------------------------------------------- */

export async function saveRoom(form: FormData) {
  const id = str(form.get('id'));
  const resortId = str(form.get('resortId'));
  const name = str(form.get('name'));
  const tier = (str(form.get('tier')) || 'other') as Room['tier'];
  const notes = str(form.get('notes'));
  const url = str(form.get('url')) || null;
  if (!name || !resortId) return;

  // Checkboxes only post when checked, so the full key list rides along in a
  // hidden field — otherwise unchecking could never be distinguished from
  // "not submitted".
  const keys = str(form.get('criteriaKeys')).split(',').filter(Boolean);
  const amenities: Record<string, boolean> = {};
  for (const k of keys) amenities[k] = form.get(`amenity:${k}`) === 'on';

  mutate((db) => {
    const existing = db.rooms.find((r) => r.id === id);
    if (existing) {
      Object.assign(existing, { name, tier, notes, amenities, url });
    } else {
      db.rooms.push({ id: newId('room'), resortId, name, tier, notes, amenities, url });
    }
  });
  refresh();
}

export async function deleteRoom(form: FormData) {
  const id = str(form.get('id'));
  mutate((db) => {
    db.rooms = db.rooms.filter((r) => r.id !== id);
    db.prices = db.prices.filter((p) => p.roomId !== id);
  });
  refresh();
}

/* -- Prices -------------------------------------------------------------- */

export async function addPrice(form: FormData) {
  const roomId = str(form.get('roomId'));
  const tripId = str(form.get('tripId'));
  const price = numOrNull(form.get('price'));
  if (!roomId || !tripId || price == null) return;

  mutate((db) => {
    db.prices.push({
      id: newId('price'),
      roomId,
      tripId,
      source: (str(form.get('source')) || 'resort-direct') as PriceSource,
      price,
      salePrice: numOrNull(form.get('salePrice')),
      currency: str(form.get('currency')) || 'USD',
      taxesIncluded: form.get('taxesIncluded') === 'on',
      url: str(form.get('url')) || null,
      notes: str(form.get('notes')),
      capturedAt: new Date().toISOString(),
    });
  });
  refresh();
}

/**
 * Bulk capture: one submit records a price for every room you filled in.
 * This is the recurring chore the spreadsheet made tedious, so it gets the
 * shortest path — blank fields are simply skipped.
 */
export async function captureRound(form: FormData) {
  const tripId = str(form.get('tripId'));
  const source = (str(form.get('source')) || 'resort-direct') as PriceSource;
  if (!tripId) return;

  const capturedAt = new Date().toISOString();
  // One setting for the whole round: a given source quotes one way or the other.
  const taxesIncluded = form.get('taxesIncluded') === 'on';
  mutate((db) => {
    for (const room of db.rooms) {
      const price = numOrNull(form.get(`price:${room.id}`));
      if (price == null) continue;
      db.prices.push({
        id: newId('price'),
        roomId: room.id,
        tripId,
        source,
        price,
        salePrice: numOrNull(form.get(`sale:${room.id}`)),
        currency: 'USD',
        taxesIncluded,
        url: null,
        notes: '',
        capturedAt,
      });
    }
  });
  refresh();
}

export async function deletePrice(form: FormData) {
  const id = str(form.get('id'));
  mutate((db) => { db.prices = db.prices.filter((p) => p.id !== id); });
  refresh();
}

/* -- Criteria ------------------------------------------------------------ */

export async function saveCriteria(form: FormData) {
  const ids = form.getAll('criterionId').map(String);
  mutate((db) => {
    for (const id of ids) {
      const c = db.criteria.find((x) => x.id === id);
      if (!c) continue;
      c.label = str(form.get(`label:${id}`)) || c.label;
      c.weight = numOrNull(form.get(`weight:${id}`)) ?? c.weight;
      c.required = form.get(`required:${id}`) === 'on';
    }
  });
  refresh();
}

export async function addCriterion(form: FormData) {
  const label = str(form.get('label'));
  if (!label) return;
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  mutate((db) => {
    if (db.criteria.some((c) => c.key === key)) return;
    const criterion: Criterion = {
      id: newId('crit'),
      key,
      label,
      weight: numOrNull(form.get('weight')) ?? 1,
      required: form.get('required') === 'on',
      sortOrder: db.criteria.length,
    };
    db.criteria.push(criterion);
  });
  refresh();
}

export async function deleteCriterion(form: FormData) {
  const id = str(form.get('id'));
  mutate((db) => {
    const c = db.criteria.find((x) => x.id === id);
    db.criteria = db.criteria.filter((x) => x.id !== id);
    if (c) for (const room of db.rooms) delete room.amenities[c.key];
  });
  refresh();
}

/* -- Trips --------------------------------------------------------------- */

export async function saveTrip(form: FormData) {
  const id = str(form.get('id'));
  const fields = {
    label: str(form.get('label')),
    checkIn: str(form.get('checkIn')),
    checkOut: str(form.get('checkOut')),
    adults: numOrNull(form.get('adults')) ?? 2,
    children: numOrNull(form.get('children')) ?? 0,
    archived: form.get('archived') === 'on',
  };
  if (!fields.checkIn || !fields.checkOut) return;
  if (!fields.label) {
    fields.label = `${fields.checkIn} → ${fields.checkOut}`;
  }

  mutate((db) => {
    const existing = db.trips.find((t) => t.id === id);
    if (existing) Object.assign(existing, fields);
    else db.trips.push({ id: newId('trip'), ...fields } as Trip);
  });
  refresh();
}

export async function deleteTrip(form: FormData) {
  const id = str(form.get('id'));
  mutate((db) => {
    db.trips = db.trips.filter((t) => t.id !== id);
    db.prices = db.prices.filter((p) => p.tripId !== id);
  });
  refresh();
}

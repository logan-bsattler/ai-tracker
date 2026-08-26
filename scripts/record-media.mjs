// ---------------------------------------------------------------------------
// Attaches photos, videos, ratings and coordinates to a resort.
//
//   node scripts/record-media.mjs media.json [--dry-run]
//
// Input shape — every key except `resort` is optional, so a run can add just
// videos, or just a rating, without disturbing the rest:
//
//   { "resort": "Barcelo Bavaro Beach",
//     "lat": 18.6899, "lng": -68.4106,
//     "photos":  [ { "url": "https://…", "caption": "Pool", "credit": "Barceló" } ],
//     "videos":  [ { "youtubeId": "abc123", "title": "…", "channel": "…" } ],
//     "reviews": [ { "source": "TripAdvisor", "score": 4.4, "outOf": 5,
//                    "count": 16531, "url": "https://…" } ],
//     "rooms":   { "Superior Room": [ { "url": "https://…", "caption": "…" } ] } }
//
// Merge rules mirror how each thing behaves in the world:
//   photos / videos — appended, deduped by url / id. A gallery grows.
//   reviews         — replaced per source. A rating is a current fact, so a
//                     fresh TripAdvisor score supersedes the old one.
//   lat / lng       — overwritten when given.
// ---------------------------------------------------------------------------
import fs from 'node:fs';

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

function fail(message) {
  console.error('error: ' + message);
  process.exit(1);
}

if (!positional[0]) fail('pass a payload file — see the header of this script');
const payload = JSON.parse(fs.readFileSync(positional[0], 'utf8'));

const DB_PATH = 'data/db.json';
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

const resort = db.resorts.find(
  (r) => r.id === payload.resort
    || r.name.toLowerCase() === String(payload.resort).toLowerCase()
    || r.name.toLowerCase().includes(String(payload.resort).toLowerCase()),
);
if (!resort) fail(`no resort matching "${payload.resort}"`);

resort.photos ??= [];
resort.videos ??= [];
resort.reviews ??= [];

const lines = [];
const capturedAt = new Date().toISOString();

/** Append the ones we don't already have, keyed by whatever identifies them. */
function mergeBy(list, incoming, key, label) {
  const seen = new Set(list.map(key));
  let added = 0;
  for (const item of incoming ?? []) {
    if (seen.has(key(item))) continue;
    seen.add(key(item));
    list.push(item);
    added++;
  }
  if (added) lines.push(`  +${added} ${label}`);
  return added;
}

// -- photos ---------------------------------------------------------------
mergeBy(
  resort.photos,
  (payload.photos ?? []).map((p) => ({
    url: p.url, caption: p.caption ?? null, credit: p.credit ?? null,
  })),
  (p) => p.url,
  'resort photos',
);

// -- videos ---------------------------------------------------------------
mergeBy(
  resort.videos,
  (payload.videos ?? []).map((v) => ({
    youtubeId: v.youtubeId, title: v.title, channel: v.channel ?? null,
  })),
  (v) => v.youtubeId,
  'videos',
);

// -- reviews --------------------------------------------------------------
for (const r of payload.reviews ?? []) {
  if (!r.source || typeof r.score !== 'number' || typeof r.outOf !== 'number') {
    fail('each review needs a source, a numeric score and outOf');
  }
  if (r.score > r.outOf) fail(`${r.source}: score ${r.score} is above its scale of ${r.outOf}`);
  const entry = {
    source: r.source, score: r.score, outOf: r.outOf,
    count: r.count ?? null, url: r.url ?? null, capturedAt,
  };
  const at = resort.reviews.findIndex((x) => x.source === r.source);
  if (at === -1) { resort.reviews.push(entry); lines.push(`  +rating ${r.source} ${r.score}/${r.outOf}`); }
  else {
    const was = resort.reviews[at].score;
    resort.reviews[at] = entry;
    lines.push(`  ~rating ${r.source} ${was} → ${r.score}/${r.outOf}`);
  }
}

// -- coordinates ----------------------------------------------------------
if (typeof payload.lat === 'number' && typeof payload.lng === 'number') {
  resort.lat = payload.lat;
  resort.lng = payload.lng;
  lines.push(`  coords ${payload.lat}, ${payload.lng}`);
}

// -- room photos ----------------------------------------------------------
for (const [roomName, photos] of Object.entries(payload.rooms ?? {})) {
  const rooms = db.rooms.filter((r) => r.resortId === resort.id);
  const matches = rooms.filter(
    (r) => r.name.toLowerCase() === roomName.toLowerCase()
      || r.name.toLowerCase().includes(roomName.toLowerCase()),
  );
  const exact = rooms.find((r) => r.name.toLowerCase() === roomName.toLowerCase());
  const room = exact ?? (matches.length === 1 ? matches[0] : null);
  if (!room) {
    fail(matches.length === 0
      ? `no room at ${resort.name} matching "${roomName}"`
      : `"${roomName}" matches ${matches.length} rooms: ${matches.map((m) => m.name).join(', ')}`);
  }
  room.photos ??= [];
  mergeBy(
    room.photos,
    photos.map((p) => ({ url: p.url, caption: p.caption ?? null, credit: p.credit ?? null })),
    (p) => p.url,
    `photos on "${room.name}"`,
  );
}

if (lines.length === 0) {
  console.log(`${resort.name}: nothing new to add`);
  process.exit(0);
}

if (args['dry-run']) {
  console.log(`DRY RUN — ${resort.name}\n${lines.join('\n')}`);
  process.exit(0);
}

const tmp = `${DB_PATH}.${process.pid}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
fs.renameSync(tmp, DB_PATH);

console.log(`${resort.name}\n${lines.join('\n')}`);

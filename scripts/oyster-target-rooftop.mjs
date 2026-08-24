// Switches Excellence Oyster Bay's target room to the Rooftop Terrace Suite.
//
// The Partial Ocean View club suite was my stand-in for the retired
// "Excellence Club Junior Suite Ocean Front". It is kept as a tracked room
// rather than deleted: its $5,493 observation is a real reading of a real
// room, and dropping it would throw away data to no benefit. It simply stops
// being the room the ranking is based on.
//
// Amenities on the new target are taken from the resort's own description:
// "Ocean front views ... a jetted whirlpool bathtub", plus Excellence Club
// 24-hour room service.
import fs from 'node:fs';

const path = 'data/db.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));

const resort = db.resorts.find((r) => r.name === 'Excellence Oyster Bay');
if (!resort) throw new Error('resort not found');

const NEW_NAME = 'Excellence Club Rooftop Terrace Suite with Plunge Pool Ocean Front';

const oldTarget = db.rooms.find((r) => r.resortId === resort.id && r.tier === 'target');
if (oldTarget && oldTarget.name !== NEW_NAME) {
  oldTarget.tier = 'other';
  const note = 'Was the target room until 2026-08-24; kept for reference.';
  oldTarget.notes = oldTarget.notes ? `${oldTarget.notes} ${note}` : note;
  console.log(`demoted "${oldTarget.name}" to other`);
}

let room = db.rooms.find((r) => r.resortId === resort.id && r.name === NEW_NAME);
if (!room) {
  room = {
    id: `room_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    resortId: resort.id,
    name: NEW_NAME,
    tier: 'target',
    amenities: { 'room-service': true, oceanview: true, 'soaking-tub': true },
    notes: 'Ocean front, private plunge pool and a jetted whirlpool bathtub, per the resort description.',
  };
  db.rooms.push(room);
  console.log(`added "${NEW_NAME}" as target`);
} else {
  room.tier = 'target';
  console.log(`"${NEW_NAME}" already present; set as target`);
}

fs.writeFileSync(path, JSON.stringify(db, null, 2));

import fs from 'node:fs';
import path from 'node:path';
import type { Database } from './types';

// ---------------------------------------------------------------------------
// JSON-file store. Single-user, a few hundred rows — a real database would be
// ceremony. Everything goes through read()/write() so swapping in SQLite or
// Postgres later means rewriting this file alone.
// ---------------------------------------------------------------------------

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

const EMPTY: Database = {
  resorts: [], rooms: [], criteria: [], trips: [], prices: [],
  meta: { version: 1 },
};

export function read(): Database {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return { ...EMPTY, ...JSON.parse(raw) } as Database;
  } catch {
    return structuredClone(EMPTY);
  }
}

export function write(db: Database): void {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  // Write-then-rename so a crash mid-write can't truncate the file.
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}

/** Read, mutate, write. Returns whatever the mutator returns. */
export function mutate<T>(fn: (db: Database) => T): T {
  const db = read();
  const result = fn(db);
  write(db);
  return result;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

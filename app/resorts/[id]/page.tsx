import Link from 'next/link';
import { notFound } from 'next/navigation';
import PriceChart, { type Series } from '@/components/PriceChart';
import {
  addPrice, deletePrice, deleteResort, deleteRoom, saveResort, saveRoom,
} from '@/lib/actions';
import { buildBookingUrl, comparisonLinks, SOURCE_LABELS } from '@/lib/booking';
import { read } from '@/lib/db';
import { scoreResort } from '@/lib/scoring';
import { effectivePrice } from '@/lib/types';
import { IS_STATIC } from '@/lib/mode';
import { resolveTrip } from '@/lib/view';

export { PAGE_DYNAMIC as dynamic } from '@/lib/mode';

/** Every resort gets its own page in the static export. */
export function generateStaticParams() {
  return read().resorts.map((r) => ({ id: r.id }));
}

const money = (n: number | null) =>
  n == null ? '—' : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const LINE_COLORS = ['var(--accent)', 'var(--color-coral-500)', '#8b5cf6', '#eab308', '#3b82f6'];

export default async function ResortPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ trip?: string }>;
}) {
  const { id } = await params;
  const { trip: tripParam } = await searchParams;

  const db = read();
  const resort = db.resorts.find((r) => r.id === id);
  if (!resort) notFound();

  const trip = resolveTrip(tripParam);
  const scored = scoreResort(db, resort, trip);
  const criteria = [...db.criteria].sort((a, b) => a.sortOrder - b.sortOrder);
  const criteriaKeys = criteria.map((c) => c.key).join(',');
  const bookingUrl = buildBookingUrl(resort, trip);

  const series: Series[] = scored.rooms
    .map((room, i) => {
      const byDay = new Map<string, number>();
      for (const p of room.pricing.history) {
        const day = p.capturedAt.slice(0, 10);
        byDay.set(day, Math.min(byDay.get(day) ?? Infinity, effectivePrice(p)));
      }
      return {
        label: room.room.name,
        color: LINE_COLORS[i % LINE_COLORS.length],
        points: [...byDay.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, value]) => ({ date, value })),
      };
    })
    .filter((s) => s.points.length > 0);

  /** Same order as lib/view.ts: room link, then the trip's booking URL, then
   *  whatever page the last price came from. */
  const roomLink = (sr: (typeof scored.rooms)[number]) =>
    sr.room.url || bookingUrl || sr.pricing.latest?.url || null;

  const priceLog = db.prices
    .filter((p) => db.rooms.some((r) => r.resortId === resort.id && r.id === p.roomId))
    .filter((p) => !trip || p.tripId === trip.id)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));

  const roomName = (roomId: string) =>
    db.rooms.find((r) => r.id === roomId)?.name ?? 'Unknown room';

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={trip ? `/?trip=${trip.id}` : '/'} className="muted text-xs hover:underline">
            ← Rankings
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{resort.name}</h1>
          <p className="muted mt-1 flex flex-wrap items-center gap-x-3 text-sm">
            <span>{resort.destination}</span>
            {resort.transferMinutes != null && <span className="num">{resort.transferMinutes} min from {resort.airport}</span>}
            {resort.stars != null && <span className="num">{resort.stars}★</span>}
            {resort.status !== 'active' && <span className="chip">{resort.status}</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {resort.tags.map((t) => <span key={t} className="chip">{t}</span>)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {bookingUrl && (
            <a className="btn btn-primary" href={bookingUrl} target="_blank" rel="noreferrer">
              Book direct ↗
            </a>
          )}
          {comparisonLinks(resort, trip).map((l) => (
            <a key={l.label} className="btn" href={l.url} target="_blank" rel="noreferrer">
              {l.label} ↗
            </a>
          ))}
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="muted text-xs uppercase tracking-wide">Target room price</div>
          <div className="num mt-1 text-2xl font-semibold">{money(scored.price)}</div>
          <div className="muted truncate text-xs">{scored.target?.room.name ?? '—'}</div>
        </div>
        <div className="card p-4">
          <div className="muted text-xs uppercase tracking-wide">Match score</div>
          <div className="num mt-1 text-2xl font-semibold">{scored.score}%</div>
          <div className="muted text-xs">
            {scored.target?.missedKeys.length
              ? `missing ${scored.target.missedKeys.join(', ')}`
              : 'meets every criterion'}
          </div>
        </div>
        <div className="card p-4">
          <div className="muted text-xs uppercase tracking-wide">Lowest seen</div>
          <div className="num mt-1 text-2xl font-semibold">
            {money(scored.target?.pricing.low ?? null)}
          </div>
          <div className="muted text-xs num">
            {scored.target?.pricing.history.length ?? 0} observations
          </div>
        </div>
      </div>

      <section className="card mb-5 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Price history</h2>
        <PriceChart series={series} />
      </section>

      {/* Rooms ---------------------------------------------------------- */}
      <section className="mb-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Rooms</h2>

        {IS_STATIC ? (
          <div className="card overflow-x-auto">
            <table className="grid">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Tier</th>
                  {criteria.map((c) => <th key={c.key} className="text-center">{c.label}</th>)}
                  <th className="text-right">Current</th>
                </tr>
              </thead>
              <tbody>
                {scored.rooms.map((sr) => (
                  <tr key={sr.room.id}
                    style={sr.room.id === scored.target?.room.id
                      ? { background: 'var(--accent-soft)' } : undefined}>
                    <td className="font-medium">
                      {roomLink(sr) ? (
                        <a href={roomLink(sr)!} target="_blank" rel="noreferrer" className="hover:underline">
                          {sr.room.name} <span className="muted">↗</span>
                        </a>
                      ) : sr.room.name}
                    </td>
                    <td className="muted text-xs">
                      {sr.room.tier === 'entry' ? 'Cheapest' : sr.room.tier === 'target' ? 'Target' : 'Other'}
                    </td>
                    {criteria.map((c) => (
                      <td key={c.key} className="text-center">
                        {sr.room.amenities[c.key] === true
                          ? <span style={{ color: 'var(--accent)' }}>&#9679;</span>
                          : <span className="muted">&middot;</span>}
                      </td>
                    ))}
                    <td className="num text-right font-semibold">
                      {money(sr.pricing.latest ? effectivePrice(sr.pricing.latest) : null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
        <div className="space-y-3">
          {scored.rooms.map((sr) => (
            <form key={sr.room.id} action={saveRoom} className="card p-4">
              <input type="hidden" name="id" value={sr.room.id} />
              <input type="hidden" name="resortId" value={resort.id} />
              <input type="hidden" name="criteriaKeys" value={criteriaKeys} />

              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[16rem] flex-1 text-xs">
                  <span className="muted mb-1 block">Room name</span>
                  <input className="input" name="name" defaultValue={sr.room.name} />
                </label>
                <label className="text-xs">
                  <span className="muted mb-1 block">Tier</span>
                  <select className="select w-36" name="tier" defaultValue={sr.room.tier}>
                    <option value="entry">Cheapest</option>
                    <option value="target">Target</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="min-w-[14rem] flex-1 text-xs">
                  <span className="muted mb-1 block">
                    Direct link{' '}
                    {roomLink(sr) && (
                      <a href={roomLink(sr)!} target="_blank" rel="noreferrer" className="underline">
                        open ↗
                      </a>
                    )}
                  </span>
                  <input className="input" name="url" defaultValue={sr.room.url ?? ''}
                    placeholder="optional — falls back to the booking URL" />
                </label>
                <div className="text-xs">
                  <span className="muted mb-1 block">Current</span>
                  <span className="num text-sm font-semibold">
                    {money(sr.pricing.latest ? effectivePrice(sr.pricing.latest) : null)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4 border-t pt-3 hairline">
                {criteria.map((c) => (
                  <label key={c.key} className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" name={`amenity:${c.key}`}
                      defaultChecked={sr.room.amenities[c.key] === true} />
                    <span>{c.label}</span>
                  </label>
                ))}
                <input className="input ml-auto max-w-xs" name="notes"
                  defaultValue={sr.room.notes} placeholder="Notes" />
                <button className="btn btn-primary" type="submit">Save</button>
                <button className="btn btn-ghost btn-danger" type="submit"
                  formAction={deleteRoom}>Delete</button>
              </div>
            </form>
          ))}

          <form action={saveRoom} className="card flex flex-wrap items-end gap-3 p-4">
            <input type="hidden" name="resortId" value={resort.id} />
            <input type="hidden" name="criteriaKeys" value={criteriaKeys} />
            <label className="min-w-[16rem] flex-1 text-xs">
              <span className="muted mb-1 block">Add a room</span>
              <input className="input" name="name" placeholder="e.g. Swim-Up Junior Suite" />
            </label>
            <select className="select w-36" name="tier" defaultValue="other">
              <option value="entry">Cheapest</option>
              <option value="target">Target</option>
              <option value="other">Other</option>
            </select>
            <button className="btn" type="submit">Add room</button>
          </form>
        </div>
        )}
      </section>

      {/* Manual price entry --------------------------------------------- */}
      {trip && (
        <section className="card mb-5 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            {IS_STATIC ? 'Price log' : 'Log a price'}
          </h2>
          {!IS_STATIC && (
          <form action={addPrice} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="tripId" value={trip.id} />
            <label className="text-xs">
              <span className="muted mb-1 block">Room</span>
              <select className="select w-64" name="roomId">
                {scored.rooms.map((sr) => (
                  <option key={sr.room.id} value={sr.room.id}>{sr.room.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="muted mb-1 block">Source</span>
              <select className="select w-44" name="source" defaultValue="resort-direct">
                {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="muted mb-1 block">Price</span>
              <input className="input num w-28" name="price" inputMode="decimal" />
            </label>
            <label className="text-xs">
              <span className="muted mb-1 block">Sale price</span>
              <input className="input num w-28" name="salePrice" inputMode="decimal" />
            </label>
            <label className="min-w-[12rem] flex-1 text-xs">
              <span className="muted mb-1 block">Link / notes</span>
              <input className="input" name="url" placeholder="https://…" />
            </label>
            <label className="flex items-center gap-1.5 pb-2 text-xs">
              <input type="checkbox" name="taxesIncluded" defaultChecked />
              <span>Taxes included</span>
            </label>
            <button className="btn btn-primary" type="submit">Add</button>
          </form>
          )}

          {priceLog.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Date</th><th>Room</th><th>Source</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Sale</th>
                    <th className="text-right">Paid</th>
                    {!IS_STATIC && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {priceLog.map((p) => (
                    <tr key={p.id}>
                      <td className="num muted">{p.capturedAt.slice(0, 10)}</td>
                      <td className="max-w-[16rem] truncate">{roomName(p.roomId)}</td>
                      <td className="muted text-xs">{SOURCE_LABELS[p.source] ?? p.source}</td>
                      <td className="num text-right">{money(p.price)}</td>
                      <td className="num text-right">{money(p.salePrice)}</td>
                      <td className="num text-right font-semibold">
                        {money(effectivePrice(p))}
                        {p.taxesIncluded === false && (
                          <span className="chip ml-1" style={{ color: 'var(--up)' }}>ex-tax</span>
                        )}
                      </td>
                      {!IS_STATIC && (
                        <td className="text-right">
                          <form action={deletePrice}>
                            <input type="hidden" name="id" value={p.id} />
                            <button className="btn btn-ghost btn-danger" type="submit">×</button>
                          </form>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Resort settings ------------------------------------------------- */}
      {!IS_STATIC && (
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Resort details</h2>
        <form action={saveResort} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={resort.id} />
          <label className="text-xs">
            <span className="muted mb-1 block">Name</span>
            <input className="input" name="name" defaultValue={resort.name} />
          </label>
          <label className="text-xs">
            <span className="muted mb-1 block">Destination</span>
            <input className="input" name="destination" defaultValue={resort.destination} />
          </label>
          <label className="text-xs">
            <span className="muted mb-1 block">Airport</span>
            <input className="input" name="airport" defaultValue={resort.airport} />
          </label>
          <label className="text-xs">
            <span className="muted mb-1 block">Transfer minutes</span>
            <input className="input num" name="transferMinutes"
              defaultValue={resort.transferMinutes ?? ''} />
          </label>
          <label className="text-xs">
            <span className="muted mb-1 block">Stars</span>
            <input className="input num" name="stars" defaultValue={resort.stars ?? ''} />
          </label>
          <label className="text-xs">
            <span className="muted mb-1 block">Room you&rsquo;d book</span>
            <select className="select" name="pinnedRoomId" defaultValue={resort.pinnedRoomId ?? ''}>
              <option value="">Auto — cheapest that meets your must-haves</option>
              {scored.rooms.map((sr) => (
                <option key={sr.room.id} value={sr.room.id}>{sr.room.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="muted mb-1 block">Status</span>
            <select className="select" name="status" defaultValue={resort.status}>
              <option value="active">Active</option>
              <option value="watchlist">Watchlist</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label className="text-xs sm:col-span-2">
            <span className="muted mb-1 block">
              Booking URL template — placeholders:{' '}
              <code>{'{checkIn} {checkOut} {checkInUS} {checkInCompact} {adults} {children} {nights}'}</code>
            </span>
            <input className="input" name="bookingUrlTemplate"
              defaultValue={resort.bookingUrlTemplate ?? ''}
              placeholder="https://resort.com/booking?arrive={checkIn}&depart={checkOut}&adults={adults}" />
          </label>
          <label className="text-xs">
            <span className="muted mb-1 block">Website</span>
            <input className="input" name="websiteUrl" defaultValue={resort.websiteUrl ?? ''} />
          </label>
          <label className="text-xs">
            <span className="muted mb-1 block">Tags (comma separated)</span>
            <input className="input" name="tags" defaultValue={resort.tags.join(', ')} />
          </label>
          <label className="text-xs sm:col-span-2">
            <span className="muted mb-1 block">Notes</span>
            <textarea className="textarea" name="notes" rows={3} defaultValue={resort.notes} />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn btn-primary" type="submit">Save resort</button>
          </div>
        </form>

        <form action={deleteResort} className="mt-4 border-t pt-4 hairline">
          <input type="hidden" name="id" value={resort.id} />
          <button className="btn btn-ghost btn-danger" type="submit">
            Delete this resort and all its price history
          </button>
        </form>
      </section>
      )}
    </>
  );
}

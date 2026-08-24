import Link from 'next/link';
import { captureRound } from '@/lib/actions';
import { IS_STATIC } from '@/lib/mode';
import { buildBookingUrl, comparisonLinks, SOURCE_LABELS } from '@/lib/booking';
import { read } from '@/lib/db';
import { pricingFor } from '@/lib/scoring';
import { effectivePrice } from '@/lib/types';
import { resolveTrip } from '@/lib/view';

export { PAGE_DYNAMIC as dynamic } from '@/lib/mode';

const money = (n: number | null) =>
  n == null ? '—' : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

/**
 * The recurring chore, made fast: one page, one row per room, one submit.
 * Every resort links straight to its own booking engine with the trip dates
 * already injected, so the loop is open-tab / read-price / type / next.
 */
export default async function CapturePage({
  searchParams,
}: { searchParams: Promise<{ trip?: string; source?: string }> }) {
  const params = await searchParams;
  const trip = resolveTrip(params.trip);
  const db = read();

  if (IS_STATIC) {
    return (
      <div className="card p-8 text-center">
        <h1 className="mb-2 text-lg font-semibold">Capture runs locally</h1>
        <p className="muted mx-auto max-w-md text-sm">
          This is the published read-only site. Prices are captured on Ben&rsquo;s
          machine (or by the scheduled refresh job) and published here on the
          next build.
        </p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="card p-8 text-center">
        <p className="mb-3">No travel dates defined yet.</p>
        <Link className="btn btn-primary" href="/trips">Add a date range</Link>
      </div>
    );
  }

  const resorts = db.resorts.filter((r) => r.status !== 'closed');

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Capture prices</h1>
        <p className="muted mt-1 text-sm">
          {trip.label} · {trip.checkIn} → {trip.checkOut} · {trip.adults} adults.
          Fill in what you find and submit once — blank rows are skipped, and every
          entry is stamped with today&rsquo;s date so history builds up over time.
        </p>
      </div>

      <form action={captureRound}>
        <input type="hidden" name="tripId" value={trip.id} />

        <div className="card mb-4 flex flex-wrap items-end gap-4 p-4">
          <label className="text-xs">
            <span className="muted mb-1 block">Where these prices came from</span>
            <select className="select w-56" name="source" defaultValue="resort-direct">
              {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 pb-2 text-xs">
            <input type="checkbox" name="taxesIncluded" defaultChecked />
            <span>Prices include taxes and fees</span>
          </label>
          <p className="muted max-w-md text-xs">
            Record each source as its own round. Comparing resort-direct against
            CheapCaribbean for the same room is how you find out which actually
            wins for a given week.
          </p>
          <button className="btn btn-primary ml-auto" type="submit">Save round</button>
        </div>

        <div className="space-y-3">
          {resorts.map((resort) => {
            const rooms = db.rooms.filter((r) => r.resortId === resort.id);
            const bookingUrl = buildBookingUrl(resort, trip);
            const links = comparisonLinks(resort, trip);

            return (
              <div key={resort.id} className="card p-4">
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/resorts/${resort.id}?trip=${trip.id}`}
                    className="font-medium hover:underline">
                    {resort.name}
                  </Link>
                  <span className="muted text-xs">{resort.destination}</span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {bookingUrl ? (
                      <a className="btn" href={bookingUrl} target="_blank" rel="noreferrer">
                        Open booking site ↗
                      </a>
                    ) : (
                      <Link className="btn btn-ghost muted" href={`/resorts/${resort.id}?trip=${trip.id}`}>
                        + add booking link
                      </Link>
                    )}
                    {links.map((l) => (
                      <a key={l.label} className="chip" href={l.url} target="_blank" rel="noreferrer">
                        {l.label} ↗
                      </a>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {rooms.map((room) => {
                    const pricing = pricingFor(db, room.id, trip.id);
                    const last = pricing.latest ? effectivePrice(pricing.latest) : null;
                    return (
                      <div key={room.id} className="flex flex-wrap items-center gap-3">
                        <div className="min-w-[14rem] flex-1">
                          <span className="chip mr-2">
                            {room.tier === 'entry' ? 'Cheapest' : room.tier === 'target' ? 'Target' : 'Other'}
                          </span>
                          <span className="text-sm">{room.name}</span>
                        </div>
                        <span className="muted num w-28 text-right text-xs">
                          last {money(last)}
                        </span>
                        <label className="text-xs">
                          <span className="muted mr-1">price</span>
                          <input className="input num inline-block w-28" inputMode="decimal"
                            name={`price:${room.id}`} placeholder={last != null ? String(last) : '$'} />
                        </label>
                        <label className="text-xs">
                          <span className="muted mr-1">sale</span>
                          <input className="input num inline-block w-28" inputMode="decimal"
                            name={`sale:${room.id}`} placeholder="optional" />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-4 mt-4 flex justify-end">
          <button className="btn btn-primary shadow-lg" type="submit">Save round</button>
        </div>
      </form>
    </>
  );
}

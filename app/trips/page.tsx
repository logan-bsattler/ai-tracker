import Link from 'next/link';
import { deleteTrip, saveTrip } from '@/lib/actions';
import { nights } from '@/lib/booking';
import { read } from '@/lib/db';
import { IS_STATIC } from '@/lib/mode';

export { PAGE_DYNAMIC as dynamic } from '@/lib/mode';

/**
 * Date ranges are the axis the spreadsheet never had: the same resorts priced
 * for different weeks, each with its own independent history.
 *
 * Read-only on the published site — see lib/mode.ts.
 */
export default function TripsPage() {
  const db = read();
  const trips = [...db.trips].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const priceCount = (tripId: string) => db.prices.filter((p) => p.tripId === tripId).length;

  if (IS_STATIC) {
    return (
      <>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Travel dates</h1>
          <p className="muted mt-1 text-sm">
            Every price belongs to a date range, so the same resorts can be shopped
            across several weeks and compared independently.
          </p>
        </div>

        <div className="card overflow-x-auto">
          <table className="grid">
            <thead>
              <tr>
                <th>Dates</th>
                <th>Check in</th>
                <th>Check out</th>
                <th className="text-right">Nights</th>
                <th className="text-right">Guests</th>
                <th className="text-right">Prices logged</th>
              </tr>
            </thead>
            <tbody>
              {trips.filter((t) => !t.archived).map((trip) => (
                <tr key={trip.id}>
                  <td className="font-medium">
                    <Link href={`/?trip=${trip.id}`} className="hover:underline">{trip.label}</Link>
                  </td>
                  <td className="num muted">{trip.checkIn}</td>
                  <td className="num muted">{trip.checkOut}</td>
                  <td className="num text-right">{nights(trip)}</td>
                  <td className="num text-right">
                    {trip.adults}a{trip.children ? `/${trip.children}c` : ''}
                  </td>
                  <td className="num text-right">{priceCount(trip.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Travel dates</h1>
        <p className="muted mt-1 text-sm">
          Every price belongs to a date range, so you can shop the same resorts
          across several weeks and compare them independently.
        </p>
      </div>

      <div className="space-y-3">
        {trips.map((trip) => (
          <form key={trip.id} action={saveTrip} className="card flex flex-wrap items-end gap-3 p-4">
            <input type="hidden" name="id" value={trip.id} />
            <label className="min-w-[14rem] flex-1 text-xs">
              <span className="muted mb-1 block">Label</span>
              <input className="input" name="label" defaultValue={trip.label} />
            </label>
            <label className="text-xs">
              <span className="muted mb-1 block">Check in</span>
              <input className="input" type="date" name="checkIn" defaultValue={trip.checkIn} />
            </label>
            <label className="text-xs">
              <span className="muted mb-1 block">Check out</span>
              <input className="input" type="date" name="checkOut" defaultValue={trip.checkOut} />
            </label>
            <label className="text-xs">
              <span className="muted mb-1 block">Adults</span>
              <input className="input num w-20" name="adults" defaultValue={trip.adults} />
            </label>
            <label className="text-xs">
              <span className="muted mb-1 block">Children</span>
              <input className="input num w-20" name="children" defaultValue={trip.children} />
            </label>
            <label className="flex items-center gap-1.5 pb-2 text-xs">
              <input type="checkbox" name="archived" defaultChecked={trip.archived} />
              <span>Archived</span>
            </label>

            <div className="flex items-center gap-2 pb-1">
              <span className="muted num text-xs">
                {nights(trip)}n · {priceCount(trip.id)} prices
              </span>
              <button className="btn btn-primary" type="submit">Save</button>
              <Link className="btn" href={`/capture?trip=${trip.id}`}>Capture</Link>
              <button className="btn btn-ghost btn-danger" type="submit" formAction={deleteTrip}>
                Delete
              </button>
            </div>

            {priceCount(trip.id) > 0 && (
              <p className="muted w-full text-xs" style={{ color: 'var(--up)' }}>
                Changing these dates relabels all {priceCount(trip.id)} existing
                prices as belonging to the new dates — they were captured for the
                old ones. Add a new date range instead.
              </p>
            )}
          </form>
        ))}
      </div>

      <form action={saveTrip} className="card mt-4 flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[14rem] flex-1 text-xs">
          <span className="muted mb-1 block">Add a date range</span>
          <input className="input" name="label" placeholder="e.g. Presidents' week 2027" />
        </label>
        <label className="text-xs">
          <span className="muted mb-1 block">Check in</span>
          <input className="input" type="date" name="checkIn" required />
        </label>
        <label className="text-xs">
          <span className="muted mb-1 block">Check out</span>
          <input className="input" type="date" name="checkOut" required />
        </label>
        <label className="text-xs">
          <span className="muted mb-1 block">Adults</span>
          <input className="input num w-20" name="adults" defaultValue={2} />
        </label>
        <label className="text-xs">
          <span className="muted mb-1 block">Children</span>
          <input className="input num w-20" name="children" defaultValue={0} />
        </label>
        <button className="btn btn-primary" type="submit">Add</button>
      </form>
    </>
  );
}

import Link from 'next/link';
import { deleteTrip, saveTrip } from '@/lib/actions';
import { nights } from '@/lib/booking';
import { read } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Date ranges are the axis the spreadsheet never had: the same resorts priced
 * for different weeks, each with its own independent history.
 */
export default function TripsPage() {
  const db = read();
  const trips = [...db.trips].sort((a, b) => a.checkIn.localeCompare(b.checkIn));

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
        {trips.map((trip) => {
          const count = db.prices.filter((p) => p.tripId === trip.id).length;
          return (
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
                  {nights(trip)}n · {count} prices
                </span>
                <button className="btn btn-primary" type="submit">Save</button>
                <Link className="btn" href={`/capture?trip=${trip.id}`}>Capture</Link>
                <button className="btn btn-ghost btn-danger" type="submit" formAction={deleteTrip}>
                  Delete
                </button>
              </div>
            </form>
          );
        })}
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

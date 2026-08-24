import Link from 'next/link';
import Rankings from '@/components/Rankings';
import { saveResort } from '@/lib/actions';
import { nights } from '@/lib/booking';
import { buildRankings, resolveTrip } from '@/lib/view';

export const dynamic = 'force-dynamic';

const money = (n: number | null) =>
  n == null ? '—' : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="muted text-xs uppercase tracking-wide">{label}</div>
      <div className="num mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="muted mt-0.5 truncate text-xs">{hint}</div>}
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: { searchParams: Promise<{ trip?: string }> }) {
  const { trip: tripParam } = await searchParams;
  const trip = resolveTrip(tripParam);
  const { rows, criteria } = buildRankings(trip);

  const live = rows.filter((r) => r.status !== 'closed' && r.price != null);
  const cheapest = [...live].sort((a, b) => a.price! - b.price!)[0];
  const bestMatch = [...live].sort(
    (a, b) => b.score - a.score || a.price! - b.price!,
  )[0];
  const bestDrop = [...live]
    .filter((r) => (r.delta ?? 0) < 0)
    .sort((a, b) => a.delta! - b.delta!)[0];
  const perfect = live.filter((r) => r.score === 100);
  const cheapestPerfect = [...perfect].sort((a, b) => a.price! - b.price!)[0];

  const lastCapture = rows
    .map((r) => r.capturedAt)
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rankings</h1>
          <p className="muted mt-1 text-sm">
            {trip ? (
              <>
                {trip.checkIn} → {trip.checkOut} · {nights(trip)} nights · {trip.adults} adults
                {trip.children ? `, ${trip.children} children` : ''}
              </>
            ) : (
              <>No trip dates yet — <Link className="underline" href="/trips">add a date range</Link> to start tracking.</>
            )}
            {lastCapture && <> · last updated {lastCapture.slice(0, 10)}</>}
          </p>
        </div>
        <Link className="btn btn-primary" href={`/capture${trip ? `?trip=${trip.id}` : ''}`}>
          Update prices
        </Link>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cheapest" value={money(cheapest?.price ?? null)} hint={cheapest?.name} />
        <Stat
          label="Best match"
          value={bestMatch ? `${bestMatch.score}%` : '—'}
          hint={bestMatch ? `${bestMatch.name} · ${money(bestMatch.price)}` : undefined}
        />
        <Stat
          label="Cheapest 100% match"
          value={money(cheapestPerfect?.price ?? null)}
          hint={cheapestPerfect?.name ?? `${perfect.length} resorts meet every criterion`}
        />
        <Stat
          label="Biggest drop"
          value={bestDrop ? money(bestDrop.delta) : '—'}
          hint={bestDrop?.name ?? 'No drops since last capture'}
        />
      </div>

      <Rankings rows={rows} criteria={criteria} tripId={trip?.id ?? null} />

      <details className="card mt-5 p-4">
        <summary className="cursor-pointer text-sm font-medium">Add a resort</summary>
        <form action={saveResort} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[14rem] flex-1 text-xs">
            <span className="muted mb-1 block">Name</span>
            <input className="input" name="name" required placeholder="e.g. Zoëtry Agua Punta Cana" />
          </label>
          <label className="text-xs">
            <span className="muted mb-1 block">Destination</span>
            <input className="input" name="destination" defaultValue="Punta Cana" />
          </label>
          <label className="text-xs">
            <span className="muted mb-1 block">Airport</span>
            <input className="input w-24" name="airport" defaultValue="PUJ" />
          </label>
          <label className="text-xs">
            <span className="muted mb-1 block">Transfer min</span>
            <input className="input num w-24" name="transferMinutes" />
          </label>
          <label className="text-xs">
            <span className="muted mb-1 block">Stars</span>
            <input className="input num w-20" name="stars" defaultValue={5} />
          </label>
          <button className="btn btn-primary" type="submit">Add resort</button>
        </form>
        <p className="muted mt-2 text-xs">
          A cheapest room and a target room are created automatically — name them
          and set their amenities on the resort page.
        </p>
      </details>
    </>
  );
}

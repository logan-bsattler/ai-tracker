'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import Rankings from './Rankings';
import { useRankConfig } from './useRankConfig';
import { rankResorts } from '@/lib/rank';
import type { AllRankings } from '@/lib/view';

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

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.max(1, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000));
}

/**
 * Reads the selected trip from the URL on the client, so the published static
 * export stays interactive without a server to resolve `?trip=`.
 */
export default function RankingsPage({
  data, canEdit,
}: { data: AllRankings; canEdit: boolean }) {
  const params = useSearchParams();
  const requested = params.get('trip');
  const trip = data.trips.find((t) => t.id === requested) ?? data.trips[0] ?? null;

  // Scoring happens here, not at build time, so re-weighting the criteria
  // takes effect without a server.
  const { config, isCustom } = useRankConfig();
  const { rows, criteria } = useMemo(
    () => rankResorts(trip ? data.resortsByTrip[trip.id] ?? [] : [], data.criteria, config),
    [data, trip, config],
  );

  // Headline figures compare like with like: a resort quoting before tax would
  // top every one of them while being more expensive in reality.
  const live = rows.filter(
    (r) => r.status !== 'closed' && r.price != null && r.taxesIncluded,
  );
  const exTaxCount = rows.filter(
    (r) => r.status !== 'closed' && r.price != null && !r.taxesIncluded,
  ).length;
  const cheapest = [...live].sort((a, b) => a.price! - b.price!)[0];
  const bestMatch = [...live].sort((a, b) => b.score - a.score || a.price! - b.price!)[0];
  const bestDrop = [...live].filter((r) => (r.delta ?? 0) < 0).sort((a, b) => a.delta! - b.delta!)[0];
  const perfect = live.filter((r) => r.score === 100);
  const cheapestPerfect = [...perfect].sort((a, b) => a.price! - b.price!)[0];

  const lastCapture = rows.map((r) => r.capturedAt).filter(Boolean).sort().pop();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rankings</h1>
          <p className="muted mt-1 text-sm">
            {trip ? (
              <>
                {trip.checkIn} → {trip.checkOut} · {nightsBetween(trip.checkIn, trip.checkOut)} nights
                {' · '}{trip.adults} adults{trip.children ? `, ${trip.children} children` : ''}
              </>
            ) : (
              <>
                No trip dates yet — <Link className="underline" href="/trips">add a date range</Link> to start tracking.
              </>
            )}
            {lastCapture && <> · last updated {lastCapture.slice(0, 10)}</>}
          </p>
        </div>
        {canEdit && (
          <Link className="btn btn-primary" href={`/capture${trip ? `?trip=${trip.id}` : ''}`}>
            Update prices
          </Link>
        )}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cheapest" value={money(cheapest?.price ?? null)} hint={cheapest?.name} />
        <Stat label="Best match" value={bestMatch ? `${bestMatch.score}%` : '—'}
          hint={bestMatch ? `${bestMatch.name} · ${money(bestMatch.price)}` : undefined} />
        <Stat label="Cheapest 100% match" value={money(cheapestPerfect?.price ?? null)}
          hint={cheapestPerfect?.name ?? `${perfect.length} resorts meet every criterion`} />
        <Stat label="Biggest drop" value={bestDrop ? money(bestDrop.delta) : '—'}
          hint={bestDrop?.name ?? 'No drops since last capture'} />
      </div>

      {exTaxCount > 0 && (
        <p className="muted -mt-3 mb-5 text-xs">
          {exTaxCount === 1 ? '1 resort quotes' : `${exTaxCount} resorts quote`} before
          tax and {exTaxCount === 1 ? 'is' : 'are'} excluded from these figures — see
          the ex-tax note below the table.
        </p>
      )}

      {isCustom && (
        <p className="muted mb-3 text-xs">
          Using your own criteria weighting.{' '}
          <Link className="underline" href="/criteria">Change or reset it</Link>.
        </p>
      )}

      <Rankings rows={rows} criteria={criteria.filter((c) => c.enabled)}
        tripId={trip?.id ?? null} />
    </>
  );
}

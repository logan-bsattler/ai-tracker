import type { ReviewScore } from '@/lib/types';

/**
 * Aggregate guest ratings.
 *
 * Sites score on different scales — TripAdvisor out of 5, Booking.com out of
 * 10 — so each is shown in its own terms and the bar underneath normalises
 * them, which is the only way "4.4" and "9.4" can sit next to each other
 * without one looking twice as good as the other.
 *
 * Scores only, never review text: see the note in lib/types.ts.
 */
export default function ReviewScores({ reviews }: { reviews: ReviewScore[] }) {
  if (reviews.length === 0) return null;

  // Best first — you want to know the ceiling before the detail.
  const sorted = [...reviews].sort((a, b) => b.score / b.outOf - a.score / a.outOf);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((r) => {
        const pct = Math.round((r.score / r.outOf) * 100);
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="muted text-xs uppercase tracking-wide">{r.source}</span>
              <span className="num text-lg font-semibold">
                {r.score}
                <span className="muted text-xs font-normal">/{r.outOf}</span>
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full"
              style={{ background: 'var(--surface-2)' }}>
              <div className="h-full rounded-full"
                style={{ width: `${pct}%`, background: 'var(--accent)' }} />
            </div>
            <div className="muted mt-1.5 flex items-center justify-between text-xs">
              <span className="num">
                {r.count != null ? `${r.count.toLocaleString('en-US')} reviews` : 'unrated count'}
              </span>
              {r.url && <span style={{ color: 'var(--accent)' }}>Read ↗</span>}
            </div>
          </>
        );

        if (!r.url) return <div key={r.source} className="card p-3">{body}</div>;
        return (
          <a key={r.source} href={r.url} target="_blank" rel="noreferrer"
            className="card block p-3 transition-colors hover:border-current"
            style={{ textDecoration: 'none' }}>
            {body}
          </a>
        );
      })}
    </div>
  );
}

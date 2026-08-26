import { Suspense } from 'react';
import WeeksView from '@/components/WeeksView';
import { buildAllRankings } from '@/lib/view';

export { PAGE_DYNAMIC as dynamic } from '@/lib/mode';

export default function WeeksPage() {
  // Every trip's rows are computed here and rendered together, so the static
  // export can show every week at once with no server. See buildAllRankings().
  return (
    <Suspense fallback={<div className="muted p-8 text-center text-sm">Loading weeks…</div>}>
      <WeeksView data={buildAllRankings()} />
    </Suspense>
  );
}

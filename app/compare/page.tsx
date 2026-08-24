import { Suspense } from 'react';
import CompareView from '@/components/CompareView';
import { buildAllRankings } from '@/lib/view';

export { PAGE_DYNAMIC as dynamic } from '@/lib/mode';

export default function ComparePage() {
  // Which resorts to compare comes from `?ids=` and is resolved in the browser,
  // so this page works as a static export. See buildAllRankings().
  return (
    <Suspense fallback={<div className="muted p-8 text-center text-sm">Loading comparison…</div>}>
      <CompareView data={buildAllRankings()} />
    </Suspense>
  );
}

import { Suspense } from 'react';
import EditorOnly from '@/components/EditorOnly';
import RankingsPage from '@/components/RankingsPage';
import { saveResort } from '@/lib/actions';
import { IS_STATIC } from '@/lib/mode';
import { buildAllRankings } from '@/lib/view';

export { PAGE_DYNAMIC as dynamic } from '@/lib/mode';

export default function HomePage() {
  // Every trip's rows are computed here and selected in the browser, so the
  // static export stays interactive. See buildAllRankings().
  const data = buildAllRankings();

  return (
    <>
      <Suspense fallback={<div className="muted p-8 text-center text-sm">Loading rankings…</div>}>
        <RankingsPage data={data} canEdit={!IS_STATIC} />
      </Suspense>

      <EditorOnly>
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
      </EditorOnly>
    </>
  );
}

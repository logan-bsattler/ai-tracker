import { addCriterion, deleteCriterion, saveCriteria } from '@/lib/actions';
import { read } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * The spreadsheet's rollup formula treated Room Service, Oceanview and Soaking
 * Tub as equally binding — one "No" and the whole resort read "No". Weights
 * replace that: a criterion you merely prefer costs you a few match points, a
 * criterion you mark required disqualifies the room outright.
 */
export default function CriteriaPage() {
  const db = read();
  const criteria = [...db.criteria].sort((a, b) => a.sortOrder - b.sortOrder);
  const totalWeight = criteria.reduce((s, c) => s + Math.max(0, c.weight), 0);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Criteria</h1>
        <p className="muted mt-1 max-w-2xl text-sm">
          Weights decide how much each amenity moves the match score. Marking one
          <em> required</em> is stricter: any room missing it is flagged as
          disqualified rather than merely scoring lower.
        </p>
      </div>

      <form action={saveCriteria} className="card mb-4 overflow-x-auto">
        <table className="grid">
          <thead>
            <tr>
              <th>Criterion</th>
              <th style={{ width: 120 }}>Weight</th>
              <th style={{ width: 110 }}>Share</th>
              <th style={{ width: 110 }}>Required</th>
              <th style={{ width: 120 }}>Rooms with it</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => {
              const withIt = db.rooms.filter((r) => r.amenities[c.key] === true).length;
              const share = totalWeight > 0 ? Math.round((Math.max(0, c.weight) / totalWeight) * 100) : 0;
              return (
                <tr key={c.id}>
                  <td>
                    <input type="hidden" name="criterionId" value={c.id} />
                    <input className="input" name={`label:${c.id}`} defaultValue={c.label} />
                    <div className="muted mt-1 text-xs">
                      <code>{c.key}</code>
                    </div>
                  </td>
                  <td>
                    <input className="input num" name={`weight:${c.id}`} defaultValue={c.weight} />
                  </td>
                  <td className="num muted">{share}%</td>
                  <td>
                    <input type="checkbox" name={`required:${c.id}`} defaultChecked={c.required} />
                  </td>
                  <td className="num muted">{withIt} / {db.rooms.length}</td>
                  <td className="text-right">
                    <button className="btn btn-ghost btn-danger" type="submit"
                      formAction={deleteCriterion} name="id" value={c.id}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex justify-end p-3">
          <button className="btn btn-primary" type="submit">Save weights</button>
        </div>
      </form>

      <form action={addCriterion} className="card flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[14rem] flex-1 text-xs">
          <span className="muted mb-1 block">Add a criterion</span>
          <input className="input" name="label" placeholder="e.g. Swim-up access, Adults only, Casino" />
        </label>
        <label className="text-xs">
          <span className="muted mb-1 block">Weight</span>
          <input className="input num w-24" name="weight" defaultValue={2} />
        </label>
        <label className="flex items-center gap-1.5 pb-2 text-xs">
          <input type="checkbox" name="required" />
          <span>Required</span>
        </label>
        <button className="btn btn-primary" type="submit">Add</button>
      </form>

      <p className="muted mt-3 text-xs">
        New criteria start unchecked on every room — set them per room on each
        resort&rsquo;s page.
      </p>
    </>
  );
}

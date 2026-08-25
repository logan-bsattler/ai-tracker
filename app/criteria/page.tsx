import { addCriterion, moveCriterion, removeCriterion, saveCriteria } from '@/lib/actions';
import { read } from '@/lib/db';
import { IS_STATIC } from '@/lib/mode';

export { PAGE_DYNAMIC as dynamic } from '@/lib/mode';

/**
 * The criteria list is a priority ranking, not a set of numbers to invent.
 * Position decides weight — the top criterion counts most — and anything
 * switched off plays no part in scoring without having to be deleted.
 *
 * Read-only on the published site; see lib/mode.ts.
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
          Ordered by how much they matter — the one at the top counts most.
          Move a criterion up or down to change its weight; switch one off to
          leave it out of scoring entirely. Marking one <em>required</em> is
          stricter still: any room missing it is disqualified rather than
          merely scoring lower.
        </p>
      </div>

      {IS_STATIC ? (
        <div className="card overflow-x-auto">
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>Criterion</th>
                <th className="text-right">Weight</th>
                <th className="text-right">Share</th>
                <th className="text-right">Required</th>
                <th className="text-right">Rooms with it</th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((c, i) => (
                <tr key={c.id} style={{ opacity: c.enabled ? 1 : 0.45 }}>
                  <td className="num muted">{i + 1}</td>
                  <td className="font-medium">
                    {c.label}
                    {!c.enabled && <span className="chip ml-2">off</span>}
                  </td>
                  <td className="num text-right">{c.weight}</td>
                  <td className="num muted text-right">
                    {totalWeight > 0 ? Math.round((Math.max(0, c.weight) / totalWeight) * 100) : 0}%
                  </td>
                  <td className="muted text-right">{c.required ? 'Yes' : '—'}</td>
                  <td className="num muted text-right">
                    {db.rooms.filter((r) => r.amenities[c.key] === true).length} / {db.rooms.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <form action={saveCriteria} className="card mb-4">
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {criteria.map((c, i) => {
                const withIt = db.rooms.filter((r) => r.amenities[c.key] === true).length;
                const share = totalWeight > 0
                  ? Math.round((Math.max(0, c.weight) / totalWeight) * 100) : 0;
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 p-3"
                    style={{ opacity: c.enabled ? 1 : 0.55 }}>
                    <input type="hidden" name="criterionId" value={c.id} />

                    {/* Reorder. Submits to moveCriterion, so it works without JS. */}
                    <div className="flex flex-col gap-0.5">
                      {/* Arguments are bound here, not sent as name/value:
                          Next overwrites a submit button's name with the
                          action id. */}
                      <button className="btn btn-ghost px-1.5 py-0" type="submit"
                        formAction={moveCriterion.bind(null, c.id, 'up')}
                        disabled={i === 0} aria-label={`Move ${c.label} up`}
                        style={{ opacity: i === 0 ? 0.3 : 1 }}>&#9650;</button>
                      <button className="btn btn-ghost px-1.5 py-0" type="submit"
                        formAction={moveCriterion.bind(null, c.id, 'down')}
                        disabled={i === criteria.length - 1} aria-label={`Move ${c.label} down`}
                        style={{ opacity: i === criteria.length - 1 ? 0.3 : 1 }}>&#9660;</button>
                    </div>

                    <span className="num muted w-5 text-sm">{i + 1}</span>

                    <input className="input min-w-[10rem] flex-1" name={`label:${c.id}`}
                      defaultValue={c.label} />

                    <div className="num muted w-24 text-xs">
                      weight {c.weight} · {share}%
                    </div>

                    <label className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" name={`enabled:${c.id}`} defaultChecked={c.enabled} />
                      <span>On</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" name={`required:${c.id}`} defaultChecked={c.required} />
                      <span>Required</span>
                    </label>

                    <span className="muted num w-20 text-right text-xs">
                      {withIt}/{db.rooms.length} rooms
                    </span>

                    <button className="btn btn-ghost btn-danger" type="submit"
                      formAction={removeCriterion.bind(null, c.id)}>
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end p-3">
              <button className="btn btn-primary" type="submit">Save</button>
            </div>
          </form>

          <p className="muted mb-4 text-xs">
            The up and down arrows save immediately. Renaming, On and Required
            need the Save button.
          </p>

          <form action={addCriterion} className="card flex flex-wrap items-end gap-3 p-4">
            <label className="min-w-[14rem] flex-1 text-xs">
              <span className="muted mb-1 block">Add a criterion</span>
              <input className="input" name="label" placeholder="e.g. Adults only, Casino, Swim-up bar" />
            </label>
            <label className="flex items-center gap-1.5 pb-2 text-xs">
              <input type="checkbox" name="required" />
              <span>Required</span>
            </label>
            <button className="btn btn-primary" type="submit">Add</button>
          </form>

          <p className="muted mt-3 text-xs">
            New criteria join the bottom of the list with the lowest weight, and
            start unset on every room — set them per room on each resort&rsquo;s page.
          </p>
        </>
      )}
    </>
  );
}

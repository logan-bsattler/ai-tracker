'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Sparkline from './Sparkline';
import type { EffectiveCriterion, RankingRow } from '@/lib/rank';

const money = (n: number | null) =>
  n == null ? '—' : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

type SortKey = 'price' | 'score' | 'value' | 'transfer' | 'name' | 'drop';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'price', label: 'Price' },
  { key: 'score', label: 'Match score' },
  { key: 'value', label: '$ per match point' },
  { key: 'drop', label: 'Biggest drop' },
  { key: 'transfer', label: 'Transfer time' },
  { key: 'name', label: 'Name' },
];

export default function Rankings({
  rows, criteria, tripId,
}: { rows: RankingRow[]; criteria: EffectiveCriterion[]; tripId: string | null }) {
  const [q, setQ] = useState('');
  const [destination, setDestination] = useState('all');
  const [maxTransfer, setMaxTransfer] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [mustHave, setMustHave] = useState<string[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  const [sort, setSort] = useState<SortKey>('price');
  const [selected, setSelected] = useState<string[]>([]);

  const destinations = useMemo(
    () => [...new Set(rows.map((r) => r.destination))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const transferCap = Number(maxTransfer) || Infinity;
    const priceCap = Number(maxPrice) || Infinity;

    const out = rows.filter((r) => {
      if (!showClosed && r.status === 'closed') return false;
      if (destination !== 'all' && r.destination !== destination) return false;
      if (needle && !`${r.name} ${r.destination} ${r.targetName ?? ''}`.toLowerCase().includes(needle)) return false;
      if (r.transferMinutes != null && r.transferMinutes > transferCap) return false;
      if (r.price != null && r.price > priceCap) return false;
      if (mustHave.some((k) => r.met[k] !== true)) return false;
      return true;
    });

    const cmp: Record<SortKey, (a: RankingRow, b: RankingRow) => number> = {
      // Unpriced resorts sink to the bottom of every numeric sort rather than
      // sorting as zero.
      price: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
      score: (a, b) => b.score - a.score || (a.price ?? Infinity) - (b.price ?? Infinity),
      value: (a, b) => (a.valueIndex ?? Infinity) - (b.valueIndex ?? Infinity),
      drop: (a, b) => (a.delta ?? 0) - (b.delta ?? 0),
      transfer: (a, b) => (a.transferMinutes ?? Infinity) - (b.transferMinutes ?? Infinity),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return out.sort(cmp[sort]);
  }, [rows, q, destination, maxTransfer, maxPrice, mustHave, showClosed, sort]);

  const toggle = (list: string[], set: (v: string[]) => void, key: string) =>
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  const tripQuery = tripId ? `?trip=${tripId}` : '';

  return (
    <>
      {/* Filter bar ---------------------------------------------------- */}
      <div className="card mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-full text-xs sm:min-w-[13rem] sm:flex-1">
            <span className="muted mb-1 block">Search</span>
            <input className="input" placeholder="Resort or room name"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="flex-1 text-xs sm:flex-none">
            <span className="muted mb-1 block">Destination</span>
            <select className="select w-full" value={destination}
              onChange={(e) => setDestination(e.target.value)}>
              <option value="all">All</option>
              {destinations.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="flex-1 text-xs sm:flex-none">
            <span className="muted mb-1 block">Max transfer</span>
            <input className="input num w-full sm:w-28" inputMode="numeric" placeholder="min"
              value={maxTransfer} onChange={(e) => setMaxTransfer(e.target.value)} />
          </label>
          <label className="flex-1 text-xs sm:flex-none">
            <span className="muted mb-1 block">Max price</span>
            <input className="input num w-full sm:w-28" inputMode="numeric" placeholder="$"
              value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          </label>
          <label className="w-full text-xs sm:w-auto">
            <span className="muted mb-1 block">Sort by</span>
            <select className="select w-full" value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 hairline">
          <span className="muted text-xs">Must have</span>
          {criteria.map((c) => (
            <button key={c.key} type="button"
              className={`chip ${mustHave.includes(c.key) ? 'chip-on' : ''}`}
              onClick={() => toggle(mustHave, setMustHave, c.key)}>
              {c.label}
            </button>
          ))}
          <button type="button"
            className={`chip ${showClosed ? 'chip-on' : ''}`}
            onClick={() => setShowClosed(!showClosed)}>
            Show closed
          </button>
          <span className="muted ml-auto text-xs num">
            {filtered.length} of {rows.length}
          </span>
        </div>
      </div>

      {/* Compare tray -------------------------------------------------- */}
      {selected.length > 0 && (
        <div className="card sticky bottom-3 z-10 mb-4 flex flex-wrap items-center gap-3 p-3 shadow-lg md:static md:shadow-none">
          <span className="text-sm num">{selected.length} selected</span>
          <Link className="btn btn-primary"
            href={`/compare?ids=${selected.join(',')}${tripId ? `&trip=${tripId}` : ''}`}>
            Compare side by side
          </Link>
          <button className="btn btn-ghost" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      {/* Table ---------------------------------------------------------- */}
      {/* Mobile: cards. A twelve-column table cannot survive a 390px screen,
          so the same data is restacked rather than left to scroll sideways. */}
      <div className="space-y-3 md:hidden">
        {filtered.map((r) => (
          <div key={r.id} className="card p-4"
            style={{ opacity: r.status === 'closed' ? 0.55 : 1 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/resorts/${r.id}${tripQuery}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                <div className="muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                  <span>{r.destination}</span>
                  {r.transferMinutes != null && <span className="num">{r.transferMinutes} min</span>}
                  {r.status === 'closed' && <span className="chip">Closed</span>}
                  {r.missingRequired.length > 0 && (
                    <span className="chip" style={{ color: 'var(--up)' }}>
                      missing must-have
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="num text-lg font-semibold leading-tight">{money(r.price)}</div>
                <div className="mt-0.5 flex flex-wrap justify-end gap-1">
                  {r.onSale && <span className="chip chip-on">sale</span>}
                  {r.isLow && r.history.length > 1 && <span className="chip chip-on">low</span>}
                  {!r.taxesIncluded && (
                    <span className="chip" style={{ color: 'var(--up)' }}>ex-tax</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-2 text-sm">
              {r.targetName == null ? <span className="muted">No room set</span>
                : r.targetUrl ? (
                  <a href={r.targetUrl} target="_blank" rel="noreferrer" className="hover:underline">
                    {r.targetName} <span className="muted">&#8599;</span>
                  </a>
                ) : r.targetName}
            </div>
            {r.entryPrice != null && (
              <div className="muted num mt-0.5 text-xs">
                cheapest {money(r.entryPrice)}
                {r.upgradeCost != null && r.upgradeCost > 0 && ` · +${money(r.upgradeCost)} to upgrade`}
                {r.pricedRooms > 1 && ` · ${r.pricedRooms} rooms`}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {criteria.map((c) => {
                const has = r.met[c.key] === true;
                const entryHas = r.entryMet[c.key] === true;
                // Colour alone is a weak signal on a phone, so an unmet
                // criterion is struck through as well as left unhighlighted.
                return (
                  <span key={c.key} className={`chip ${has ? 'chip-on' : ''}`}
                    style={has ? undefined : { textDecoration: 'line-through', opacity: 0.65 }}>
                    {c.label}{has && !entryHas ? ' (upgrade)' : ''}
                  </span>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 hairline">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-14 overflow-hidden rounded-full"
                  style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${r.score}%`, background: 'var(--accent)' }} />
                </div>
                <span className="muted num text-xs">{r.score}%</span>
                {r.delta != null && r.delta !== 0 && (
                  <span className="num text-xs"
                    style={{ color: r.delta < 0 ? 'var(--down)' : 'var(--up)' }}>
                    {r.delta > 0 ? '+' : ''}{money(r.delta)}
                  </span>
                )}
              </div>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={selected.includes(r.id)}
                  aria-label={`Select ${r.name} to compare`}
                  onChange={() => toggle(selected, setSelected, r.id)} />
                <span className="muted">compare</span>
              </label>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card muted p-8 text-center text-sm">
            No resorts match these filters.
          </div>
        )}
      </div>

      <div className="card hidden overflow-x-auto md:block">
        <table className="grid">
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th>Resort</th>
              <th>Room you&rsquo;d book</th>
              {criteria.map((c) => <th key={c.key} className="text-center">{c.label}</th>)}
              <th className="text-right">Match</th>
              <th className="text-right">Entry</th>
              <th className="text-right">Price</th>
              <th className="text-right">Change</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} style={{ opacity: r.status === 'closed' ? 0.5 : 1 }}>
                <td>
                  <input type="checkbox" checked={selected.includes(r.id)}
                    aria-label={`Select ${r.name} to compare`}
                    onChange={() => toggle(selected, setSelected, r.id)} />
                </td>

                <td>
                  <Link href={`/resorts/${r.id}${tripQuery}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <div className="muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                    <span>{r.destination}</span>
                    {r.transferMinutes != null && <span className="num">{r.transferMinutes} min</span>}
                    {r.status === 'closed' && <span className="chip">Closed</span>}
                    {r.missingRequired.length > 0 && (
                      <span className="chip" style={{ color: 'var(--up)' }}>
                        missing must-have
                      </span>
                    )}
                  </div>
                </td>

                <td className="max-w-[16rem]">
                  <div className="truncate" title={r.targetName ?? ''}>
                    {r.targetName == null ? '—' : r.targetUrl ? (
                      <a href={r.targetUrl} target="_blank" rel="noreferrer"
                        className="hover:underline" title={`Open ${r.targetName} on the booking site`}>
                        {r.targetName} <span className="muted">↗</span>
                      </a>
                    ) : r.targetName}
                  </div>
                  {r.upgradeCost != null && r.upgradeCost > 0 && (
                    <div className="muted text-xs num">
                      +{money(r.upgradeCost)} over cheapest
                      {r.pricedRooms > 1 && ` · ${r.pricedRooms} rooms priced`}
                    </div>
                  )}
                </td>

                {criteria.map((c) => {
                  const has = r.met[c.key] === true;
                  const entryHas = r.entryMet[c.key] === true;
                  return (
                    <td key={c.key} className="text-center">
                      {has ? (
                        <span title={entryHas ? 'Included in the entry room too' : 'Only with the upgraded room'}
                          style={{ color: entryHas ? 'var(--accent)' : 'var(--text-dim)' }}>
                          {entryHas ? '●' : '◐'}
                        </span>
                      ) : (
                        <span className="muted" title="Not available">·</span>
                      )}
                    </td>
                  );
                })}

                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-14 overflow-hidden rounded-full"
                      style={{ background: 'var(--surface-2)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${r.score}%`, background: 'var(--accent)' }} />
                    </div>
                    <span className="num text-xs muted">{r.score}</span>
                  </div>
                </td>

                <td className="num text-right muted">{money(r.entryPrice)}</td>

                <td className="num text-right">
                  <span className="font-semibold">{money(r.price)}</span>
                  <div className="flex items-center justify-end gap-1">
                    {r.onSale && <span className="chip chip-on">sale</span>}
                    {r.isLow && r.history.length > 1 && <span className="chip chip-on">low</span>}
                    {!r.taxesIncluded && (
                      <span className="chip" style={{ color: 'var(--up)' }}
                        title="This resort quotes before tax, so this figure is lower than what you would pay and is not comparable to the others.">
                        ex-tax
                      </span>
                    )}
                  </div>
                </td>

                <td className="num text-right">
                  {r.delta == null ? <span className="muted">—</span> : (
                    <span style={{ color: r.delta < 0 ? 'var(--down)' : r.delta > 0 ? 'var(--up)' : 'var(--text-dim)' }}>
                      {r.delta > 0 ? '+' : ''}{money(r.delta)}
                    </span>
                  )}
                </td>

                <td><Sparkline points={r.history} /></td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={9 + criteria.length} className="muted py-10 text-center">
                  No resorts match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted mt-3 text-xs">
        ● amenity included in the entry room · ◐ only with the upgraded room · · not available
      </p>
      {filtered.some((r) => !r.taxesIncluded) && (
        <p className="mt-1 text-xs" style={{ color: 'var(--up)' }}>
          ex-tax marks a resort that quotes before taxes and fees. Its price is
          lower than what you would actually pay, so it is not comparable to the
          rest and is left out of the totals above.
        </p>
      )}
    </>
  );
}

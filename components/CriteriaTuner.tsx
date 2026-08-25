'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRankConfig } from './useRankConfig';
import { effectiveCriteria, encodeConfig, type CriterionLite, type RankConfig } from '@/lib/rank';

/**
 * Criteria tuning on the published site.
 *
 * The published order is the default; anything changed here is the viewer's
 * own, kept in this browser. It never writes back to the repo — the local app
 * remains the source of truth — but it makes "what if oceanfront mattered
 * more" answerable on a phone instead of requiring a commit.
 */
export default function CriteriaTuner({
  published, roomCounts, totalRooms,
}: {
  published: CriterionLite[];
  roomCounts: Record<string, number>;
  totalRooms: number;
}) {
  const { config, setConfig, isCustom } = useRankConfig();
  const [copied, setCopied] = useState(false);

  const list = effectiveCriteria(published, config);
  const totalWeight = list.reduce((s, c) => s + c.weight, 0);

  /** Write the whole current list back as an explicit config. */
  const commit = (next: typeof list) => setConfig({
    order: next.map((c) => c.key),
    off: next.filter((c) => !c.enabled).map((c) => c.key),
    required: next.filter((c) => c.required).map((c) => c.key),
  });

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  const toggle = (i: number, field: 'enabled' | 'required') => {
    const next = list.map((c, k) => (k === i ? { ...c, [field]: !c[field] } : c));
    commit(next);
  };

  const copyLink = () => {
    const cfg: RankConfig = {
      order: list.map((c) => c.key),
      off: list.filter((c) => !c.enabled).map((c) => c.key),
      required: list.filter((c) => c.required).map((c) => c.key),
    };
    const url = `${window.location.origin}${window.location.pathname}?${encodeConfig(cfg)}`;
    navigator.clipboard?.writeText(url).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => { window.prompt('Copy this link:', url); },
    );
  };

  return (
    <>
      <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
        {list.map((c, i) => {
          const pct = totalWeight > 0 ? Math.round((c.weight / totalWeight) * 100) : 0;
          return (
            <div key={c.key} className="flex items-center gap-2 p-3"
              style={{ opacity: c.enabled ? 1 : 0.5 }}>
              <div className="flex shrink-0 flex-col gap-0.5">
                <button className="btn btn-ghost px-1.5 py-0" onClick={() => move(i, -1)}
                  disabled={i === 0} aria-label={`Move ${c.label} up`}
                  style={{ opacity: i === 0 ? 0.25 : 1 }}>&#9650;</button>
                <button className="btn btn-ghost px-1.5 py-0" onClick={() => move(i, 1)}
                  disabled={i === list.length - 1} aria-label={`Move ${c.label} down`}
                  style={{ opacity: i === list.length - 1 ? 0.25 : 1 }}>&#9660;</button>
              </div>

              <span className="num muted w-4 shrink-0 text-sm">{i + 1}</span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className="font-medium">{c.label}</span>
                  <span className="muted num text-xs">
                    {roomCounts[c.key] ?? 0}/{totalRooms} rooms
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 max-w-[9rem] flex-1 overflow-hidden rounded-full"
                    style={{ background: 'var(--surface-2)' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: 'var(--accent)' }} />
                  </div>
                  <span className="muted num text-xs">{pct}%</span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                <button type="button" className={`chip ${c.enabled ? 'chip-on' : ''}`}
                  onClick={() => toggle(i, 'enabled')}
                  aria-pressed={c.enabled}>
                  {c.enabled ? 'On' : 'Off'}
                </button>
                <button type="button" className={`chip ${c.required ? 'chip-on' : ''}`}
                  onClick={() => toggle(i, 'required')}
                  aria-pressed={c.required}
                  title="Rooms missing a required criterion are disqualified, not just scored lower">
                  {c.required ? 'Required' : 'Optional'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link className="btn btn-primary" href="/">See the rankings</Link>
        <button className="btn" onClick={copyLink}>{copied ? 'Link copied' : 'Copy as link'}</button>
        {isCustom && (
          <button className="btn btn-ghost" onClick={() => setConfig(null)}>
            Reset to published
          </button>
        )}
        <span className="muted ml-auto text-xs">
          {isCustom ? 'Your weighting — saved in this browser' : 'Published weighting'}
        </span>
      </div>
    </>
  );
}

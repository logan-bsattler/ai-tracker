'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Photo } from '@/lib/types';

/**
 * Photo grid with a lightbox.
 *
 * The images are hotlinked from the resorts' own sites, which means some of
 * them will eventually 404 when a resort reshuffles its CDN. A broken image is
 * dropped from the grid rather than left as a torn-page icon, so the gallery
 * quietly shrinks instead of looking broken.
 */
export default function Gallery({
  photos, alt, variant = 'grid',
}: {
  photos: Photo[];
  alt: string;
  /** `strip` is the inline version used per room, where a full grid would
   *  dominate a table row. Both share the same lightbox. */
  variant?: 'grid' | 'strip';
}) {
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<number | null>(null);

  const shown = photos.filter((p) => !broken.has(p.url));

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((by: number) => {
    setOpen((i) => (i == null ? null : (i + by + shown.length) % shown.length));
  }, [shown.length]);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    // The page behind a full-screen overlay should not scroll with it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close, step]);

  if (shown.length === 0) return null;

  const current = open == null ? null : shown[open];

  return (
    <>
      <div className={variant === 'strip'
        ? 'flex flex-wrap gap-1.5'
        : 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4'}>
        {shown.map((p, i) => (
          <button key={p.url} type="button" onClick={() => setOpen(i)}
            className="group relative block overflow-hidden rounded-lg"
            style={variant === 'strip'
              ? { width: 64, height: 48, background: 'var(--surface-2)' }
              : { aspectRatio: '4 / 3', background: 'var(--surface-2)' }}
            aria-label={p.caption ? `${p.caption} — open larger` : `${alt}, photo ${i + 1} — open larger`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption ?? alt} loading="lazy"
              onError={() => setBroken((b) => new Set(b).add(p.url))}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
            {p.caption && variant === 'grid' && (
              <span className="absolute inset-x-0 bottom-0 truncate px-2 py-1 text-left text-xs text-white"
                style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.65))' }}>
                {p.caption}
              </span>
            )}
          </button>
        ))}
      </div>

      {current && (
        <div role="dialog" aria-modal="true" aria-label={current.caption ?? alt}
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}>
          <button type="button" onClick={close} aria-label="Close"
            className="absolute right-4 top-4 text-2xl leading-none text-white/80 hover:text-white">
            ×
          </button>

          {shown.length > 1 && (
            <>
              <button type="button" aria-label="Previous photo"
                onClick={(e) => { e.stopPropagation(); step(-1); }}
                className="absolute left-2 p-4 text-3xl leading-none text-white/70 hover:text-white sm:left-6">
                ‹
              </button>
              <button type="button" aria-label="Next photo"
                onClick={(e) => { e.stopPropagation(); step(1); }}
                className="absolute right-2 p-4 text-3xl leading-none text-white/70 hover:text-white sm:right-6">
                ›
              </button>
            </>
          )}

          <figure onClick={(e) => e.stopPropagation()} className="max-h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt={current.caption ?? alt}
              className="mx-auto max-h-[80vh] w-auto max-w-full rounded-lg object-contain" />
            <figcaption className="mt-2 text-center text-xs text-white/70">
              {current.caption}
              {current.caption && current.credit && ' · '}
              {current.credit && <span>{current.credit}</span>}
              {shown.length > 1 && (
                <span className="num ml-2 text-white/50">{open! + 1}/{shown.length}</span>
              )}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}

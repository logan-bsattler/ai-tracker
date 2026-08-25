'use client';

import { useEffect, useState } from 'react';
import type { Trip } from '@/lib/types';

/**
 * The selected trip lives in the URL (?trip=...) so every page reads the same
 * value and links stay shareable.
 *
 * This reads window.location rather than useSearchParams(): the switcher sits
 * in the root layout, and layouts are not re-rendered per query string on a
 * static export, so useSearchParams() there stayed empty and the control fell
 * back to the first trip — showing "April" while the page below rendered May.
 */
export default function TripSwitcher({ trips }: { trips: Trip[] }) {
  const [current, setCurrent] = useState<string>('');

  const readFromUrl = () => {
    const id = new URLSearchParams(window.location.search).get('trip');
    setCurrent(id && trips.some((t) => t.id === id) ? id : trips[0]?.id ?? '');
  };

  useEffect(() => {
    readFromUrl();
    // Catches back/forward and any client-side navigation that changes ?trip=.
    window.addEventListener('popstate', readFromUrl);
    return () => window.removeEventListener('popstate', readFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips]);

  if (trips.length === 0) return null;

  return (
    <label className="flex w-full items-center gap-2 text-xs sm:w-auto">
      <span className="muted whitespace-nowrap">Dates</span>
      <select
        className="select w-full sm:max-w-[22rem]"
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(window.location.search);
          next.set('trip', e.target.value);
          // A full navigation, so every page below re-reads the trip. The data
          // is already in the bundle, so this stays fast.
          window.location.search = next.toString();
        }}
      >
        {trips.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label} · {t.adults}a{t.children ? `/${t.children}c` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

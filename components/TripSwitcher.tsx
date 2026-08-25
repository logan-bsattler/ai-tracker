'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Trip } from '@/lib/types';

/**
 * The selected trip lives in the URL (?trip=...) so every page reads the same
 * value and links stay shareable/bookmarkable.
 */
export default function TripSwitcher({ trips }: { trips: Trip[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get('trip') ?? trips[0]?.id ?? '';

  if (trips.length === 0) return null;

  return (
    <label className="flex w-full items-center gap-2 text-xs sm:w-auto">
      <span className="muted whitespace-nowrap">Dates</span>
      <select
        className="select w-full sm:max-w-[22rem]"
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set('trip', e.target.value);
          router.push(`${pathname}?${next.toString()}`);
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

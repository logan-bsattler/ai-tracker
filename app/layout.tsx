import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import './globals.css';
import { read } from '@/lib/db';
import TripSwitcher from '@/components/TripSwitcher';
import { IS_STATIC } from '@/lib/mode';

export const metadata: Metadata = {
  title: 'All Inclusive Tracker',
  description: 'Track and compare all-inclusive resort room rates over time.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Rates are read on phones; let people zoom into a dense row.
  maximumScale: 5,
};

const NAV = [
  { href: '/', label: 'Rankings' },
  // Capturing needs a server to post to, so it is absent from the static site.
  ...(IS_STATIC ? [] : [{ href: '/capture', label: 'Capture' }]),
  { href: '/compare', label: 'Compare' },
  { href: '/weeks', label: 'Weeks' },
  { href: '/trips', label: 'Trips' },
  { href: '/criteria', label: 'Criteria' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const db = read();
  const trips = db.trips.filter((t) => !t.archived);

  return (
    <html lang="en">
      <body>
        {/* Static on phones: the two-row header would otherwise hold ~17% of
            the viewport while scrolling a long list. */}
        <header className="z-20 backdrop-blur sm:sticky sm:top-0" style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)', borderBottom: '1px solid var(--border)' }}>
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-5 sm:py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span aria-hidden className="text-lg">🌴</span>
              <span>All Inclusive</span>
            </Link>
            <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1
              [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="btn btn-ghost">
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="w-full sm:ml-auto sm:w-auto">
              <Suspense fallback={null}>
                <TripSwitcher trips={trips} />
              </Suspense>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-5 sm:py-7">{children}</main>
      </body>
    </html>
  );
}

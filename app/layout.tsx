import type { Metadata } from 'next';
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

const NAV = [
  { href: '/', label: 'Rankings' },
  // Capturing needs a server to post to, so it is absent from the static site.
  ...(IS_STATIC ? [] : [{ href: '/capture', label: 'Capture' }]),
  { href: '/compare', label: 'Compare' },
  { href: '/trips', label: 'Trips' },
  { href: '/criteria', label: 'Criteria' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const db = read();
  const trips = db.trips.filter((t) => !t.archived);

  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-20 backdrop-blur" style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)', borderBottom: '1px solid var(--border)' }}>
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span aria-hidden className="text-lg">🌴</span>
              <span>All Inclusive</span>
            </Link>
            <nav className="flex items-center gap-1">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="btn btn-ghost">
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto">
              <Suspense fallback={null}>
                <TripSwitcher trips={trips} />
              </Suspense>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-5 py-7">{children}</main>
      </body>
    </html>
  );
}

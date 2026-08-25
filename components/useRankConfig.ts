'use client';

import { useCallback, useEffect, useState } from 'react';
import { decodeConfig, type RankConfig } from '@/lib/rank';

const KEY = 'ai-tracker:rank-config';

/**
 * The viewer's own criteria weighting, on top of the published one.
 *
 * Precedence is URL, then this browser's saved copy, then the published
 * defaults. A link therefore always shows the sender's weighting rather than
 * silently picking up the recipient's — and clearing reverts to whatever the
 * local app last published.
 *
 * Kept out of React state on first render so the markup matches the server's
 * and hydration doesn't warn; the stored config is applied immediately after.
 */
export function useRankConfig() {
  const [config, setConfig] = useState<RankConfig | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fromUrl = decodeConfig(new URLSearchParams(window.location.search));
    if (fromUrl) {
      setConfig(fromUrl);
      setReady(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setConfig(JSON.parse(raw) as RankConfig);
    } catch {
      // A malformed or unavailable store just means "use the published order".
    }
    setReady(true);
  }, []);

  const save = useCallback((next: RankConfig | null) => {
    setConfig(next);
    try {
      if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
      else window.localStorage.removeItem(KEY);
    } catch {
      // Private browsing and similar: the change still applies for this visit.
    }
  }, []);

  return { config, setConfig: save, ready, isCustom: config != null };
}

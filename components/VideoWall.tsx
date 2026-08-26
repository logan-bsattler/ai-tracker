'use client';

import { useState } from 'react';
import type { VideoRef } from '@/lib/types';

/**
 * Review and walkthrough videos.
 *
 * Each one is a facade: a thumbnail and a play button until you click it, at
 * which point the real iframe is swapped in. Embedding four players directly
 * would pull roughly a megabyte of YouTube's JavaScript into every resort page
 * for videos most visitors never play.
 *
 * youtube-nocookie.com is the same player without the tracking cookie on first
 * load, which costs nothing here.
 */
export default function VideoWall({ videos }: { videos: VideoRef[] }) {
  const [playing, setPlaying] = useState<string | null>(null);

  if (videos.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {videos.map((v) => (
        <div key={v.youtubeId}>
          <div className="relative overflow-hidden rounded-lg"
            style={{ aspectRatio: '16 / 9', background: 'var(--surface-2)' }}>
            {playing === v.youtubeId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${v.youtubeId}?autoplay=1`}
                title={v.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : (
              <button type="button" onClick={() => setPlaying(v.youtubeId)}
                className="group absolute inset-0 h-full w-full"
                aria-label={`Play ${v.title}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`}
                  alt="" loading="lazy"
                  className="h-full w-full object-cover" />
                <span aria-hidden
                  className="absolute inset-0 flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(0,0,0,0.25)' }}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full text-xl text-white transition-transform duration-200 group-hover:scale-110"
                    style={{ background: 'rgba(0,0,0,0.7)' }}>
                    ▶
                  </span>
                </span>
              </button>
            )}
          </div>
          <div className="mt-1.5 text-sm">
            <a href={`https://www.youtube.com/watch?v=${v.youtubeId}`}
              target="_blank" rel="noreferrer" className="hover:underline">
              {v.title} <span className="muted">↗</span>
            </a>
            {v.channel && <div className="muted text-xs">{v.channel}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

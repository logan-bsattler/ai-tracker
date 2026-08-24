import { IS_STATIC } from '@/lib/mode';

/**
 * Renders children only in the read-write build. The published GitHub Pages
 * site is a static export with no server to accept a form post, so every
 * editing control is omitted there rather than rendered and broken.
 */
export default function EditorOnly({ children }: { children: React.ReactNode }) {
  if (IS_STATIC) return null;
  return <>{children}</>;
}

/** Inverse: a note shown only on the published site. */
export function StaticOnly({ children }: { children: React.ReactNode }) {
  if (!IS_STATIC) return null;
  return <>{children}</>;
}

/**
 * The app has two shapes:
 *
 *   dev / local  — full read-write app. You add resorts, edit criteria, and
 *                  capture prices through forms backed by server actions.
 *
 *   static       — the public build published to GitHub Pages. Static export
 *                  cannot run server actions, so every editing control is
 *                  omitted and `lib/actions` is aliased away entirely in
 *                  next.config.mjs (a "use server" module in the graph fails
 *                  the export build even if nothing calls it).
 *
 * Set STATIC_EXPORT=1 to build the public site.
 */
export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === '1';

/** Route segment config: static export rejects 'force-dynamic'. */
export const PAGE_DYNAMIC = IS_STATIC ? 'force-static' : 'force-dynamic';

/**
 * Stand-in for lib/actions.ts in the static export build.
 *
 * Static export cannot contain a "use server" module, so next.config.mjs
 * aliases @/lib/actions to this file when STATIC_EXPORT=1. Nothing ever calls
 * these — the pages that would pass them to a <form action={...}> are guarded
 * by IS_STATIC — but the imports still have to resolve to something.
 */
const unavailable = async (_form: FormData): Promise<void> => {
  throw new Error('Editing is not available on the published read-only site.');
};

export const saveResort = unavailable;
export const deleteResort = unavailable;
export const saveRoom = unavailable;
export const deleteRoom = unavailable;
export const addPrice = unavailable;
export const captureRound = unavailable;
export const deletePrice = unavailable;
export const saveCriteria = unavailable;
export const addCriterion = unavailable;
export const removeCriterion = unavailable as unknown as (id: string) => Promise<void>;
export const moveCriterion = unavailable as unknown as (id: string, direction: string) => Promise<void>;
export const saveTrip = unavailable;
export const deleteTrip = unavailable;

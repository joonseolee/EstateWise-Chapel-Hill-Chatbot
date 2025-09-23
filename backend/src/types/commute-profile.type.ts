export const COMMUTE_MODES = ['drive', 'transit', 'bike', 'walk'] as const;
export type CommuteMode = typeof COMMUTE_MODES[number];

export type CommuteCombine = "intersect" | "union";

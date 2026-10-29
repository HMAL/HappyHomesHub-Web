// Single source of truth for the per-role color palettes. These were previously
// re-declared as local PRIMARY/ACCENT constants in 10+ page files; importing from
// here lets a color change propagate everywhere and keeps roles consistent.
export const THEME = {
  landlord: { primary: '#0D1F2D', accent: '#D4972A' },
  tenant:   { primary: '#12202E', accent: '#00C8BB' },
  handyman: { primary: '#1B3A2F', accent: '#34D399' },
} as const;

export type Role = keyof typeof THEME;

/** Convenience getter, e.g. roleColors('tenant').accent */
export function roleColors(role: Role) {
  return THEME[role];
}

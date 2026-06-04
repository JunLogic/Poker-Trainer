/**
 * Typed accessors for the CSS design tokens defined in `tokens.css`.
 * Every value is a `var(--token)` reference, so inline styles stay in sync with
 * the single source of truth and react to theme changes automatically.
 */

export const color = {
  // surfaces
  bgApp: 'var(--bg-app)',
  surface: 'var(--bg-surface)',
  raised: 'var(--bg-raised)',
  elevated: 'var(--bg-elevated)',
  hover: 'var(--bg-hover)',
  input: 'var(--bg-input)',
  inset: 'var(--bg-inset)',
  // borders
  borderSubtle: 'var(--border-subtle)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',
  // text
  text: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  textFaint: 'var(--text-faint)',
  onAccent: 'var(--text-on-accent)',
  // state
  accent: 'var(--accent)',
  accentStrong: 'var(--accent-strong)',
  accentSoft: 'var(--accent-soft)',
  accentSofter: 'var(--accent-softer)',
  success: 'var(--success)',
  successSoft: 'var(--green-soft)',
  danger: 'var(--danger)',
  dangerSoft: 'var(--red-soft)',
  info: 'var(--info)',
  infoSoft: 'var(--blue-soft)',
  caution: 'var(--caution)',
  cautionSoft: 'var(--amber-soft)',
  allin: 'var(--allin)',
  allinSoft: 'var(--violet-soft)',
  // table
  tableFrom: 'var(--table-surface-from)',
  tableTo: 'var(--table-surface-to)',
  tableRail: 'var(--table-rail)',
} as const;

export const radius = {
  xs: 'var(--radius-xs)',
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  pill: 'var(--radius-pill)',
} as const;

export const shadow = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  pop: 'var(--shadow-pop)',
  card: 'var(--shadow-card)',
} as const;

/** 8pt spacing scale (px numbers for terse inline use). */
export const space = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64,
} as const;

export const font = {
  sans: 'var(--font-sans)',
  mono: 'var(--font-mono)',
} as const;

export const text = {
  xs: 'var(--text-xs)',
  sm: 'var(--text-sm)',
  base: 'var(--text-base)',
  md: 'var(--text-md)',
  lg: 'var(--text-lg)',
  xl: 'var(--text-xl)',
  xxl: 'var(--text-2xl)',
} as const;

export const weight = {
  normal: 400, medium: 500, semibold: 600, bold: 700,
} as const;

export const iconSize = { sm: 16, md: 20, lg: 24 } as const;

export const motion = {
  ease: 'var(--ease-out)',
  fast: 'var(--dur-fast)',
  base: 'var(--dur)',
  slow: 'var(--dur-slow)',
  /** ready-to-use transition shorthand */
  transition: 'all var(--dur) var(--ease-out)',
} as const;

/** Tabular-figures style fragment for any element rendering numbers. */
export const tnum = {
  fontVariantNumeric: 'tabular-nums',
} as const;

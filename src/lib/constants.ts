// ============================================================
// SHARED CONSTANTS — Lexicon Weaver
// ============================================================
import type { TermStatus } from '@/types';

/** Tailwind classes for status dot backgrounds. */
export const statusDotClass: Record<TermStatus, string> = {
  'no-trait': 'bg-[var(--lw-error)]',
  'in-progress': 'bg-[var(--lw-warning)]',
  'ready': 'bg-[var(--lw-success)]',
};

/** Raw hex colors for D3/SVG. */
export const statusHex: Record<TermStatus, string> = {
  'no-trait': '#C0635F',
  'in-progress': '#D98C45',
  'ready': '#7E9E7C',
};

export const linkHex = {
  'first-appearance': '#2C2C2C',
  'mention': '#C0C0B8',
} as const;

export const PANEL_WIDTH = {
  left: 320,
  right: 380,
} as const;

/** Breakpoint below which the editor switches to mobile (drawer) layout. */
export const MOBILE_BREAKPOINT = 900;

export const statusLabel: Record<TermStatus, string> = {
  'no-trait': '○ Без признаки',
  'in-progress': '◐ В работе',
  'ready': '✓ Определение готово',
};

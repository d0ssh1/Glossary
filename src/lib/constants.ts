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

/** Raw hex colors for graph term nodes (editor). */
export const statusHex: Record<TermStatus, string> = {
  'no-trait': '#C0635F',
  'in-progress': '#D98C45',
  'ready': '#7E9E7C',
};

/** Term node colors for the published SCORM view — a distinct cool palette so
 *  the read-only export reads differently from the editing app. */
export const scormStatusHex: Record<TermStatus, string> = {
  'no-trait': '#8A8FB0',
  'in-progress': '#4F86C6',
  'ready': '#3F9E8C',
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
  'no-trait': '○ Без признака',
  'in-progress': '◐ В работе',
  'ready': '✓ Определение готово',
};

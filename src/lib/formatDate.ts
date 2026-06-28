// ============================================================
// DATE FORMATTING — Lexicon Weaver
// ============================================================
// Anton's spec: the dashboard's "last import" line should read as a plain
// date — "27 июня 2026" — with no time component. The backend stores
// `import_date` as a UTC ISO timestamp; legacy mock data uses "DD.MM.YYYY".
// Both collapse to the same "ДД месяц ГГГГ" form here.

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
] as const;

/**
 * Format an import date as "ДД месяц ГГГГ" (Russian genitive month, no time).
 *
 * Accepts either an ISO timestamp (e.g. "2026-06-27T08:30:00Z") or the legacy
 * "DD.MM.YYYY" mock format. Returns `null` for null/empty input, and echoes the
 * raw string back unchanged if it can't be parsed (so a malformed value is still
 * visible rather than silently dropped).
 */
export function formatImportDate(value: string | null | undefined): string | null {
  if (!value) return null;

  // Legacy mock format "DD.MM.YYYY" — already date-only, build directly.
  const dmy = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const year = Number(dmy[3]);
    if (month >= 0 && month < 12) return `${day} ${MONTHS_GENITIVE[month]} ${year}`;
    return value;
  }

  // ISO timestamp — read UTC calendar parts so the displayed day matches the
  // stored value regardless of the viewer's timezone.
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getUTCDate()} ${MONTHS_GENITIVE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

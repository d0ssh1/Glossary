import { describe, it, expect } from 'vitest';
import { formatImportDate } from '../formatDate';

describe('formatImportDate', () => {
  it('returns null for null/empty input', () => {
    expect(formatImportDate(null)).toBeNull();
    expect(formatImportDate(undefined)).toBeNull();
    expect(formatImportDate('')).toBeNull();
  });

  it('formats an ISO UTC timestamp as "ДД месяц ГГГГ" with no time', () => {
    expect(formatImportDate('2026-06-27T08:30:00Z')).toBe('27 июня 2026');
    expect(formatImportDate('2026-01-01T00:00:00Z')).toBe('1 января 2026');
    expect(formatImportDate('2026-12-31T23:59:59Z')).toBe('31 декабря 2026');
  });

  it('uses UTC calendar day so the date is timezone-stable', () => {
    // Late-evening UTC must not roll back to the previous day.
    expect(formatImportDate('2026-05-15T23:00:00Z')).toBe('15 мая 2026');
  });

  it('reformats the legacy "DD.MM.YYYY" mock format', () => {
    expect(formatImportDate('15.05.2026')).toBe('15 мая 2026');
    expect(formatImportDate('01.01.2026')).toBe('1 января 2026');
  });

  it('echoes an unparseable value back unchanged', () => {
    expect(formatImportDate('not-a-date')).toBe('not-a-date');
  });
});

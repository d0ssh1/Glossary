/**
 * Persists final node positions per drill-down context so the layout
 * is stable between sessions / level switches.
 *
 * Storage key encodes the active context (level + parent IDs).
 */

const STORAGE_KEY = 'lw:nodePositions:v1';

type Position = { x: number; y: number };
type AllPositions = Record<string, Record<string, Position>>;

function readAll(): AllPositions {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data: AllPositions) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota or disabled — ignore
  }
}

export function contextKey(level: string, moduleId?: string, lessonId?: string): string {
  return `${level}|${moduleId ?? ''}|${lessonId ?? ''}`;
}

export function loadPositions(key: string): Record<string, Position> {
  return readAll()[key] ?? {};
}

export function savePositions(key: string, positions: Record<string, Position>) {
  const all = readAll();
  all[key] = positions;
  writeAll(all);
}

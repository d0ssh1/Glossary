import { describe, it, expect, beforeEach } from 'vitest';
import { contextKey, loadPositions, savePositions } from '../nodePositions';

describe('nodePositions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('contextKey encodes level + parents deterministically', () => {
    expect(contextKey('modules')).toBe('modules||');
    expect(contextKey('lessons', 'm1')).toBe('lessons|m1|');
    expect(contextKey('terms', 'm1', 'l2')).toBe('terms|m1|l2');
  });

  it('save then load returns same positions', () => {
    const key = contextKey('terms', 'm1', 'l1');
    const positions = { 't1': { x: 10, y: 20 }, 't2': { x: -5, y: 0 } };
    savePositions(key, positions);
    expect(loadPositions(key)).toEqual(positions);
  });

  it('different keys do not collide', () => {
    savePositions(contextKey('modules'), { 'm1': { x: 1, y: 2 } });
    savePositions(contextKey('lessons', 'm1'), { 'l1': { x: 3, y: 4 } });
    expect(loadPositions(contextKey('modules'))).toEqual({ 'm1': { x: 1, y: 2 } });
    expect(loadPositions(contextKey('lessons', 'm1'))).toEqual({ 'l1': { x: 3, y: 4 } });
  });

  it('returns empty object for unknown key', () => {
    expect(loadPositions('missing')).toEqual({});
  });
});

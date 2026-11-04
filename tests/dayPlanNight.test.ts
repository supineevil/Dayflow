import { describe, expect, it } from 'vitest';
import { dayStats, workingInterval } from '../src/core/planning/dayPlan';

describe('a shift that ends after midnight', () => {
  const hours = { start: '18:00', end: '03:00' };
  const day = new Date(2026, 10, 4);
  it('runs from the evening into the next morning', () => {
    const w = workingInterval(day, hours);
    expect(w.start).toEqual(new Date(2026, 10, 4, 18));
    expect(w.end).toEqual(new Date(2026, 10, 5, 3));
  });
  it('counts nine hours of working time, not a negative number', () => {
    expect(dayStats([], day, hours, new Date(2026, 10, 4, 12)).freeMinutes).toBe(9 * 60);
  });
  it('leaves an ordinary day alone', () => {
    const w = workingInterval(day, { start: '09:00', end: '17:30' });
    expect(w.end).toEqual(new Date(2026, 10, 4, 17, 30));
  });
});

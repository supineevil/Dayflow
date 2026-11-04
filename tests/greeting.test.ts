import { describe, expect, it } from 'vitest';
import { GREETINGS, dayPhase, greeting } from '../src/core/planning/greeting';

const hours = { start: '09:00', end: '17:00' };
const at = (h: number, m = 0, day = 4) => new Date(2026, 10, day, h, m);

describe('dayPhase', () => {
  it('splits the day around the working hours', () => {
    expect(dayPhase(at(0, 1), hours)).toBe('early');
    expect(dayPhase(at(2, 38), hours)).toBe('early');
    expect(dayPhase(at(8, 59), hours)).toBe('early');
    expect(dayPhase(at(9), hours)).toBe('working');
    expect(dayPhase(at(16, 59), hours)).toBe('working');
    expect(dayPhase(at(17), hours)).toBe('late');
    expect(dayPhase(at(23, 30), hours)).toBe('late');
  });
  it('follows whatever hours are set', () => {
    const early = { start: '06:00', end: '14:00' };
    expect(dayPhase(at(4, 30), early)).toBe('early');
    expect(dayPhase(at(5, 59), early)).toBe('early');
    expect(dayPhase(at(6), early)).toBe('working');
    expect(dayPhase(at(15), early)).toBe('late');
    // The same clock time gives a different answer under different hours.
    expect(dayPhase(at(10), { start: '11:00', end: '19:00' })).toBe('early');
    expect(dayPhase(at(10), { start: '08:00', end: '16:00' })).toBe('working');
    expect(dayPhase(at(10), { start: '04:00', end: '09:30' })).toBe('late');
  });
});

describe('greeting', () => {
  it('uses a line from the matching phase', () => {
    expect(GREETINGS.working).toContain(greeting(at(11), hours));
    expect(GREETINGS.late).toContain(greeting(at(20), hours));
    expect(GREETINGS.early).toContain(greeting(at(7), hours));
    expect(GREETINGS.early).toContain(greeting(at(2), hours));
  });
  it('stays the same through the day and for repeated renders', () => {
    expect(greeting(at(9, 5), hours)).toBe(greeting(at(16, 45), hours));
    expect(greeting(at(11), hours)).toBe(greeting(at(11), hours));
  });
  it('can differ on another day', () => {
    const seen = new Set(Array.from({ length: 30 }, (_, i) => greeting(at(11, 0, i + 1), hours)));
    expect(seen.size).toBeGreaterThan(1);
  });
  it('has no empty lines', () => {
    for (const lines of Object.values(GREETINGS)) for (const l of lines) expect(l.trim()).not.toBe('');
  });
});

describe('overnight hours', () => {
  const night = { start: '18:00', end: '03:00' };
  it('treats the evening and small hours as working, and the daytime as before work', () => {
    expect(dayPhase(at(21), night)).toBe('working');
    expect(dayPhase(at(1), night)).toBe('working');
    expect(dayPhase(at(12), night)).toBe('early');
  });
});

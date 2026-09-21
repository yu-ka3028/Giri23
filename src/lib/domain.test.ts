import { describe, expect, it } from 'vitest';
import { goalMetsHours, isWithinPast24Hours, validateRecord, weekStart } from './domain';

describe('Giri23 domain rules', () => {
  it('does not add activities below 3 METs to the weekly goal', () => expect(goalMetsHours(2.3, 30)).toBe(0));
  it('adds exactly 3 METs to the weekly goal', () => expect(goalMetsHours(3, 60)).toBe(3));
  it('adds short moderate activity', () => expect(goalMetsHours(4.8, 2)).toBeCloseTo(0.16));
  it('uses Monday midnight Asia/Tokyo as week start', () => expect(weekStart(new Date('2025-01-08T12:00:00Z')).toISOString()).toBe('2025-01-05T15:00:00.000Z'));
  it('handles the JST Sunday/Monday week boundary', () => {
    expect(weekStart(new Date('2025-01-05T14:59:59Z')).toISOString()).toBe('2024-12-29T15:00:00.000Z');
    expect(weekStart(new Date('2025-01-05T15:00:00Z')).toISOString()).toBe('2025-01-05T15:00:00.000Z');
  });
  it('accepts exactly the previous 24 hours and rejects older or future records', () => {
    const now = new Date('2025-01-08T12:00:00Z');
    expect(isWithinPast24Hours(new Date('2025-01-07T12:00:00Z'), now)).toBe(true);
    expect(isWithinPast24Hours(new Date('2025-01-07T11:59:59Z'), now)).toBe(false);
    expect(isWithinPast24Hours(new Date('2025-01-08T12:00:01Z'), now)).toBe(false);
  });
  it('rejects invalid dates and durations over one day', () => {
    const now = new Date('2025-01-08T12:00:00Z');
    expect(validateRecord({ activityId: 'walk', durationMin: 1440, recordedAt: now }, now)).toBeNull();
    expect(validateRecord({ activityId: 'walk', durationMin: 1441, recordedAt: now }, now)).toContain('1440');
    expect(validateRecord({ activityId: 'walk', durationMin: Number.NaN, recordedAt: now }, now)).toContain('1分');
    expect(validateRecord({ activityId: 'walk', durationMin: 10, recordedAt: new Date('invalid') }, now)).toContain('日時');
  });
});

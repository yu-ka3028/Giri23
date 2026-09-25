import { describe, expect, it } from 'vitest';
import { appendUniqueById, elapsedSecondsToMinutes, floorPositiveMinutes, goalMetsHours, findCandidates, isValidPlannedMinutes, isWithinPast24Hours, parseStoredRecords, validateRecord, weekStart } from './domain';
import { activities } from './activities';

describe('Giri23 domain rules', () => {
  it('does not add activities below 3 METs to the weekly goal', () => expect(goalMetsHours(2.3, 30)).toBe(0));
  it('adds exactly 3 METs to the weekly goal', () => expect(goalMetsHours(3, 60)).toBe(3));
  it('adds short moderate activity', () => expect(goalMetsHours(4.8, 2)).toBeCloseTo(0.16));
  it('converts elapsed seconds to whole minutes by truncating seconds', () => {
    expect(elapsedSecondsToMinutes(119)).toBe(1);
    expect(elapsedSecondsToMinutes(60)).toBe(1);
    expect(elapsedSecondsToMinutes(59)).toBe(0);
    expect(elapsedSecondsToMinutes(-1)).toBe(0);
  });
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
  it('keeps source verification and app-only descriptions explicit', () => {
    expect(activities.find(activity => activity.id === 'dog-walk')).toMatchObject({ verificationStatus: '照合済み', sourceCode: '17165', mets: 3.0 });
    expect(activities.every(activity => activity.description.length > 0 && activity.sourceDocument.length > 0)).toBe(true);
    expect(activities.find(activity => activity.id === 'housework')?.aliases).toContain('掃除');
  });
  it('matches every demo activity to its official source row', () => {
    expect(activities.map(activity => ({ code: activity.sourceCode, mets: activity.mets, quote: activity.sourceQuote }))).toEqual([
      { code: '17190', mets: 3.8, quote: 'Walking, 2.8 to 3.4 mph, level, moderate pace, firm surface' },
      { code: '17165', mets: 3.0, quote: 'Walking the dog' },
      { code: '17170', mets: 3.0, quote: 'Walking, 2.5 mph, firm, level surface' },
      { code: '17081', mets: 3.8, quote: 'Hiking slowly or ambling through fields and hillsides, no load' },
      { code: '05010', mets: 3.3, quote: 'Cleaning, sweeping carpet or floors, general' },
      { code: '05043', mets: 3.0, quote: 'Vacuuming, general, moderate effort' },
      { code: '02101', mets: 2.3, quote: 'Stretching, mild' },
      { code: '08240', mets: 4.5, quote: 'Weeding, cultivating garden, moderate effort (Taylor Code 580)' },
      { code: '02056', mets: 3.0, quote: 'Body weight resistance exercises (e.g., squat, lunge, push-up, crunch), general' },
      { code: '02056', mets: 3.0, quote: 'Body weight resistance exercises (e.g., squat, lunge, push-up, crunch), general' },
      { code: '02056', mets: 3.0, quote: 'Body weight resistance exercises (e.g., squat, lunge, push-up, crunch), general' },
      { code: '02056', mets: 3.0, quote: 'Body weight resistance exercises (e.g., squat, lunge, push-up, crunch), general' },
      { code: '17200', mets: 4.8, quote: 'Walking, 3.5 to 3.9 mph, level, brisk, firm surface, walking for exercise' },
      { code: '02005', mets: 4.8, quote: 'Aerobic dance, low impact, moderate effort' },
      { code: '02020', mets: 7.5, quote: 'Calisthenics (e.g., pushups, sit ups, pull-ups, jumping jacks, burpees, battling ropes), vigorous effort' },
    ]);
    expect(activities.every(activity => activity.verificationStatus === '照合済み' && activity.sourceUrl.startsWith('https://'))).toBe(true);
    expect(activities.filter(activity => activity.sourceCode === '02056')).toHaveLength(4);
    expect(activities.find(activity => activity.id === 'side-step')?.evidenceRelation).toContain('直接記載されておらず');
    expect(activities.find(activity => activity.id === 'jumping-jack')).toMatchObject({ sourceCode: '02020', mets: 7.5, repetitionGuide: '開始目安：まず10回（回数はアプリ内目安）' });
  });
  it('returns all quick candidates when activity is unspecified', () => {
    const result = findCandidates(activities, {});
    expect(result).toHaveLength(14);
    expect(result.every(activity => activity.mets >= 3)).toBe(true);
  });
  it('filters by the selected activity id with an exact match', () => {
    const result = findCandidates(activities, { activityFilterId: 'dog-walk' });
    expect(result.map(activity => activity.id)).toEqual(['dog-walk']);
    expect(findCandidates(activities, { activityFilterId: 'dog' })).toEqual([]);
  });
  it('applies time, target, and activity filters together', () => {
    const result = findCandidates(activities, { availableMin: 19, targetMetsHours: 1, activityFilterId: 'walk-normal' });
    expect(result.map(activity => activity.id)).toEqual(['walk-normal']);
    expect(result[0].requiredMin).toBeCloseTo(60 / 3.8);
    expect(result[0].plannedMin).toBe(16);
  });
  it('uses five minutes when conditions are empty and excludes below-goal activities', () => {
    const result = findCandidates(activities, {});
    expect(result[0].id).toBe('walk-normal');
    expect(result.every(activity => activity.requiredMin === 5 && activity.plannedMin === 5 && activity.mets >= 3)).toBe(true);
    expect(result.some(activity => activity.id === 'stretch')).toBe(false);
  });
  it('returns goal-eligible candidates for one available minute when no METs-hour target is set', () => {
    const result = findCandidates(activities, { availableMin: 1 });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(activity => activity.plannedMin === 1 && activity.requiredMin === 1)).toBe(true);
  });
  it('keeps below-3-MET activities available for later records but not quick candidates', () => {
    expect(activities.find(activity => activity.id === 'stretch')?.mets).toBe(2.3);
    expect(findCandidates(activities, { activityFilterId: 'stretch' })).toEqual([]);
  });
  it('floors positive minute inputs before using them as available time', () => {
    expect(floorPositiveMinutes(12.2)).toBe(12);
    const result = findCandidates(activities, { availableMin: 12.2 });
    expect(result.every(activity => activity.plannedMin <= 12)).toBe(true);
    expect(result[0].plannedMin).toBe(12);
  });
  it('validates planned durations as integer minutes from 1 through 1440', () => {
    expect(isValidPlannedMinutes(1)).toBe(true);
    expect(isValidPlannedMinutes(1440)).toBe(true);
    expect(isValidPlannedMinutes(0)).toBe(false);
    expect(isValidPlannedMinutes(1.5)).toBe(false);
    expect(isValidPlannedMinutes(1441)).toBe(false);
  });
  it('rejects blank, non-numeric, below-minimum, and over-maximum durations without rounding', () => {
    const now = new Date('2025-01-08T12:00:00Z');
    expect(validateRecord({ activityId: 'walk', durationMin: Number(''), recordedAt: now }, now)).toContain('1分');
    expect(validateRecord({ activityId: 'walk', durationMin: Number.NaN, recordedAt: now }, now)).toContain('1分');
    expect(validateRecord({ activityId: 'walk', durationMin: 0.99, recordedAt: now }, now)).toContain('1分');
    expect(validateRecord({ activityId: 'walk', durationMin: 1440, recordedAt: now }, now)).toBeNull();
    expect(validateRecord({ activityId: 'walk', durationMin: 1440.01, recordedAt: now }, now)).toContain('1440');
    expect(validateRecord({ activityId: 'walk', durationMin: 10, recordedAt: new Date('invalid') }, now)).toContain('日時');
  });
  it('accepts only integer record durations from 1 through 1440 minutes', () => {
    const now = new Date('2025-01-08T12:00:00Z');
    expect(validateRecord({ activityId: 'walk', durationMin: 1, recordedAt: now }, now)).toBeNull();
    expect(validateRecord({ activityId: 'walk', durationMin: 1.5, recordedAt: now }, now)).toContain('1分');
    expect(validateRecord({ activityId: 'walk', durationMin: 1440, recordedAt: now }, now)).toBeNull();
    expect(validateRecord({ activityId: 'walk', durationMin: 1441, recordedAt: now }, now)).toContain('1440');
  });
  it('does not append a record with an existing id', () => {
    const existing = [{ id: 'session-1', value: 1 }];
    expect(appendUniqueById(existing, { id: 'session-1', value: 2 })).toBe(existing);
    expect(appendUniqueById(existing, { id: 'session-2', value: 3 })).toEqual([...existing, { id: 'session-2', value: 3 }]);
  });
  it('recalculates stored record values from the current activity master', () => {
    const records = parseStoredRecords([
      { id: 'known', activityId: 'walk-normal', durationMin: 30, recordedAt: '2025-01-08T12:00:00Z', mets: 999, goalValue: 999 },
      { id: 'unknown', activityId: 'removed-activity', durationMin: 30, recordedAt: '2025-01-08T12:00:00Z', mets: 3, goalValue: 1.5 },
    ], activities);
    expect(records).toEqual([{ id: 'known', activityId: 'walk-normal', durationMin: 30, recordedAt: '2025-01-08T12:00:00Z', mets: 3.8, goalValue: 1.9 }]);
  });
});

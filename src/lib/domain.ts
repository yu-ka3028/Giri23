export const WEEKLY_GOAL = 23;
export const MIN_GOAL_METS = 3;
export const MAX_RECORD_AGE_HOURS = 24;
export const MAX_RECORD_DURATION_MIN = 1440;
export const DEFAULT_PLANNED_MIN = 5;

export type VerificationStatus = '照合済み' | '照合中';

export type Activity = {
  id: string;
  name: string;
  description: string;
  category: string;
  mets: number;
  sourceCode: string;
  sourceDocument: string;
  sourceVersion: string;
  sourceActivityName?: string;
  sourceQuote: string;
  sourceTranslation: string;
  sourceUrl: string;
  evidenceRelation: string;
  verificationStatus: VerificationStatus;
  sourceNote?: string;
  repetitionGuide?: string;
  aliases: string[];
  ease: number;
};

export type SearchConditions = {
  availableMin?: number;
  targetMetsHours?: number;
  activityFilterId?: string;
};

export type ActivityCandidate = Activity & { requiredMin: number; plannedMin: number };
export type StoredRecord = { id: string; activityId: string; durationMin: number; recordedAt: string; mets: number; goalValue: number };
export type RecordInput = { activityId: string; durationMin: number; recordedAt: Date };

export function appendUniqueById<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some(existing => existing.id === item.id) ? items : [...items, item];
}

export function parseStoredRecords(value: unknown, activityList: Activity[]): StoredRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const activityId = record.activityId;
    const activity = typeof activityId === 'string' ? activityList.find(candidate => candidate.id === activityId) : undefined;
    const durationMin = record.durationMin;
    const recordedAt = record.recordedAt;
    if (typeof record.id !== 'string' || record.id.length === 0 || !activity
      || typeof durationMin !== 'number' || !Number.isInteger(durationMin) || durationMin < 1 || durationMin > MAX_RECORD_DURATION_MIN
      || typeof recordedAt !== 'string' || !Number.isFinite(Date.parse(recordedAt))) return [];
    return [{
      id: record.id,
      activityId: activity.id,
      durationMin,
      recordedAt,
      mets: activity.mets,
      goalValue: goalMetsHours(activity.mets, durationMin),
    }];
  });
}

export function metsHours(mets: number, durationMin: number): number {
  return Number.isFinite(mets) && Number.isFinite(durationMin) && mets >= 0 && durationMin >= 0
    ? mets * durationMin / 60
    : 0;
}
export function goalMetsHours(mets: number, durationMin: number): number {
  return Number.isFinite(mets) && mets >= MIN_GOAL_METS && durationMin >= 0 && Number.isFinite(durationMin)
    ? metsHours(mets, durationMin)
    : 0;
}

export function elapsedSecondsToMinutes(elapsedSeconds: number): number {
  return Number.isFinite(elapsedSeconds) ? Math.max(0, Math.floor(elapsedSeconds / 60)) : 0;
}

export function requiredMinutes(mets: number, targetMetsHours: number): number {
  return Number.isFinite(mets) && mets > 0 && Number.isFinite(targetMetsHours) && targetMetsHours >= 0
    ? targetMetsHours * 60 / mets
    : Infinity;
}

export function isValidPlannedMinutes(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_RECORD_DURATION_MIN;
}

export function floorPositiveMinutes(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function findCandidates(activities: Activity[], conditions: SearchConditions): ActivityCandidate[] {
  const availableInput = conditions.availableMin;
  const availableMin = floorPositiveMinutes(availableInput ?? 0);
  const hasTime = availableMin > 0;
  const hasTarget = Number.isFinite(conditions.targetMetsHours) && (conditions.targetMetsHours ?? 0) > 0;
  const activityFilterId = conditions.activityFilterId?.trim() ?? '';
  const targetMetsHours = hasTarget ? conditions.targetMetsHours! : 0;
  return activities
    .map(activity => {
      const requiredMin = targetMetsHours ? requiredMinutes(activity.mets, targetMetsHours) : hasTime ? availableMin : DEFAULT_PLANNED_MIN;
      const plannedMin = hasTarget ? Math.ceil(requiredMin) : requiredMin;
      return { ...activity, requiredMin, plannedMin };
    })
    .filter(activity => activity.mets >= MIN_GOAL_METS)
    .filter(activity => !hasTime || activity.requiredMin <= availableMin)
    .filter(activity => isValidPlannedMinutes(activity.plannedMin))
    .filter(activity => !activityFilterId || activity.id === activityFilterId)
    .sort((a, b) => a.ease - b.ease || a.requiredMin - b.requiredMin || a.name.localeCompare(b.name, 'ja'));
}
export function weekStart(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  const day = get('weekday');
  const offset = day === 'Sun' ? 6 : day === 'Mon' ? 0 : ['Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day) + 1;
  const monday = new Date(Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')) - offset));
  // Monday 00:00 Asia/Tokyo, represented as an absolute instant.
  return new Date(monday.getTime() - 9 * 60 * 60 * 1000);
}
export function isWithinPast24Hours(recordedAt: Date, now = new Date()): boolean {
  const recordedTime = recordedAt.getTime();
  const nowTime = now.getTime();
  if (!Number.isFinite(recordedTime) || !Number.isFinite(nowTime)) return false;
  const age = nowTime - recordedTime;
  return age >= 0 && age <= MAX_RECORD_AGE_HOURS * 60 * 60 * 1000;
}
export function validateRecord(input: RecordInput, now = new Date()): string | null {
  if (!Number.isFinite(input.durationMin) || input.durationMin < 1) return '時間は1分以上で入力してください。';
  if (input.durationMin > MAX_RECORD_DURATION_MIN) return '時間は1440分以内で入力してください。';
  if (!Number.isInteger(input.durationMin)) return '時間は1分以上で入力してください。';
  return validateDate(input.recordedAt, now);
}

function validateDate(recordedAt: Date, now: Date): string | null {
  if (!(recordedAt instanceof Date) || !Number.isFinite(recordedAt.getTime()) || !Number.isFinite(now.getTime())) {
    return '日時が不正です。';
  }
  if (!isWithinPast24Hours(recordedAt, now)) return '記録できるのは現在から過去24時間以内です。';
  return null;
}
export function formatNumber(value: number): string { return value.toFixed(1).replace(/\.0$/, ''); }

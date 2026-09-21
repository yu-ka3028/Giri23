export const WEEKLY_GOAL = 23;
export const MIN_GOAL_METS = 3;
export const MAX_RECORD_AGE_HOURS = 24;
export const MAX_RECORD_DURATION_MIN = 1440;

export type Activity = { id: string; name: string; category: string; mets: number; sourceCode: string };
export type RecordInput = { activityId: string; durationMin: number; recordedAt: Date; weightKg?: number };

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
export function kcal(mets: number, weightKg: number | undefined, durationMin: number): number | null {
  return Number.isFinite(mets) && Number.isFinite(durationMin) && weightKg !== undefined && Number.isFinite(weightKg) && weightKg > 0
    ? mets * weightKg * durationMin / 60
    : null;
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
  if (!Number.isFinite(input.durationMin) || input.durationMin <= 0) return '時間は1分以上で入力してください。';
  if (input.durationMin > MAX_RECORD_DURATION_MIN) return '時間は1440分以内で入力してください。';
  if (!(input.recordedAt instanceof Date) || !Number.isFinite(input.recordedAt.getTime()) || !Number.isFinite(now.getTime())) {
    return '日時が不正です。';
  }
  if (!isWithinPast24Hours(input.recordedAt, now)) return '記録できるのは現在から過去24時間以内です。';
  return null;
}
export function formatNumber(value: number): string { return value.toFixed(1).replace(/\.0$/, ''); }

'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { activities } from '../lib/activities';
import { ActivityCandidate, appendUniqueById, DEFAULT_PLANNED_MIN, elapsedSecondsToMinutes, findCandidates, floorPositiveMinutes, formatNumber, goalMetsHours, isValidPlannedMinutes, parseStoredRecords, validateRecord, weekStart, WEEKLY_GOAL, MAX_RECORD_DURATION_MIN, StoredRecord } from '../lib/domain';

type Saved = StoredRecord;
type RunningSession = { sessionId: string; activityId: string; startedAt: string; plannedMin: number };
const RECORDS_KEY = 'giri23-records';
const SESSION_KEY = 'giri23-active-session';
const quickActivities = activities.filter(activity => activity.mets >= 3);

function parseSession(value: unknown): RunningSession | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  if (typeof r.sessionId !== 'string' || r.sessionId.length === 0
    || typeof r.activityId !== 'string' || !activities.some(activity => activity.id === r.activityId)
    || typeof r.startedAt !== 'string' || !Number.isFinite(Date.parse(r.startedAt))) return null;
  return {
    sessionId: r.sessionId,
    activityId: r.activityId,
    startedAt: r.startedAt,
    plannedMin: isValidPlannedMinutes(r.plannedMin) ? r.plannedMin : DEFAULT_PLANNED_MIN,
  };
}

function formatMetsHours(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export default function Home() {
  const [records, setRecords] = useState<Saved[]>([]);
  const [session, setSession] = useState<RunningSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [available, setAvailable] = useState('');
  const [target, setTarget] = useState('');
  const [activityFilterId, setActivityFilterId] = useState('');
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidates, setCandidates] = useState<ActivityCandidate[]>(() => findCandidates(activities, {}));
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');
  const toastTimerRef = useRef<number | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [endActivityId, setEndActivityId] = useState('');
  const [endMinutes, setEndMinutes] = useState('0');
  const finishingRef = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECORDS_KEY);
      if (saved) { const parsed: unknown = JSON.parse(saved); setRecords(parseStoredRecords(parsed, activities)); }
    } catch { /* Ignore unavailable storage and malformed records. */ }
    try {
      const active = localStorage.getItem(SESSION_KEY);
      if (active) { const parsed: unknown = JSON.parse(active); const restored = parseSession(parsed); if (restored) setSession(restored); }
    } catch { /* Ignore unavailable storage and malformed session. */ }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch { /* Ignore storage errors. */ } }, [hydrated, records]);
  useEffect(() => {
    if (!hydrated) return;
    try { if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY); } catch { /* Ignore storage errors. */ }
  }, [hydrated, session]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!endOpen) finishingRef.current = false; }, [endOpen]);
  useEffect(() => () => { if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current); }, []);
  useEffect(() => {
    setCandidateLoading(true);
    const timer = window.setTimeout(() => {
      const next = findCandidates(activities, { availableMin: Number(available), targetMetsHours: Number(target), activityFilterId });
      setCandidates(next);
      setSelectedId(previous => next.some(activity => activity.id === previous) ? previous : '');
      setCandidateLoading(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [available, target, activityFilterId]);

  const selected = candidates.find(a => a.id === selectedId);
  const currentSessionActivity = session ? activities.find(a => a.id === session.activityId) ?? activities[0] : null;
  const elapsedSeconds = session ? Math.max(0, Math.floor((now - Date.parse(session.startedAt)) / 1000)) : 0;
  const total = useMemo(() => {
    const start = weekStart(new Date(now)).getTime();
    return records.filter(r => Date.parse(r.recordedAt) >= start).reduce((sum, r) => sum + r.goalValue, 0);
  }, [now, records]);
  const progress = Math.min(100, total / WEEKLY_GOAL * 100);

  const showToast = (text: string) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast(text);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2800);
  };
  const start = () => {
    const chosen = candidates.find(a => a.id === selectedId);
    if (!chosen || session) return;
    setSession({ sessionId: crypto.randomUUID(), activityId: chosen.id, startedAt: new Date().toISOString(), plannedMin: chosen.plannedMin });
    showToast('開始しました。終わったら終了を押してください。');
  };
  const openEnd = () => {
    if (!session) return;
    setEndActivityId(session.activityId);
    const elapsedMinutes = elapsedSecondsToMinutes(elapsedSeconds);
    setEndMinutes(String(Math.min(MAX_RECORD_DURATION_MIN, elapsedMinutes)));
    setEndOpen(true);
  };
  const finish = () => {
    if (finishingRef.current || !session) return;
    const activity = activities.find(a => a.id === endActivityId);
    if (!activity) { setMessage('活動を確認してください。'); return; }
    const duration = floorPositiveMinutes(Number(endMinutes));
    const recordedAt = new Date();
    const error = validateRecord({ activityId: activity.id, durationMin: duration, recordedAt });
    if (error) { setMessage(error); return; }
    finishingRef.current = true;
    const record: Saved = { id: session.sessionId, activityId: activity.id, durationMin: duration, recordedAt: recordedAt.toISOString(), mets: activity.mets, goalValue: goalMetsHours(activity.mets, duration) };
    setRecords(old => appendUniqueById(old, record));
    setSession(null); setEndOpen(false); showToast('保存しました。');
  };
  const abandon = () => { setSession(null); setEndOpen(false); showToast('記録せず中断しました。'); };
  const name = (id: string) => activities.find(a => a.id === id)?.name ?? '活動';

  return <main className="shell">
    <header><div><p className="eyebrow">Giri23</p><h1>今日、動いた分を<br /><em>ちゃんと数える。</em></h1></div><span className="badge">ローカルデモ</span></header>
    {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    <section className="hero card"><div className="ring" style={{ '--progress': `${progress}%` } as React.CSSProperties}><strong>{formatNumber(total)}</strong><span>/ {WEEKLY_GOAL}</span></div><div><p className="muted">今週のメッツ・時</p><h2>{total >= WEEKLY_GOAL ? '目標達成です' : '少しずつ積み上げ中'}</h2><p className="muted">3メッツ以上の活動が週目標に加算されます。</p></div></section>
    {session && <section className="card running"><p className="eyebrow">IN PROGRESS</p><h2>{currentSessionActivity?.name}</h2><strong className="timer">{formatDuration(elapsedSeconds)} / {formatDuration(session.plannedMin * 60)}</strong><p className="muted">経過 / 予定。開始からの経過時間です。</p><div className="running-actions"><button className="primary" onClick={openEnd}>終了して編集・保存</button><button className="secondary" onClick={abandon}>記録せず中断</button></div></section>}
    <section className="card"><div className="section-title"><div><p className="eyebrow">QUICK START</p><h2>3つの条件から探す</h2></div></div><div className="condition-grid"><label>使える時間（分）<input inputMode="numeric" type="number" min="1" step="1" placeholder="指定なし" value={available} onChange={e => setAvailable(e.target.value)} /></label><label>増やしたい量（METs・時）<input inputMode="decimal" type="number" min="0" step="0.1" placeholder="指定なし" value={target} onChange={e => setTarget(e.target.value)} /></label><label>やりたい活動<select value={activityFilterId} onChange={e => setActivityFilterId(e.target.value)}><option value="">指定なし</option>{Object.entries(quickActivities.reduce<Record<string, typeof quickActivities>>((groups, activity) => { (groups[activity.category] ??= []).push(activity); return groups; }, {})).map(([category, categoryActivities]) => <optgroup label={category} key={category}>{categoryActivities.map(activity => <option value={activity.id} key={activity.id}>{activity.name}（{activity.mets} METs）</option>)}</optgroup>)}</select></label></div><p className="hint">クイック候補は週目標に加算される3 METs以上です。活動を選ぶと、その活動だけを候補に表示します。METs・時は回数ではなく予定・実施時間（分）で計算し、複数条件はすべて満たす候補を表示します。</p><div className="candidate-head"><b>候補</b>{candidateLoading && <span className="muted">探しています…</span>}</div><div className="choices">{candidates.map(a => <article className={selectedId === a.id ? 'choice-card active' : 'choice-card'} key={a.id}><button className="choice" onClick={() => setSelectedId(selectedId === a.id ? '' : a.id)} aria-pressed={selectedId === a.id}><b>{a.name}</b><small>{a.description}</small><small>{a.category} ・ {a.mets} METs ・ 予定{a.plannedMin}分</small>{a.repetitionGuide && <small>開始目安：{a.repetitionGuide.replace(/^開始目安：/, '')}</small>}<small className="mets-hours">週目標に +{formatMetsHours(goalMetsHours(a.mets, a.plannedMin))} METs・時</small><span className="selection-state">{selectedId === a.id ? '選択中' : '選択する'}</span></button><details className="evidence"><summary>根拠・引用を見る</summary><p><b>引用（原文）</b></p><blockquote>{a.sourceQuote}</blockquote><p><b>参考訳（アプリ）</b><br />{a.sourceTranslation}</p><dl><dt>METs</dt><dd>{a.mets}</dd><dt>コード</dt><dd>{a.sourceCode}</dd><dt>出典</dt><dd><a href={a.sourceUrl} target="_blank" rel="noreferrer">{a.sourceDocument}</a>（{a.sourceVersion}）</dd><dt>照合状態</dt><dd>{a.verificationStatus}</dd><dt>根拠の範囲</dt><dd>{a.evidenceRelation}</dd>{a.sourceNote && <><dt>注記</dt><dd>{a.sourceNote}</dd></>}</dl></details></article>)}</div>{!candidateLoading && candidates.length === 0 && <p className="muted">条件に合う候補がありません。クイック候補は週目標に加算される3 METs以上です。3 METs未満の活動は「あとから記録」から選べます。</p>}<button className="primary" disabled={Boolean(session) || candidateLoading || candidates.length === 0 || !selected} onClick={start}>選んだ活動を始める</button><p className="feedback" aria-live="polite">{message}</p></section>
    <details className="card later"><summary>あとから記録する</summary><p className="muted">開始・終了を使わず、過去24時間以内の活動を記録します。</p><LaterRecord onSaved={record => setRecords(old => [...old, record])} /></details>
    <section className="card"><div className="section-title"><div><p className="eyebrow">HISTORY</p><h2>最近の記録</h2></div></div>{records.length === 0 ? <p className="muted">まだ記録がありません。</p> : <ul className="records">{[...records].reverse().map(r => <li key={r.id}><div><b>{name(r.activityId)}</b><small>{r.durationMin}分 ・ {new Date(r.recordedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</small></div><strong>+{formatNumber(r.goalValue)}</strong><button className="delete" onClick={() => setRecords(old => old.filter(x => x.id !== r.id))}>削除</button></li>)}</ul>}</section>
    <section className="card notes"><h2>出典と注意事項</h2><p>週23メッツ・時は、厚生労働省「健康づくりのための身体活動・運動ガイド2023」に基づく成人向けの目安です。</p><p>活動マスタの候補は、2024 Adult Compendium of Physical Activitiesの該当行（コード・METs・原文）を照合済みです。表示する参考訳・時間・回数はアプリ作成の開始目安で、公式日本語訳や個人への推奨ではありません。回数はMETs・時計算には使わず、実施時間で計算します。</p></section>
    {endOpen && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><h2>活動を終了して保存</h2><p className="muted">保存する内容を確認・編集してください。記録日時は終了時です。</p><label>活動<select value={endActivityId} onChange={e => setEndActivityId(e.target.value)}>{activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>合計時間（分）<input type="number" min="1" max={MAX_RECORD_DURATION_MIN} step="1" value={endMinutes} onChange={e => setEndMinutes(e.target.value)} /></label><p className="hint">秒は切り捨てて整数分で初期表示します。1分未満は記録できません（最大24時間）。1分以上に変更すれば保存できます。</p><button className="primary" disabled={finishingRef.current} onClick={finish}>終了して保存</button><button className="secondary" onClick={() => setEndOpen(false)}>戻る</button></div></div>}
    <footer><span>Giri23 MVP</span><span>JST ・ 月曜始まり</span></footer>
  </main>;
}

function LaterRecord({ onSaved }: { onSaved: (record: Saved) => void }) {
  const [activityId, setActivityId] = useState(activities[0].id); const [minutes, setMinutes] = useState('5'); const [message, setMessage] = useState('');
  const save = () => { const activity = activities.find(a => a.id === activityId)!; const duration = floorPositiveMinutes(Number(minutes)); const recordedAt = new Date(); const error = validateRecord({ activityId, durationMin: duration, recordedAt }); if (error) { setMessage(error); return; } onSaved({ id: crypto.randomUUID(), activityId, durationMin: duration, recordedAt: recordedAt.toISOString(), mets: activity.mets, goalValue: goalMetsHours(activity.mets, duration) }); setMessage('保存しました。'); };
  return <><div className="form-row"><label>活動<select value={activityId} onChange={e => setActivityId(e.target.value)}>{activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>時間（分）<input type="number" min="1" max={MAX_RECORD_DURATION_MIN} step="1" value={minutes} onChange={e => setMinutes(e.target.value)} /></label></div><button className="primary" onClick={save}>記録を保存する</button><p className="feedback">{message}</p></>;
}

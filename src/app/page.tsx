'use client';
import { useEffect, useState } from 'react';
import { activities } from '../lib/activities';
import { formatNumber, goalMetsHours, kcal, validateRecord, weekStart, WEEKLY_GOAL, MAX_RECORD_DURATION_MIN } from '../lib/domain';

type Saved = { id: string; activityId: string; durationMin: number; recordedAt: string; mets: number; goalValue: number; kcal: number | null };

function isSavedRecord(value: unknown): value is Saved {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && record.id.length > 0
    && typeof record.activityId === 'string' && record.activityId.length > 0
    && typeof record.durationMin === 'number' && Number.isFinite(record.durationMin) && record.durationMin > 0 && record.durationMin <= MAX_RECORD_DURATION_MIN
    && typeof record.recordedAt === 'string' && Number.isFinite(Date.parse(record.recordedAt))
    && typeof record.mets === 'number' && Number.isFinite(record.mets) && record.mets >= 0
    && typeof record.goalValue === 'number' && Number.isFinite(record.goalValue) && record.goalValue >= 0
    && (record.kcal === null || (typeof record.kcal === 'number' && Number.isFinite(record.kcal) && record.kcal >= 0));
}

export default function Home() {
  const [records, setRecords] = useState<Saved[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [selected, setSelected] = useState('walk-normal');
  const [minutes, setMinutes] = useState('20');
  const [query, setQuery] = useState('');
  const [weight, setWeight] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('giri23-records');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecords(parsed.filter(isSavedRecord));
      } else {
        const recordedAt = new Date();
        setRecords([{ id: 'demo-1', activityId: 'dog-walk', durationMin: 15, recordedAt: recordedAt.toISOString(), mets: 3, goalValue: .75, kcal: null }]);
      }
    } catch {
      // Ignore unavailable storage and malformed saved data.
    }
    setHydrated(true);
  }, []);
  useEffect(() => { setNow(new Date()); }, []);
  useEffect(() => {
    if (hydrated) {
      try { localStorage.setItem('giri23-records', JSON.stringify(records)); } catch { /* Ignore unavailable storage. */ }
    }
  }, [hydrated, records]);
  const current = activities.find(a => a.id === selected) ?? activities[0];
  const visible = activities.filter(a => `${a.name}${a.category}`.includes(query));
  const total = now
    ? records.filter(r => new Date(r.recordedAt) >= weekStart(now)).reduce((sum, r) => sum + r.goalValue, 0)
    : 0;
  const progress = Math.min(100, total / WEEKLY_GOAL * 100);
  const addRecord = () => {
    const duration = Number(minutes);
    const recordedAt = new Date();
    const error = validateRecord({ activityId: selected, durationMin: duration, recordedAt });
    if (error) { setMessage(error); return; }
    setRecords([...records, { id: crypto.randomUUID(), activityId: selected, durationMin: duration, recordedAt: recordedAt.toISOString(), mets: current.mets, goalValue: goalMetsHours(current.mets, duration), kcal: kcal(current.mets, Number(weight) || undefined, duration) }]);
    setMessage('記録しました。');
  };
  const name = (id: string) => activities.find(a => a.id === id)?.name ?? '活動';
  return <main className="shell">
    <header><div><p className="eyebrow">Giri23</p><h1>今日、動いた分を<br /><em>ちゃんと数える。</em></h1></div><span className="badge">ローカルデモ</span></header>
    <section className="hero card"><div className="ring" style={{ '--progress': `${progress}%` } as React.CSSProperties}><strong>{formatNumber(total)}</strong><span>/ {WEEKLY_GOAL}</span></div><div><p className="muted">今週のメッツ・時</p><h2>{total >= WEEKLY_GOAL ? '目標達成です' : '少しずつ積み上げ中'}</h2><p className="muted">3メッツ以上の活動が週目標に加算されます。</p></div></section>
    <section className="card"><div className="section-title"><div><p className="eyebrow">RECORD</p><h2>活動を記録する</h2></div></div><label>活動を選ぶ<input placeholder="活動名で検索" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="choices">{visible.map(a => <button className={selected === a.id ? 'choice active' : 'choice'} key={a.id} onClick={() => setSelected(a.id)}><b>{a.name}</b><small>{a.category} ・ {a.mets} METs</small></button>)}</div><div className="form-row"><label>時間（分）<input type="number" min="1" max={MAX_RECORD_DURATION_MIN} value={minutes} onChange={e => setMinutes(e.target.value)} /></label><label>体重（任意）<input type="number" min="1" placeholder="kg" value={weight} onChange={e => setWeight(e.target.value)} /></label></div><div className="preview"><span>{current.name} {minutes || 0}分</span><strong>+{formatNumber(goalMetsHours(current.mets, Number(minutes) || 0))}</strong>{current.mets < 3 && <small>週目標には加算されません（活動時間として保存）</small>}</div><button className="primary" onClick={addRecord}>この活動を記録する</button><p className="feedback" aria-live="polite">{message}</p></section>
    <section className="card"><div className="section-title"><div><p className="eyebrow">HISTORY</p><h2>最近の記録</h2></div></div>{records.length === 0 ? <p className="muted">まだ記録がありません。</p> : <ul className="records">{[...records].reverse().map(r => <li key={r.id}><div><b>{name(r.activityId)}</b><small>{r.durationMin}分 ・ {new Date(r.recordedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</small></div><strong>+{formatNumber(r.goalValue)}</strong><button className="delete" onClick={() => setRecords(records.filter(x => x.id !== r.id))}>削除</button></li>)}</ul>}</section>
    <section className="card notes"><h2>出典と注意事項</h2><p>週23メッツ・時は、厚生労働省「健康づくりのための身体活動・運動ガイド2023」に基づく成人向けの目安です。</p><p>活動マスタは医薬基盤・健康・栄養研究所「身体活動のメッツ(METs)表」改訂第2版（2024年）を原典とします。医療上の助言ではありません。</p><p className="muted">現在はブラウザ内のローカルストレージ相当のデモ状態です。LINEログイン、LIFF、サーバー保存は本番接続前です。</p></section>
    <footer><span>Giri23 MVP</span><span>JST ・ 月曜始まり</span></footer>
  </main>;
}

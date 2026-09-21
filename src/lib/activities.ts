import type { Activity } from './domain';

// Demo subset. The production import keeps every master row and must preserve sourceCode.
export const activities: Activity[] = [
  { id: 'walk-normal', name: '歩行（ふつう）', category: '歩く', mets: 3.8, sourceCode: '17270' },
  { id: 'walk-fast', name: '歩行（速い）', category: '歩く', mets: 4.8, sourceCode: '17251' },
  { id: 'dog-walk', name: '犬の散歩', category: '歩く', mets: 3.0, sourceCode: '17165' },
  { id: 'walk-slow', name: '歩行（ゆっくり）', category: '歩く', mets: 2.8, sourceCode: '17250' },
  { id: 'housework', name: '家事（軽い）', category: '家事', mets: 2.5, sourceCode: '05000' },
  { id: 'weeding', name: '草むしり', category: '庭仕事', mets: 3.8, sourceCode: '08240' },
  { id: 'bodyweight', name: '自重トレーニング', category: '運動', mets: 3.5, sourceCode: '02110' },
  { id: 'stretch', name: 'ストレッチ', category: '運動', mets: 2.3, sourceCode: '02101' },
  { id: 'stairs', name: '階段（ゆっくり）', category: '移動', mets: 4.0, sourceCode: '17110' },
];

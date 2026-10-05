// 과업 결과 화면 확인용 시드. 개발 서버가 MINDLENS_DATA_DIR 로 떠 있는 상태에서 실행한다.
//   BASE_URL=http://127.0.0.1:3603 MINDLENS_DATA_DIR=/tmp/x node scripts/seed-task-demo.mjs
// 데모 연구를 만들고 과업 2개·참여자 4명·과업 시도·자유/과업 단계 클릭을 직접 넣는다. 로컬 개발 전용.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { screenHash, screenId } from '../src/lib/screen-hash.ts';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3603';
const DIR = process.env.MINDLENS_DATA_DIR;
if (!DIR) throw new Error('MINDLENS_DATA_DIR 가 필요합니다.');
const post = async (url, body) => { const r = await fetch(BASE + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(url + ' ' + r.status + ' ' + await r.text()); return r.json(); };

const { study } = await post('/api/demo', { owner: 'tester' });
const db = new DatabaseSync(path.join(DIR, 'mindlens.sqlite'));
const tasks = [
  { id: 't1', instruction: '이번 주 마감인 프로젝트를 찾아보세요.', timeLimitSeconds: 120, criteria: { A: { text: '마감' }, B: { text: '마감' } } },
  { id: 't2', instruction: '새 프로젝트를 만들어 보세요.', timeLimitSeconds: 90, criteria: { A: { componentLabel: '새 프로젝트' }, B: { componentLabel: '새 프로젝트' } } },
];
db.prepare('UPDATE studies SET payload=? WHERE id=?').run(JSON.stringify({ ...study, tasks }), study.id);

// 화면: 시안별 실제 HTML 에 표식만 달리한 2장(수집 화면 API 사용)
const html = {}; for (const v of ['A', 'B']) html[v] = await (await fetch(`${BASE}/api/studies/${study.id}/html?variant=${v}`)).text();
const names = ['가영', '나영', '다영', '라영'];
const sessions = []; for (const n of names) sessions.push((await post('/api/sessions', { studyId: study.id, name: n })).session);
const screens = { A: [], B: [] };
for (const v of ['A', 'B']) for (const k of [1, 2]) {
  const h = html[v].replace('</body>', `<!-- seed ${v}${k} --></body>`); const hash = screenHash(h);
  await post(`/api/sessions/${sessions[0].id}/screens`, { variant: v, hash, html: h }); screens[v].push(screenId(study.id, v, hash));
}

const ins = (sid, table, payload) => db.prepare(`INSERT INTO ${table}(sessionId,payload) VALUES (?,?)`).run(sid, JSON.stringify(payload));
const click = (sid, o) => ins(sid, 'events', { sessionId: sid, component: '요소', tag: 'div', text: '', selector: 'div', x: 10, y: 10, viewportWidth: 1280, viewportHeight: 800, kind: 'interactive', componentPath: 'body>div', source: 'prototype', createdAt: new Date().toISOString(), ...o });
const attempt = (i, o) => db.prepare('INSERT INTO task_attempts(sessionId,taskId,variant,payload) VALUES (?,?,?,?)').run(sessions[i].id, o.taskId, o.variant, JSON.stringify({ sessionId: sessions[i].id, clickCount: 3, createdAt: new Date().toISOString(), ...o }));

for (const [i, s] of sessions.entries()) for (const v of ['A', 'B']) {
  // 자유 탐색 클릭 2회
  click(s.id, { variant: v, elapsedMs: 1000, phase: 'free', screenId: screens[v][0], component: '자유 탐색 요소' });
  click(s.id, { variant: v, elapsedMs: 2500, phase: 'free', screenId: screens[v][0], component: '자유 탐색 요소', kind: 'static' });
  // 과업 클릭
  for (const t of ['t1', 't2']) {
    click(s.id, { variant: v, elapsedMs: 3000 + i * 10, phase: 'task:' + t, screenId: screens[v][0], component: `${t} 첫 클릭`, kind: i % 2 ? 'static' : 'interactive' });
    click(s.id, { variant: v, elapsedMs: 5000 + i * 10, phase: 'task:' + t, screenId: screens[v][1], component: `${t} 두 번째 클릭` });
  }
}
// t1 A: 성공(검증) / 시간 초과 / 성공(검증 안 됨) / 포기  → 1/4, 평균 12.3초
attempt(0, { taskId: 't1', variant: 'A', outcome: 'success', matchedBy: 'text', durationMs: 12300, firstClickCorrect: true, verified: true });
attempt(1, { taskId: 't1', variant: 'A', outcome: 'timeout', durationMs: 120000, firstClickCorrect: false, lastScreenId: screens.A[1] });
attempt(2, { taskId: 't1', variant: 'A', outcome: 'success', matchedBy: 'text', durationMs: 30000, firstClickCorrect: true, verified: false });
attempt(3, { taskId: 't1', variant: 'A', outcome: 'gave_up', durationMs: 45000, firstClickCorrect: false, lastScreenId: screens.A[1] });
// t1 B: 성공 3 / 시간 초과 1 → 3/4, 8,9,15초
attempt(0, { taskId: 't1', variant: 'B', outcome: 'success', matchedBy: 'text', durationMs: 8000, firstClickCorrect: true, verified: true });
attempt(1, { taskId: 't1', variant: 'B', outcome: 'success', matchedBy: 'text', durationMs: 9000, firstClickCorrect: true, verified: true });
attempt(2, { taskId: 't1', variant: 'B', outcome: 'success', matchedBy: 'text', durationMs: 15000, firstClickCorrect: false, verified: true });
attempt(3, { taskId: 't1', variant: 'B', outcome: 'timeout', durationMs: 120000, firstClickCorrect: false, lastScreenId: screens.B[0] });
// t2 A: 2/3 성공(검증), 1 포기 / t2 B: 4/4 성공
attempt(0, { taskId: 't2', variant: 'A', outcome: 'success', matchedBy: 'component', durationMs: 20000, firstClickCorrect: true, verified: true });
attempt(1, { taskId: 't2', variant: 'A', outcome: 'success', matchedBy: 'component', durationMs: 25000, firstClickCorrect: true, verified: true });
attempt(2, { taskId: 't2', variant: 'A', outcome: 'gave_up', durationMs: 60000, firstClickCorrect: false, lastScreenId: screens.A[0] });
for (let i = 0; i < 4; i++) attempt(i, { taskId: 't2', variant: 'B', outcome: 'success', matchedBy: 'component', durationMs: 5000 + i * 1000, firstClickCorrect: true, verified: true });
console.log(JSON.stringify({ studyId: study.id, url: `${BASE}/workspace/${study.id}` }));

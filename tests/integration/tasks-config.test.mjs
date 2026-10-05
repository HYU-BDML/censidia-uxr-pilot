import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3100';
const post = (path, body) => fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (path, body) => fetch(BASE + path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const page = (t) => `<!DOCTYPE html><html><head></head><body><main><button>${t}</button></main></body></html>`;
const createStudy = (tasks, owner = 'task-owner') => {
  const f = new FormData();
  f.set('owner', owner); f.set('title', '과업 테스트'); f.set('description', ''); f.set('durationSeconds', '15');
  f.set('htmlA', new File([page('A')], 'a.html', { type: 'text/html' }));
  f.set('htmlB', new File([page('B')], 'b.html', { type: 'text/html' }));
  if (tasks !== undefined) f.set('tasks', typeof tasks === 'string' ? tasks : JSON.stringify(tasks));
  return fetch(BASE + '/api/studies', { method: 'POST', body: f });
};
const good = [
  { id: 'zzz', instruction: ' 설정 열기 ', timeLimitSeconds: 60, criteria: { A: { componentPath: 'main > button', componentLabel: 'A' }, B: { state: { path: 'select:nth-of-type(1)', property: 'value', expected: ' warning ' } } } },
  { instruction: '두번째', criteria: { A: { state: { anchor: '#status', path: '', property: 'text', expected: '주의', match: 'contains' } }, B: { state: { anchor: '#status', path: '', property: 'text', expected: '주의' } } } },
];
let study;

before(async () => {
  const r = await createStudy(good);
  assert.equal(r.status, 201, `서버(${BASE})가 떠 있어야 한다`);
  study = (await r.json()).study;
});

test('과업은 서버가 t1.. id 를 부여해 저장한다', () => {
  assert.deepEqual(study.tasks.map((t) => t.id), ['t1', 't2']);
  assert.equal(study.tasks[0].instruction, '설정 열기');
  assert.equal(study.tasks[1].timeLimitSeconds, 120);
});

test('GET /api/studies/:id 가 tasks 를 돌려준다', async () => {
  const s = (await (await fetch(`${BASE}/api/studies/${study.id}`)).json()).study;
  assert.equal(s.tasks.length, 2);
  assert.equal(s.tasks[0].criteria.A.componentPath, 'main > button');
  assert.deepEqual(s.tasks[0].criteria.B.state, { path: 'select:nth-of-type(1)', property: 'value', expected: 'warning', match: 'equals' });
  assert.equal(s.tasks[1].criteria.A.state.match, 'contains');
});

test('잘못된 과업은 400', async () => {
  assert.equal((await createStudy('not json')).status, 400);
  const st = { path: '', property: 'text', expected: 'a' };
  assert.equal((await createStudy([{ instruction: 'x', criteria: { A: { state: st }, B: {} } }])).status, 400);
  assert.equal((await createStudy([{ instruction: 'x', criteria: { A: { text: 'a' }, B: { state: st } } }])).status, 400);
  assert.equal((await createStudy([{ instruction: 'x', criteria: { A: { state: { ...st, property: 'html' } }, B: { state: st } } }])).status, 400);
  assert.equal((await createStudy([{ instruction: 'x', criteria: { A: { state: { ...st, property: 'attr' } }, B: { state: st } } }])).status, 400);
  assert.equal((await createStudy([{ instruction: 'x', criteria: { A: { state: { ...st, expected: '' } }, B: { state: st } } }])).status, 400);
  assert.equal((await createStudy([{ instruction: 'x', criteria: { A: { state: { ...st, anchor: 'a'.repeat(301) } }, B: { state: st } } }])).status, 400);
});

test('과업 없는 연구도 생성된다', async () => {
  const s = (await (await createStudy()).json()).study;
  assert.equal(s.tasks?.length ?? 0, 0);
});

test('PATCH: 소유자는 참여 전 수정 가능, 타인 403, 참여 후 409, 잘못된 입력 400', async () => {
  const path = `/api/studies/${study.id}/tasks`;
  const next = [{ instruction: '수정됨', timeLimitSeconds: 30, criteria: { A: { state: { path: '', property: 'text', expected: 'a' } }, B: { state: { path: '', property: 'checked', expected: 'true' } } } }];
  assert.equal((await patch(path, { owner: 'someone-else', tasks: next })).status, 403);
  assert.equal((await patch(path, { owner: 'task-owner', tasks: [{ instruction: 'x', criteria: {} }] })).status, 400);
  const ok = await patch(path, { owner: ' task-owner ', tasks: next });
  assert.equal(ok.status, 200);
  const saved = (await ok.json()).study;
  assert.equal(saved.tasks.length, 1);
  assert.equal(saved.tasks[0].id, 't1');
  assert.equal((await (await fetch(`${BASE}/api/studies/${study.id}`)).json()).study.tasks[0].instruction, '수정됨');
  assert.equal((await post('/api/sessions', { studyId: study.id, name: 'p' })).status, 201);
  assert.equal((await patch(path, { owner: 'task-owner', tasks: next })).status, 409);
});

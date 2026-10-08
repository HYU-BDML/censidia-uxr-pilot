import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { screenHash } from '../../src/lib/screen-hash.ts';
import { SURVEY_QUESTIONS } from '../../src/lib/types.ts';

// Worker A 가 연구 생성 API 에 `tasks` 를 붙이기 전이므로, 이 테스트는 서버가 쓰는 SQLite
// (MINDLENS_DATA_DIR 의 mindlens.sqlite)의 연구 payload 에 tasks 를 직접 써 넣는다.
// 서버는 요청마다 getStudy 로 DB 를 다시 읽으므로 재시작이 필요 없다.
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3100';
const DATA_DIR = process.env.MINDLENS_DATA_DIR;
const post = (p, body) =>
  fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (p, body) =>
  fetch(BASE + p, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const PATH = 'body>main:nth-of-type(1)>button:nth-of-type(1)';
const STATE = {
  anchor: '[data-project-id="PRJ-101"]',
  path: 'span:nth-of-type(1)',
  property: 'text',
  expected: '주의',
  match: 'equals',
};
const PROOF = '<span data-field="status" class="badge">주의</span>';
const tasks = [1, 2, 3, 4, 5].map((n) => ({
  id: `t${n}`,
  instruction: `과업 ${n}`,
  timeLimitSeconds: 60,
  criteria:
    n >= 3
      ? { A: { state: STATE }, B: { state: STATE } }
      : { A: { componentPath: PATH, componentLabel: '저장' }, B: { componentPath: PATH, componentLabel: '저장' } },
}));
const evidenceHtml = `<!DOCTYPE html><html><head><style>.x{}</style></head><body><main><table><tr data-project-id="PRJ-101"><td>Orbit</td><td>${PROOF}</td></tr></table></main></body></html>`;
const plainHtml = '<!DOCTYPE html><html><head></head><body><main><p>아무 화면</p></main></body></html>';
let study, session, v, evidenceId, plainId;

async function putScreen(html) {
  const hash = screenHash(html);
  assert.equal((await post(`/api/sessions/${session.id}/screens`, { variant: v, hash, html })).status, 200);
  return `${study.id}_${v}_${hash}`;
}
const click = (extra) => ({
  variant: v,
  elapsedMs: 100,
  component: '저장',
  tag: 'button',
  text: '저장',
  selector: 'button',
  x: 1,
  y: 1,
  viewportWidth: 800,
  viewportHeight: 600,
  componentPath: PATH,
  kind: 'interactive',
  ...extra,
});
const attempt = (extra) => ({
  taskId: 't1',
  variant: v,
  outcome: 'success',
  matchedBy: 'component',
  durationMs: 4000,
  clickCount: 1,
  ...extra,
});
const results = async () => (await fetch(`${BASE}/api/studies/${study.id}/results`)).json();

before(async () => {
  assert.ok(DATA_DIR, 'MINDLENS_DATA_DIR 가 서버와 같은 값으로 설정되어 있어야 한다');
  const s = await post('/api/demo', { owner: `task-attempts-${Date.now()}`, durationSeconds: 15 });
  assert.ok(s.status === 200 || s.status === 201, `서버(${BASE})가 떠 있어야 한다`);
  study = (await s.json()).study;
  const d = new DatabaseSync(path.join(path.resolve(DATA_DIR), 'mindlens.sqlite'));
  d.exec('PRAGMA busy_timeout=5000');
  d.prepare('UPDATE studies SET payload=? WHERE id=?').run(JSON.stringify({ ...study, tasks }), study.id);
  d.close();
  session = (await (await post('/api/sessions', { studyId: study.id, name: 'tester' })).json()).session;
  v = session.currentVariant;
  evidenceId = await putScreen(evidenceHtml);
  plainId = await putScreen(plainHtml);
});

test('이벤트 phase 는 free / task:tN 만 저장되고 나머지는 버려진다', async () => {
  const r = await post(`/api/sessions/${session.id}/events`, {
    events: [
      click({ phase: 'free' }),
      click({ phase: 'task:t1' }),
      click({ phase: 'bogus' }),
      click({ phase: 'task:t0' }),
      click({}),
    ],
  });
  assert.equal(r.status, 200);
  const phases = (await results()).events.map((e) => e.phase);
  assert.deepEqual(phases, ['free', 'task:t1', undefined, undefined, undefined]);
});

test('컴포넌트 성공: 이 과업의 클릭이 있으면 verified=true', async () => {
  const r = await post(`/api/sessions/${session.id}/task-attempts`, {
    attempts: [attempt({ firstClickCorrect: true, lastScreenId: plainId })],
  });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { saved: 1 });
  const a = (await results()).taskAttempts.find((x) => x.taskId === 't1' && x.variant === v);
  assert.equal(a.outcome, 'success');
  assert.equal(a.verified, true);
  assert.equal(a.firstClickCorrect, true);
  assert.equal(a.lastScreenId, plainId);
  assert.equal(a.sessionId, session.id);
});

test('근거 클릭이 없는 성공 주장은 저장되지만 verified=false', async () => {
  const r = await post(`/api/sessions/${session.id}/task-attempts`, { attempts: [attempt({ taskId: 't2' })] });
  assert.deepEqual(await r.json(), { saved: 1 });
  const a = (await results()).taskAttempts.find((x) => x.taskId === 't2' && x.variant === v);
  assert.equal(a.outcome, 'success');
  assert.equal(a.verified, false);
});

test('상태 성공: 근거 화면 + 증명이 맞으면 verified=true 이고 증명이 저장된다', async () => {
  const ok = await post(`/api/sessions/${session.id}/task-attempts`, {
    attempts: [attempt({ taskId: 't3', matchedBy: 'state', evidenceScreenId: evidenceId, evidenceProof: PROOF })],
  });
  assert.deepEqual(await ok.json(), { saved: 1 });
  const a = (await results()).taskAttempts.find((x) => x.taskId === 't3' && x.variant === v);
  assert.equal(a.matchedBy, 'state');
  assert.equal(a.evidenceScreenId, evidenceId);
  assert.equal(a.evidenceProof, PROOF);
  assert.equal(a.verified, true);
});

test('상태 성공 주장이라도 증명이 근거 화면에 없으면 저장은 되지만 verified=false', async () => {
  const r = await post(`/api/sessions/${session.id}/task-attempts`, {
    attempts: [
      attempt({
        taskId: 't4',
        matchedBy: 'state',
        evidenceScreenId: evidenceId,
        evidenceProof: '<span data-field="status">조작</span>',
      }),
    ],
  });
  assert.deepEqual(await r.json(), { saved: 1 });
  assert.equal((await results()).taskAttempts.find((x) => x.taskId === 't4' && x.variant === v).verified, false);
});

test('상태 성공인데 증명 또는 근거 화면이 없으면 verified=false', async () => {
  const r = await post(`/api/sessions/${session.id}/task-attempts`, {
    attempts: [attempt({ taskId: 't5', matchedBy: 'state', evidenceScreenId: evidenceId })],
  });
  assert.deepEqual(await r.json(), { saved: 1 });
  assert.equal((await results()).taskAttempts.find((x) => x.taskId === 't5' && x.variant === v).verified, false);
});

test('옛 matchedBy "text" 와 잘못된 evidenceProof 는 400', async () => {
  const bad = async (a) => (await post(`/api/sessions/${session.id}/task-attempts`, { attempts: [a] })).status;
  assert.equal(await bad(attempt({ taskId: 't3', matchedBy: 'text' })), 400);
  assert.equal(await bad(attempt({ taskId: 't3', matchedBy: 'state', evidenceProof: 5 })), 400);
  assert.equal(await bad(attempt({ taskId: 't3', matchedBy: 'state', evidenceProof: 'x'.repeat(20001) })), 400);
});

test('실패 결과(timeout·gave_up)는 matchedBy 없이 저장된다', async () => {
  const other = v === 'A' ? 'B' : 'A';
  const r = await post(`/api/sessions/${session.id}/task-attempts`, {
    attempts: [
      { taskId: 't1', variant: other, outcome: 'timeout', durationMs: 60000, clickCount: 3 },
      { taskId: 't2', variant: other, outcome: 'gave_up', durationMs: 9000, clickCount: 0 },
    ],
  });
  assert.deepEqual(await r.json(), { saved: 2 });
  const got = (await results()).taskAttempts.filter((x) => x.variant === other);
  assert.deepEqual(got.map((x) => x.outcome).sort(), ['gave_up', 'timeout']);
});

test('같은 시도를 다시 보내면 saved=0(멱등)', async () => {
  const r = await post(`/api/sessions/${session.id}/task-attempts`, { attempts: [attempt()] });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { saved: 0 });
});

test('잘못된 입력은 400: 없는 과업·성공인데 matchedBy 없음·범위 밖 값·없는 화면', async () => {
  const bad = async (a) => (await post(`/api/sessions/${session.id}/task-attempts`, { attempts: [a] })).status;
  assert.equal(await bad(attempt({ taskId: 't9' })), 400);
  assert.equal(await bad(attempt({ matchedBy: undefined })), 400);
  assert.equal(await bad(attempt({ outcome: 'timeout', matchedBy: 'component' })), 400);
  assert.equal(await bad(attempt({ outcome: 'nope' })), 400);
  assert.equal(await bad(attempt({ durationMs: -1 })), 400);
  assert.equal(await bad(attempt({ clickCount: 1.5 })), 400);
  assert.equal(await bad(attempt({ evidenceScreenId: `${study.id}_${v}_${'f'.repeat(28)}` })), 400);
  assert.equal((await post(`/api/sessions/${session.id}/task-attempts`, { attempts: 'no' })).status, 400);
  assert.equal(
    (await post(`/api/sessions/${session.id}/task-attempts`, { attempts: Array(11).fill(attempt()) })).status,
    400,
  );
});

test('완료한 세션은 과업 시도를 더 저장할 수 없다(409)', async () => {
  const answers = SURVEY_QUESTIONS.map((q) => ({ questionId: q.id, choice: q.options[0], otherText: '' }));
  const [first, second] = session.order;
  assert.equal((await post(`/api/sessions/${session.id}/surveys`, { variant: first, answers })).status, 200);
  assert.equal((await patch(`/api/sessions/${session.id}`, { currentVariant: second })).status, 200);
  assert.equal((await post(`/api/sessions/${session.id}/surveys`, { variant: second, answers })).status, 200);
  assert.equal(
    (await patch(`/api/sessions/${session.id}`, { elapsedA: 15, elapsedB: 15, preference: 'A', status: 'completed' }))
      .status,
    200,
  );
  assert.equal(
    (await post(`/api/sessions/${session.id}/task-attempts`, { attempts: [attempt({ taskId: 't2' })] })).status,
    409,
  );
});

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { screenHash } from '../../src/lib/screen-hash.ts';
import { SURVEY_QUESTIONS } from '../../src/lib/types.ts';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3100';
const post = (path, body) =>
  fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (path, body) =>
  fetch(BASE + path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const html = '<!DOCTYPE html><html><head></head><body><main><button>저장</button></main></body></html>';
const hash = screenHash(html);
let study, session, sid;

before(async () => {
  const s = await post('/api/demo', { owner: 'comments-test', durationSeconds: 15 });
  assert.equal(s.status, 201, `서버(${BASE})가 떠 있어야 한다`);
  study = (await s.json()).study;
  session = (await (await post('/api/sessions', { studyId: study.id, name: 'tester' })).json()).session;
  assert.equal(
    (await post(`/api/sessions/${session.id}/screens`, { variant: session.currentVariant, hash, html })).status,
    200,
  );
  sid = `${study.id}_${session.currentVariant}_${hash}`;
});

const comment = (extra) => ({
  variant: session.currentVariant,
  label: '저장',
  text: '  버튼 위치가 헷갈려요  ',
  elapsedMs: 1234,
  componentPath: 'body>main:nth-of-type(1)>button:nth-of-type(1)',
  kind: 'interactive',
  ...extra,
});

test('의견 저장 후 결과 API 의 comments 에 나타난다', async () => {
  const r = await post(`/api/sessions/${session.id}/comments`, {
    comments: [comment({ screenId: sid }), comment({ text: '화면 없는 의견' })],
  });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { saved: 2 });
  const results = await (await fetch(`${BASE}/api/studies/${study.id}/results`)).json();
  assert.equal(results.comments.length, 2);
  const c = results.comments[0];
  assert.equal(c.text, '버튼 위치가 헷갈려요');
  assert.equal(c.screenId, sid);
  assert.equal(c.sessionId, session.id);
  assert.equal(c.label, '저장');
  assert.ok(c.createdAt);
});

test('빈 의견은 400', async () => {
  assert.equal(
    (await post(`/api/sessions/${session.id}/comments`, { comments: [comment({ text: '   ' })] })).status,
    400,
  );
  assert.equal(
    (await post(`/api/sessions/${session.id}/comments`, { comments: [comment({ text: 'x'.repeat(1001) })] })).status,
    400,
  );
  assert.equal((await post(`/api/sessions/${session.id}/comments`, { comments: 'no' })).status, 400);
});

test('없는 화면·다른 시안 화면을 가리키면 400', async () => {
  assert.equal(
    (
      await post(`/api/sessions/${session.id}/comments`, {
        comments: [comment({ screenId: `${study.id}_${session.currentVariant}_${'f'.repeat(28)}` })],
      })
    ).status,
    400,
  );
  const other = session.currentVariant === 'A' ? 'B' : 'A';
  assert.equal(
    (await post(`/api/sessions/${session.id}/comments`, { comments: [comment({ variant: other, screenId: sid })] }))
      .status,
    400,
  );
});

test('완료한 세션은 의견을 더 저장할 수 없다(409)', async () => {
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
  assert.equal((await post(`/api/sessions/${session.id}/comments`, { comments: [comment()] })).status, 409);
});

test('의견의 phase 는 화이트리스트 형식만 저장한다', async () => {
  const fresh = (await (await post('/api/sessions', { studyId: study.id, name: 'phase-tester' })).json()).session;
  const r = await post(`/api/sessions/${fresh.id}/comments`, {
    comments: [
      comment({ variant: fresh.currentVariant, text: 'p-task', phase: 'task:t2' }),
      comment({ variant: fresh.currentVariant, text: 'p-free', phase: 'free' }),
      comment({ variant: fresh.currentVariant, text: 'p-bad', phase: 'task:../x' }),
    ],
  });
  assert.equal(r.status, 200);
  const results = await (await fetch(`${BASE}/api/studies/${study.id}/results`)).json();
  const by = (t) => results.comments.find((c) => c.text === t);
  assert.equal(by('p-task').phase, 'task:t2');
  assert.equal(by('p-free').phase, 'free');
  assert.equal(by('p-bad').phase, undefined);
});

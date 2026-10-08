import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { screenHash, MAX_SCREENS_PER_VARIANT } from '../../src/lib/screen-hash.ts';
import { SURVEY_QUESTIONS } from '../../src/lib/types.ts';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3100';
const post = (path, body) =>
  fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (path, body) =>
  fetch(BASE + path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const html =
  '<!DOCTYPE html><html><head></head><body><main><button>저장</button></main><script>1</script></body></html>';
const hash = screenHash(html);
let study, session;

before(async () => {
  const s = await post('/api/demo', { owner: 'heatmap-test', durationSeconds: 15 });
  assert.equal(s.status, 201, `서버(${BASE})가 떠 있어야 한다`);
  study = (await s.json()).study;
  const r = await post('/api/sessions', { studyId: study.id, name: 'tester' });
  session = (await r.json()).session;
});

const click = (extra) => ({
  variant: session.currentVariant,
  elapsedMs: 10,
  component: '저장',
  tag: 'button',
  text: '저장',
  selector: 'button',
  x: 1,
  y: 1,
  viewportWidth: 800,
  viewportHeight: 600,
  ...extra,
});

test('해시가 내용과 다르면 400', async () => {
  const r = await post(`/api/sessions/${session.id}/screens`, {
    variant: session.currentVariant,
    hash: '0'.repeat(28),
    html,
  });
  assert.equal(r.status, 400);
});

test('해시 형식이 틀리면 400', async () => {
  const r = await post(`/api/sessions/${session.id}/screens`, { variant: session.currentVariant, hash: 'abc', html });
  assert.equal(r.status, 400);
});

test('같은 화면은 한 번만 저장된다', async () => {
  const first = await post(`/api/sessions/${session.id}/screens`, { variant: session.currentVariant, hash, html });
  assert.equal(first.status, 200);
  const a = await first.json();
  assert.equal(a.id, `${study.id}_${session.currentVariant}_${hash}`);
  assert.equal(a.created, true);
  const again = await (
    await post(`/api/sessions/${session.id}/screens`, { variant: session.currentVariant, hash, html })
  ).json();
  assert.deepEqual(again, { id: a.id, created: false });
});

test('없는 화면을 가리키는 클릭은 400, 있는 화면은 저장', async () => {
  const bad = await post(`/api/sessions/${session.id}/events`, {
    events: [
      click({
        screenId: `${study.id}_${session.currentVariant}_${'f'.repeat(28)}`,
        componentPath: 'body>main:nth-of-type(1)>button:nth-of-type(1)',
        kind: 'interactive',
      }),
    ],
  });
  assert.equal(bad.status, 400);
  const other = session.currentVariant === 'A' ? 'B' : 'A';
  const wrongVariant = await post(`/api/sessions/${session.id}/events`, {
    events: [click({ variant: other, screenId: `${study.id}_${session.currentVariant}_${hash}` })],
  });
  assert.equal(wrongVariant.status, 400, '다른 시안의 화면을 가리키면 안 된다');
  const ok = await post(`/api/sessions/${session.id}/events`, {
    events: [
      click({
        screenId: `${study.id}_${session.currentVariant}_${hash}`,
        componentPath: 'body>main:nth-of-type(1)>button:nth-of-type(1)',
        kind: 'interactive',
      }),
    ],
  });
  assert.equal(ok.status, 200);
  const detail = await (await fetch(`${BASE}/api/sessions/${session.id}`)).json();
  const saved = detail.events.at(-1);
  assert.equal(saved.componentPath, 'body>main:nth-of-type(1)>button:nth-of-type(1)');
  assert.equal(saved.kind, 'interactive');
});

test('스냅샷 조회는 시안 스크립트를 빼고 오버레이를 넣어 샌드박스로 내려준다', async () => {
  const r = await fetch(`${BASE}/api/screens/${study.id}_${session.currentVariant}_${hash}`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /sandbox allow-scripts/);
  assert.match(csp, /default-src 'none'/);
  assert.ok(!csp.includes('allow-same-origin'));
  const body = await r.text();
  assert.ok(body.includes('data-mindlens-overlay'));
  assert.ok(!body.includes('<script>1</script>'));
  assert.equal((await fetch(`${BASE}/api/screens/nope`)).status, 404);
});

test('시안당 화면 수 한도를 넘으면 400, 이미 있는 화면은 200', async () => {
  const s = (await (await post('/api/demo', { owner: 'cap-test', durationSeconds: 15 })).json()).study;
  const ses = (await (await post('/api/sessions', { studyId: s.id, name: 'cap' })).json()).session;
  const put = (h) => post(`/api/sessions/${ses.id}/screens`, { variant: 'A', hash: screenHash(h), html: h });
  for (let i = 0; i < MAX_SCREENS_PER_VARIANT; i++) assert.equal((await put(`<p>${i}</p>`)).status, 200);
  const over = await put('<p>over</p>');
  assert.equal(over.status, 400);
  assert.match((await over.json()).error, /한도/);
  const again = await put('<p>0</p>');
  assert.equal(again.status, 200);
  assert.equal((await again.json()).created, false);
});

test('완료한 세션은 화면을 더 저장할 수 없다(409)', async () => {
  const answers = SURVEY_QUESTIONS.map((q) => ({ questionId: q.id, choice: q.options[0], otherText: '' }));
  const [first, second] = session.order;
  assert.equal((await post(`/api/sessions/${session.id}/surveys`, { variant: first, answers })).status, 200);
  assert.equal((await patch(`/api/sessions/${session.id}`, { currentVariant: second })).status, 200);
  assert.equal((await post(`/api/sessions/${session.id}/surveys`, { variant: second, answers })).status, 200);
  const done = await patch(`/api/sessions/${session.id}`, {
    elapsedA: 15,
    elapsedB: 15,
    preference: 'A',
    status: 'completed',
  });
  assert.equal(done.status, 200);
  const r = await post(`/api/sessions/${session.id}/screens`, {
    variant: 'A',
    hash: screenHash('<p>late</p>'),
    html: '<p>late</p>',
  });
  assert.equal(r.status, 409);
});

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { SURVEY_QUESTIONS } from '../../src/lib/types.ts';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3100';
const post = (path, body) => fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (path, body) => fetch(BASE + path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const page = (t) => `<!DOCTYPE html><html><head></head><body><main><button>${t}</button></main></body></html>`;
const createStudy = (customQuestions) => {
  const f = new FormData();
  f.set('owner', 'cq-test'); f.set('title', '직접 질문 테스트'); f.set('description', ''); f.set('durationSeconds', '15');
  f.set('htmlA', new File([page('A')], 'a.html', { type: 'text/html' }));
  f.set('htmlB', new File([page('B')], 'b.html', { type: 'text/html' }));
  if (customQuestions !== undefined) f.set('customQuestions', typeof customQuestions === 'string' ? customQuestions : JSON.stringify(customQuestions));
  return fetch(BASE + '/api/studies', { method: 'POST', body: f });
};
const defaults = SURVEY_QUESTIONS.map((q) => ({ questionId: q.id, choice: q.options[0], otherText: '' }));
const customs = [{ questionId: 'c1', choice: '둘째', otherText: '' }, { questionId: 'c2', choice: '', otherText: '  좋았어요  ' }];
let study, session;

before(async () => {
  const r = await createStudy([{ id: 'zzz', type: 'choice', question: ' 가장 마음에 든 점? ', options: ['첫째', '둘째', '셋째'] }, { type: 'text', question: '더 하고 싶은 말' }]);
  assert.equal(r.status, 201, `서버(${BASE})가 떠 있어야 한다`);
  study = (await r.json()).study;
  session = (await (await post('/api/sessions', { studyId: study.id, name: 'tester' })).json()).session;
});

test('질문은 서버가 id를 부여해 저장한다', () => {
  assert.deepEqual(study.customQuestions.map((q) => q.id), ['c1', 'c2']);
  assert.equal(study.customQuestions[0].question, '가장 마음에 든 점?');
});

test('커스텀 질문 형식이 잘못되면 연구 생성 400', async () => {
  assert.equal((await createStudy('not json')).status, 400);
  assert.equal((await createStudy([{ type: 'choice', question: 'q', options: ['하나'] }])).status, 400);
  assert.equal((await createStudy(Array.from({ length: 11 }, () => ({ type: 'text', question: 'q' })))).status, 400);
});

test('커스텀 질문이 없는 연구는 기존처럼 5문항', async () => {
  const s = (await (await createStudy()).json()).study;
  assert.equal(s.customQuestions?.length ?? 0, 0);
});

test('커스텀 답변이 빠지거나 유효하지 않으면 400', async () => {
  const path = `/api/sessions/${session.id}/surveys`;
  const v = session.currentVariant;
  assert.equal((await post(path, { variant: v, answers: defaults })).status, 400);
  assert.equal((await post(path, { variant: v, answers: [...defaults, customs[0]] })).status, 400);
  assert.equal((await post(path, { variant: v, answers: [...defaults, { questionId: 'c1', choice: '없는선택지', otherText: '' }, customs[1]] })).status, 400);
  assert.equal((await post(path, { variant: v, answers: [...defaults, customs[0], { questionId: 'c2', choice: '', otherText: '   ' }] })).status, 400);
  assert.equal((await post(path, { variant: v, answers: [...defaults, customs[0], { ...customs[0] }] })).status, 400);
});

test('전체 흐름: 두 시안 설문 저장 후 세션 완료', async () => {
  const [first, second] = session.order;
  const path = `/api/sessions/${session.id}/surveys`;
  assert.equal((await post(path, { variant: first, answers: [...defaults, ...customs] })).status, 200);
  assert.equal((await patch(`/api/sessions/${session.id}`, { currentVariant: second })).status, 200);
  assert.equal((await post(path, { variant: second, answers: [...defaults, ...customs] })).status, 200);
  const done = await patch(`/api/sessions/${session.id}`, { elapsedA: 15, elapsedB: 15, preference: 'A', status: 'completed' });
  assert.equal(done.status, 200);
  const detail = await (await fetch(`${BASE}/api/sessions/${session.id}`)).json();
  assert.equal(detail.answers.length, 14);
  assert.equal(detail.answers.find((a) => a.questionId === 'c2').otherText, '좋았어요');
});

test('첫 시안 설문이 덜 끝났으면 시안 전환 409', async () => {
  const s = (await (await post('/api/sessions', { studyId: study.id, name: 'early' })).json()).session;
  assert.equal((await post(`/api/sessions/${s.id}/surveys`, { variant: s.currentVariant, answers: [...defaults, ...customs] })).status, 200);
  const other = s.order[1];
  assert.equal((await patch(`/api/sessions/${s.id}`, { currentVariant: other })).status, 200);
  const done = await patch(`/api/sessions/${s.id}`, { elapsedA: 15, elapsedB: 15, preference: 'A', status: 'completed' });
  assert.equal(done.status, 409, '둘째 시안 설문 없이 완료 불가');
});

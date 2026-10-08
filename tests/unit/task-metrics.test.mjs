import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTaskMetrics } from '../../src/lib/task-metrics.ts';

const task = (id, instruction = id) => ({
  id,
  instruction,
  timeLimitSeconds: 120,
  criteria: { A: { text: 'x' }, B: { text: 'y' } },
});
const at = (o) => ({
  sessionId: 's1',
  taskId: 't1',
  variant: 'A',
  outcome: 'success',
  durationMs: 1000,
  clickCount: 1,
  verified: true,
  ...o,
});
const ev = (o) => ({
  sessionId: 's1',
  variant: 'A',
  elapsedMs: 0,
  component: 'c',
  tag: 'div',
  text: '',
  selector: '',
  x: 0,
  y: 0,
  viewportWidth: 1,
  viewportHeight: 1,
  kind: 'interactive',
  phase: 'task:t1',
  ...o,
});

test('시도가 없어도 과업 x 시안(A,B)마다 한 줄, 0/null', () => {
  const m = computeTaskMetrics([task('t1'), task('t2')], [], []);
  assert.deepEqual(
    m.map((x) => [x.taskId, x.variant]),
    [
      ['t1', 'A'],
      ['t1', 'B'],
      ['t2', 'A'],
      ['t2', 'B'],
    ],
  );
  const x = m[0];
  assert.equal(x.instruction, 't1');
  assert.deepEqual(
    [x.attempts, x.successes, x.unverified, x.timeouts, x.gaveUp, x.successRate, x.avgStaticClicks],
    [0, 0, 0, 0, 0, 0, 0],
  );
  assert.equal(x.medianMs, null);
  assert.equal(x.meanMs, null);
  assert.equal(x.firstClickRate, null);
  assert.deepEqual(x.failureScreens, []);
});

test('성공은 success && verified 만, 검증 안 된 성공은 따로', () => {
  const [a] = computeTaskMetrics(
    [task('t1')],
    [
      at({}),
      at({ sessionId: 's2', verified: false }),
      at({ sessionId: 's3', verified: undefined }),
      at({ sessionId: 's4', outcome: 'timeout' }),
      at({ sessionId: 's5', outcome: 'gave_up' }),
    ],
    [],
  );
  assert.equal(a.attempts, 5);
  assert.equal(a.successes, 1);
  assert.equal(a.unverified, 2);
  assert.equal(a.timeouts, 1);
  assert.equal(a.gaveUp, 1);
  assert.equal(a.successRate, 0.2);
});

test('소요 시간은 검증된 성공만: 평균·중앙값(짝수는 가운데 두 값 평균)', () => {
  const [a] = computeTaskMetrics(
    [task('t1')],
    [
      at({ durationMs: 1000 }),
      at({ sessionId: 's2', durationMs: 4000 }),
      at({ sessionId: 's3', durationMs: 9000 }),
      at({ sessionId: 's4', durationMs: 7000 }),
      at({ sessionId: 's5', durationMs: 99999, verified: false }),
      at({ sessionId: 's6', durationMs: 5, outcome: 'timeout' }),
    ],
    [],
  );
  assert.equal(a.meanMs, 5250);
  assert.equal(a.medianMs, 5500);
  const [b] = computeTaskMetrics(
    [task('t1')],
    [at({ durationMs: 3000 }), at({ sessionId: 's2', durationMs: 1000 }), at({ sessionId: 's3', durationMs: 2000 })],
    [],
  );
  assert.equal(b.medianMs, 2000);
});

test('첫 클릭 정확도: 정의된 시도 중 true 비율, 없으면 null', () => {
  const [a] = computeTaskMetrics(
    [task('t1')],
    [
      at({ firstClickCorrect: true }),
      at({ sessionId: 's2', firstClickCorrect: false }),
      at({ sessionId: 's3', firstClickCorrect: true }),
      at({ sessionId: 's4' }),
    ],
    [],
  );
  assert.ok(Math.abs(a.firstClickRate - 2 / 3) < 1e-9);
  const [b] = computeTaskMetrics([task('t1')], [at({})], []);
  assert.equal(b.firstClickRate, null);
});

test('평균 헛클릭: 같은 과업·시안·세션의 static 클릭 / 시도 수', () => {
  const events = [
    ev({ kind: 'static' }),
    ev({ kind: 'static' }),
    ev({ kind: 'interactive' }),
    ev({ sessionId: 's2', kind: 'static' }),
    ev({ phase: 'free', kind: 'static' }),
    ev({ phase: 'task:t2', kind: 'static' }),
    ev({ variant: 'B', kind: 'static' }),
    ev({ sessionId: 's9', kind: 'static' }),
  ];
  const m = computeTaskMetrics([task('t1')], [at({}), at({ sessionId: 's2' })], events);
  assert.equal(m[0].avgStaticClicks, 1.5); // s1:2 + s2:1 / 2 시도, s9 는 시도 없음
  assert.equal(m[1].avgStaticClicks, 0);
});

test('실패 화면: timeout/gave_up 의 lastScreenId 집계, 많은 순', () => {
  const [a] = computeTaskMetrics(
    [task('t1')],
    [
      at({ outcome: 'timeout', lastScreenId: 'x' }),
      at({ sessionId: 's2', outcome: 'gave_up', lastScreenId: 'y' }),
      at({ sessionId: 's3', outcome: 'timeout', lastScreenId: 'y' }),
      at({ sessionId: 's4', outcome: 'timeout' }),
      at({ sessionId: 's5', lastScreenId: 'z' }),
    ],
    [],
  );
  assert.deepEqual(a.failureScreens, [
    { screenId: 'y', count: 2 },
    { screenId: 'x', count: 1 },
  ]);
});

test('알 수 없는 과업 id 의 시도는 무시, 시안별로 분리', () => {
  const m = computeTaskMetrics([task('t1')], [at({ taskId: 'zz' }), at({ variant: 'B', outcome: 'timeout' })], []);
  assert.deepEqual(
    m.map((x) => x.attempts),
    [0, 1],
  );
});

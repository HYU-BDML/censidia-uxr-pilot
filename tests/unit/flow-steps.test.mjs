import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFlowLanes } from '../../src/lib/flow-steps.ts';

const ev = (o) => ({ sessionId: 's1', variant: 'A', elapsedMs: 0, component: 'c', tag: 'button', text: '', selector: '', x: 0, y: 0, viewportWidth: 1280, viewportHeight: 720, kind: 'interactive', componentPath: 'p', ...o });

test('빈 입력은 빈 배열', () => assert.deepEqual(buildFlowLanes([]), []));

test('참여자 x 버전별로 레인을 나눈다', () => {
  const lanes = buildFlowLanes([ev({ screenId: 'x' }), ev({ variant: 'B', screenId: 'x' }), ev({ sessionId: 's2', screenId: 'x' })]);
  assert.deepEqual(lanes.map((l) => [l.sessionId, l.variant]), [['s1', 'A'], ['s1', 'B'], ['s2', 'A']]);
});

test('연속된 같은 screenId 는 한 단계로 합친다', () => {
  const [lane] = buildFlowLanes([ev({ screenId: 'x', elapsedMs: 1000, component: 'a' }), ev({ screenId: 'x', elapsedMs: 3000, component: 'b', kind: 'static' })]);
  assert.equal(lane.steps.length, 1);
  assert.equal(lane.steps[0].startMs, 1000);
  assert.equal(lane.steps[0].endMs, 3000);
  assert.deepEqual(lane.steps[0].clicks.map((c) => [c.label, c.kind, c.elapsedMs]), [['a', 'interactive', 1000], ['b', 'static', 3000]]);
});

test('A -> B -> A 로 돌아오면 3단계', () => {
  const [lane] = buildFlowLanes([ev({ screenId: 'a', elapsedMs: 1 }), ev({ screenId: 'b', elapsedMs: 2 }), ev({ screenId: 'a', elapsedMs: 3 })]);
  assert.deepEqual(lane.steps.map((s) => s.screenId), ['a', 'b', 'a']);
});

test('screenId 없는 클릭도 연속이면 한 단계(screenId null)', () => {
  const [lane] = buildFlowLanes([ev({ elapsedMs: 1 }), ev({ elapsedMs: 2 }), ev({ screenId: 'a', elapsedMs: 3 }), ev({ elapsedMs: 4 })]);
  assert.deepEqual(lane.steps.map((s) => [s.screenId, s.clicks.length]), [[null, 2], ['a', 1], [null, 1]]);
});

test('입력 순서와 무관하게 elapsedMs 로 정렬한다(동률은 입력 순서 유지)', () => {
  const [lane] = buildFlowLanes([ev({ screenId: 'b', elapsedMs: 5000, component: 'late' }), ev({ screenId: 'a', elapsedMs: 100, component: 'first' }), ev({ screenId: 'a', elapsedMs: 100, component: 'second' })]);
  assert.deepEqual(lane.steps.map((s) => s.screenId), ['a', 'b']);
  assert.deepEqual(lane.steps[0].clicks.map((c) => c.label), ['first', 'second']);
});

test('레인 순서: 세션 첫 등장 순, 같은 세션은 A 먼저', () => {
  const lanes = buildFlowLanes([ev({ sessionId: 's2', variant: 'B' }), ev({ sessionId: 's1' }), ev({ sessionId: 's2', variant: 'A' })]);
  assert.deepEqual(lanes.map((l) => [l.sessionId, l.variant]), [['s2', 'A'], ['s2', 'B'], ['s1', 'A']]);
});

test('옵션 없으면 phase 와 무관하게 전부 포함하고 taskId 는 없다(기존 동작)', () => {
  const lanes = buildFlowLanes([ev({ phase: 'free', screenId: 'a' }), ev({ phase: 'task:t1', screenId: 'b' }), ev({ screenId: 'c' })]);
  assert.equal(lanes.length, 1);
  assert.equal(lanes[0].taskId, undefined);
  assert.equal(lanes[0].steps.length, 3);
});

test('taskIds 옵션: 과업 구간만, 참여자 x 과업 x 버전 레인(과업 순서), 자유 탐색 제외', () => {
  const lanes = buildFlowLanes([
    ev({ phase: 'free', screenId: 'f', elapsedMs: 1 }), ev({ screenId: 'nophase', phase: undefined, elapsedMs: 2 }),
    ev({ phase: 'task:t2', screenId: 'x', elapsedMs: 10 }), ev({ phase: 'task:t1', screenId: 'y', elapsedMs: 20 }), ev({ phase: 'task:t1', screenId: 'y', elapsedMs: 30 }),
    ev({ phase: 'task:t1', variant: 'B', screenId: 'z', elapsedMs: 5 }), ev({ phase: 'task:t9', screenId: 'q' }),
  ], { taskIds: ['t1', 't2'] });
  assert.deepEqual(lanes.map((l) => [l.sessionId, l.taskId, l.variant, l.steps.length]), [['s1', 't1', 'A', 1], ['s1', 't1', 'B', 1], ['s1', 't2', 'A', 1]]);
  assert.equal(lanes[0].steps[0].clicks.length, 2);
});

test('taskIds 옵션이 빈 배열이면 빈 결과', () => assert.deepEqual(buildFlowLanes([ev({ phase: 'task:t1' })], { taskIds: [] }), []));

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

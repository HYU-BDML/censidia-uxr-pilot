import test from 'node:test';
import assert from 'node:assert/strict';
import { resultsCsvRows } from '../../src/lib/results-csv.ts';

const data = {
  study: {}, sessions: [{ id: 's1', name: '민수', elapsedA: 1, elapsedB: 2, status: 'completed', preferenceReason: '' }],
  events: [{ sessionId: 's1', variant: 'A', elapsedMs: 1500, component: 'btn', text: 't', selector: 'b', phase: 'task:t1', x: 1, y: 2, viewportWidth: 10, viewportHeight: 20 }],
  answers: [], interviewTurns: [], recordings: [],
  comments: [{ sessionId: 's1', variant: 'B', elapsedMs: 250, label: 'lbl', text: '의견', phase: 'free' }],
  taskAttempts: [{ sessionId: 's1', taskId: 't1', variant: 'A', outcome: 'success', matchedBy: 'component', durationMs: 4321, clickCount: 3, firstClickCorrect: true, verified: true, lastScreenId: 'L', evidenceScreenId: 'E' }],
};

test('click·comment 상세 JSON 에 phase 가 들어간다', () => {
  const rows = resultsCsvRows(data, 'http://x', (q) => q);
  assert.equal(JSON.parse(rows.find((r) => r[0] === 'click')[7]).phase, 'task:t1');
  assert.equal(JSON.parse(rows.find((r) => r[0] === 'comment')[7]).phase, 'free');
});

test('taskAttempt 행: 초 단위 소요 시간·과업 id·결과·상세 JSON', () => {
  const row = resultsCsvRows(data, 'http://x', (q) => q).find((r) => r[0] === 'taskAttempt');
  assert.deepEqual(row.slice(0, 7), ['taskAttempt', 's1', '민수', 'A', '4.321', 't1', 'success']);
  assert.deepEqual(JSON.parse(row[7]), { matchedBy: 'component', verified: true, clickCount: 3, firstClickCorrect: true, lastScreenId: 'L', evidenceScreenId: 'E' });
});

test('taskAttempts 가 없는 옛 데이터도 깨지지 않는다', () => {
  const rows = resultsCsvRows({ ...data, taskAttempts: undefined, comments: undefined }, '', (q) => q);
  assert.equal(rows.filter((r) => r[0] === 'taskAttempt').length, 0);
});

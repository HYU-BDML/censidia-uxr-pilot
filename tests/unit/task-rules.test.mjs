import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTasks, matchTask, htmlToText, verifyAttempt, TASK_LIMITS } from '../../src/lib/task-rules.ts';

const crit = (o = {}) => ({ A: { text: '완료' }, B: { text: '완료' }, ...o });

test('parseTasks: 빈 입력은 과업 없음', () => {
  assert.deepEqual(parseTasks(undefined), []);
  assert.deepEqual(parseTasks(''), []);
  assert.deepEqual(parseTasks([]), []);
});

test('parseTasks: id 를 t1..tN 으로 다시 붙이고 값을 다듬는다', () => {
  const tasks = parseTasks([
    { id: 'zzz', instruction: '  결제하기  ', criteria: { A: { componentPath: 'body>button:nth-of-type(1)', componentLabel: ' 결제 ' }, B: { text: ' 주문 완료 ' } } },
    { instruction: '둘', timeLimitSeconds: 30, criteria: crit() },
  ]);
  assert.equal(tasks[0].id, 't1');
  assert.equal(tasks[1].id, 't2');
  assert.equal(tasks[0].instruction, '결제하기');
  assert.equal(tasks[0].timeLimitSeconds, TASK_LIMITS.timeDefault);
  assert.deepEqual(tasks[0].criteria.A, { componentPath: 'body>button:nth-of-type(1)', componentLabel: '결제' });
  assert.deepEqual(tasks[0].criteria.B, { text: '주문 완료' });
  assert.equal(tasks[1].timeLimitSeconds, 30);
});

test('parseTasks: 한도와 필수 기준을 지킨다', () => {
  assert.throws(() => parseTasks('x'), /형식/);
  assert.throws(() => parseTasks(Array.from({ length: 6 }, () => ({ instruction: 'a', criteria: crit() }))), /최대 5개/);
  assert.throws(() => parseTasks([{ instruction: ' ', criteria: crit() }]), /지시문/);
  assert.throws(() => parseTasks([{ instruction: 'a'.repeat(301), criteria: crit() }]), /지시문/);
  assert.throws(() => parseTasks([{ instruction: 'a', timeLimitSeconds: 14, criteria: crit() }]), /제한 시간/);
  assert.throws(() => parseTasks([{ instruction: 'a', timeLimitSeconds: 601, criteria: crit() }]), /제한 시간/);
  assert.throws(() => parseTasks([{ instruction: 'a', criteria: { A: { text: '완료' }, B: {} } }]), /버전 B에 완료 기준/);
  assert.throws(() => parseTasks([{ instruction: 'a', criteria: { A: { text: 'x'.repeat(201) }, B: { text: 'y' } } }]), /목표 문구/);
});

test('matchTask: 경로가 같으면 컴포넌트 성공', () => {
  assert.equal(matchTask({ componentPath: 'body>a:nth-of-type(1)' }, { componentPath: 'body>a:nth-of-type(1)' }), 'component');
  assert.equal(matchTask({ componentPath: 'body>a:nth-of-type(1)' }, { componentPath: 'body>a:nth-of-type(2)' }), null);
});

test('matchTask: 경로가 달라도 라벨이 같으면(공백·대소문자 무시) 성공', () => {
  assert.equal(matchTask({ componentPath: 'p1', componentLabel: 'Pay Now' }, { componentPath: 'p2', label: ' paynow ' }), 'component');
  assert.equal(matchTask({ componentPath: 'p1', componentLabel: '' }, { componentPath: 'p2', label: '' }), null);
});

test('matchTask: 문구는 공백 무시 포함 여부', () => {
  assert.equal(matchTask({ text: '주문이 완료되었습니다' }, { pageText: '안내\n주문이  완료 되었습니다!' }), 'text');
  assert.equal(matchTask({ text: '주문 완료' }, { pageText: '주문 취소' }), null);
  assert.equal(matchTask(null, { pageText: 'x' }), null);
});

test('matchTask 는 toString() 으로 직렬화해도 같은 결과', () => {
  const revived = new Function(`return (${matchTask.toString()})`)();
  const cases = [
    [{ componentPath: 'a', componentLabel: 'Go' }, { componentPath: 'b', label: 'go' }],
    [{ text: '완료' }, { pageText: '완 료' }],
    [{ componentPath: 'a' }, { componentPath: 'c' }],
  ];
  for (const [c, h] of cases) assert.equal(revived(c, h), matchTask(c, h));
});

test('htmlToText: 태그·스크립트·스타일 제거', () => {
  const t = htmlToText('<style>.x{}</style><p>주문&nbsp;<b>완료</b></p><script>alert("완료")</script>');
  assert.match(t.replace(/\s+/g, ' '), /주문 완료/);
  assert.ok(!t.includes('alert'));
});

test('verifyAttempt: 성공 주장만 근거로 다시 확인한다', () => {
  const task = parseTasks([{ instruction: 'a', criteria: { A: { componentPath: 'body>button:nth-of-type(1)', componentLabel: '결제' }, B: { text: '주문 완료' } } }])[0];
  assert.equal(verifyAttempt(task, 'A', { outcome: 'timeout' }, []), true);
  assert.equal(verifyAttempt(task, 'A', { outcome: 'success', matchedBy: 'component' }, [{ componentPath: 'body>button:nth-of-type(1)' }]), true);
  assert.equal(verifyAttempt(task, 'A', { outcome: 'success', matchedBy: 'component' }, [{ componentPath: 'x', component: '취소' }]), false);
  assert.equal(verifyAttempt(task, 'B', { outcome: 'success', matchedBy: 'text' }, [], '<div>주문 완료</div>'), true);
  assert.equal(verifyAttempt(task, 'B', { outcome: 'success', matchedBy: 'text' }, [], '<div>장바구니</div>'), false);
  assert.equal(verifyAttempt(task, 'B', { outcome: 'success', matchedBy: 'text' }, [], null), false);
  assert.equal(verifyAttempt(task, 'B', { outcome: 'success' }, []), false);
});

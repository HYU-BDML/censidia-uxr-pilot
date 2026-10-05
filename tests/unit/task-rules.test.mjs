import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTasks, matchTask, htmlToText, verifyAttempt, readState, stateMatches, TASK_LIMITS } from '../../src/lib/task-rules.ts';

const st = (o = {}) => ({ anchor: '[data-project-id="PRJ-101"]', path: 'span:nth-of-type(1)', property: 'text', expected: '주의', match: 'equals', ...o });
const crit = (o = {}) => ({ A: { state: st() }, B: { state: st() }, ...o });

test('parseTasks: 빈 입력은 과업 없음', () => {
  assert.deepEqual(parseTasks(undefined), []);
  assert.deepEqual(parseTasks(''), []);
  assert.deepEqual(parseTasks([]), []);
});

test('parseTasks: id 를 t1..tN 으로 다시 붙이고 값을 다듬는다', () => {
  const tasks = parseTasks([
    { id: 'zzz', instruction: '  결제하기  ', criteria: { A: { componentPath: 'body>button:nth-of-type(1)', componentLabel: ' 결제 ' }, B: { state: { path: '', property: 'value', expected: ' 주의 ', label: ' Orbit · 상태 ' } } } },
    { instruction: '둘', timeLimitSeconds: 30, criteria: crit() },
  ]);
  assert.equal(tasks[0].id, 't1');
  assert.equal(tasks[1].id, 't2');
  assert.equal(tasks[0].instruction, '결제하기');
  assert.equal(tasks[0].timeLimitSeconds, TASK_LIMITS.timeDefault);
  assert.deepEqual(tasks[0].criteria.A, { componentPath: 'body>button:nth-of-type(1)', componentLabel: '결제' });
  assert.deepEqual(tasks[0].criteria.B, { state: { path: '', property: 'value', expected: '주의', match: 'equals', label: 'Orbit · 상태' } });
  assert.equal(tasks[1].timeLimitSeconds, 30);
});

test('parseTasks: 한도와 필수 기준을 지킨다', () => {
  assert.throws(() => parseTasks('x'), /형식/);
  assert.throws(() => parseTasks(Array.from({ length: 6 }, () => ({ instruction: 'a', criteria: crit() }))), /최대 5개/);
  assert.throws(() => parseTasks([{ instruction: ' ', criteria: crit() }]), /지시문/);
  assert.throws(() => parseTasks([{ instruction: 'a'.repeat(301), criteria: crit() }]), /지시문/);
  assert.throws(() => parseTasks([{ instruction: 'a', timeLimitSeconds: 14, criteria: crit() }]), /제한 시간/);
  assert.throws(() => parseTasks([{ instruction: 'a', timeLimitSeconds: 601, criteria: crit() }]), /제한 시간/);
  assert.throws(() => parseTasks([{ instruction: 'a', criteria: { A: { state: st() }, B: {} } }]), /버전 B에 완료 기준/);
});

test('parseTasks: 목표 상태를 검증한다', () => {
  const bad = (state) => parseTasks([{ instruction: 'a', criteria: { A: { state }, B: { state: st() } } }]);
  assert.throws(() => bad(st({ expected: 'x'.repeat(201) })), /목표 상태/);
  assert.throws(() => bad(st({ expected: '  ' })), /목표 상태/);
  assert.throws(() => bad(st({ anchor: 'a'.repeat(301) })), /목표 상태/);
  assert.throws(() => bad(st({ path: 'a'.repeat(1001) })), /목표 상태/);
  assert.throws(() => bad(st({ property: 'html' })), /목표 상태/);
  assert.throws(() => bad(st({ property: 'attr' })), /목표 상태/);
  assert.throws(() => bad(st({ property: 'attr', attr: '1bad' })), /목표 상태/);
  assert.throws(() => bad(st({ match: 'regex' })), /목표 상태/);
  assert.throws(() => bad('x'), /목표 상태/);
  assert.throws(() => parseTasks([{ instruction: 'a', criteria: { A: { text: '완료' }, B: { state: st() } } }]), /버전 A에 완료 기준/);
  const ok = bad(st({ property: 'attr', attr: 'data-status', match: undefined, anchor: undefined }));
  assert.deepEqual(ok[0].criteria.A.state, { path: 'span:nth-of-type(1)', property: 'attr', attr: 'data-status', expected: '주의', match: 'equals' });
  assert.equal(bad(st({ label: 'l'.repeat(150) }))[0].criteria.A.state.label.length, 100);
});

test('matchTask: 경로가 같으면 컴포넌트 성공', () => {
  assert.equal(matchTask({ componentPath: 'body>a:nth-of-type(1)' }, { componentPath: 'body>a:nth-of-type(1)' }), 'component');
  assert.equal(matchTask({ componentPath: 'body>a:nth-of-type(1)' }, { componentPath: 'body>a:nth-of-type(2)' }), null);
});

test('matchTask: 경로가 달라도 라벨이 같으면(공백·대소문자 무시) 성공', () => {
  assert.equal(matchTask({ componentPath: 'p1', componentLabel: 'Pay Now' }, { componentPath: 'p2', label: ' paynow ' }), 'component');
  assert.equal(matchTask({ componentPath: 'p1', componentLabel: '' }, { componentPath: 'p2', label: '' }), null);
});

test('matchTask: 상태 기준만 있으면 null, 기준 없음도 null', () => {
  assert.equal(matchTask({ state: st() }, { componentPath: 'x', label: '주의' }), null);
  assert.equal(matchTask(null, { componentPath: 'x' }), null);
});

test('matchTask 는 toString() 으로 직렬화해도 같은 결과', () => {
  const revived = new Function(`return (${matchTask.toString()})`)();
  const cases = [
    [{ componentPath: 'a', componentLabel: 'Go' }, { componentPath: 'b', label: 'go' }],
    [{ componentPath: 'a' }, { componentPath: 'c' }],
  ];
  for (const [c, h] of cases) assert.equal(revived(c, h), matchTask(c, h));
});

test('htmlToText: 태그·스크립트·스타일 제거', () => {
  const t = htmlToText('<style>.x{}</style><p>주문&nbsp;<b>완료</b></p><script>alert("완료")</script>');
  assert.match(t.replace(/\s+/g, ' '), /주문 완료/);
  assert.ok(!t.includes('alert'));
});

test('stateMatches: 공백 제거·소문자 후 equals / contains, null 은 실패', () => {
  assert.equal(stateMatches(st({ expected: '주의' }), ' 주 의\n'), true);
  assert.equal(stateMatches(st({ expected: 'Warning' }), 'warning'), true);
  assert.equal(stateMatches(st({ expected: '주의' }), '주의 필요'), false);
  assert.equal(stateMatches(st({ expected: '주의', match: 'contains' }), '현재 주의 필요'), true);
  assert.equal(stateMatches(st(), null), false);
  assert.equal(stateMatches(st({ expected: '  ' }), ''), false);
});

const fakeEl = (props) => ({
  innerText: props.innerText,
  textContent: props.textContent,
  value: props.value,
  checked: props.checked,
  getAttribute: (n) => (props.attrs && n in props.attrs ? props.attrs[n] : null),
  hasAttribute: (n) => !!(props.attrs && n in props.attrs),
});

test('readState: text / value / checked / attr, 앵커 없으면 body, 없으면 null', () => {
  const badge = fakeEl({ innerText: '  주의 ', textContent: 'x' });
  const anchor = { ...fakeEl({}), querySelector: (sel) => (sel === ':scope > span:nth-of-type(1)' ? badge : null) };
  const doc = {
    body: { querySelector: (sel) => (sel === ':scope > select:nth-of-type(1)' ? fakeEl({ value: 'warning' }) : sel === ':scope > input:nth-of-type(1)' ? fakeEl({ checked: true }) : null) },
    querySelectorAll: (sel) => (sel === '[data-project-id="PRJ-101"]' ? [anchor] : []),
  };
  assert.equal(readState(st(), doc), '  주의 ');
  assert.equal(readState(st({ property: 'attr', attr: 'x' }), doc), null);
  assert.equal(readState(st({ anchor: undefined, path: 'select:nth-of-type(1)', property: 'value' }), doc), 'warning');
  assert.equal(readState(st({ anchor: undefined, path: 'input:nth-of-type(1)', property: 'checked' }), doc), 'true');
  assert.equal(readState(st({ path: 'em:nth-of-type(1)' }), doc), null);
  assert.equal(readState(st({ anchor: '[nope]' }), doc), null);
  const selfAnchor = fakeEl({ attrs: { 'data-status': 'warning' } });
  const doc2 = { body: {}, querySelectorAll: () => [selfAnchor] };
  assert.equal(readState(st({ path: '', property: 'attr', attr: 'data-status' }), doc2), 'warning');
  assert.equal(readState(st({ path: '', property: 'attr', attr: 'data-none' }), doc2), null);
  const throwing = { body: {}, querySelectorAll: () => { throw new Error('bad selector'); } };
  assert.equal(readState(st(), throwing), null);
});

test('readState / stateMatches 는 toString() 으로 직렬화해도 같은 결과', () => {
  const rs = new Function(`return (${readState.toString()})`)();
  const sm = new Function(`return (${stateMatches.toString()})`)();
  const doc = { body: {}, querySelectorAll: () => [{ ...fakeEl({ innerText: ' 주의 ' }), querySelector: () => fakeEl({ innerText: '주의' }) }] };
  assert.equal(rs(st(), doc), readState(st(), doc));
  assert.equal(sm(st(), '주 의'), stateMatches(st(), '주 의'));
});

const ANCHOR = '[data-project-id="PRJ-101"]';
const proofOf = (inner) => `<span data-field="status">${inner}</span>`;
const page = (proof, before = '<tr data-project-id="PRJ-101"><td>Orbit</td><td>') => `<!DOCTYPE html><html><body><table>${before}${proof}</td></tr></table></body></html>`;

test('verifyAttempt: 성공 주장만 근거로 다시 확인한다', () => {
  const task = parseTasks([{ instruction: 'a', criteria: { A: { componentPath: 'body>button:nth-of-type(1)', componentLabel: '결제' }, B: { state: st({ anchor: ANCHOR }) } } }])[0];
  assert.equal(verifyAttempt(task, 'A', { outcome: 'timeout' }, []), true);
  assert.equal(verifyAttempt(task, 'A', { outcome: 'success', matchedBy: 'component' }, [{ componentPath: 'body>button:nth-of-type(1)' }]), true);
  assert.equal(verifyAttempt(task, 'A', { outcome: 'success', matchedBy: 'component' }, [{ componentPath: 'x', component: '취소' }]), false);
  const proof = proofOf('주의');
  assert.equal(verifyAttempt(task, 'B', { outcome: 'success', matchedBy: 'state' }, [], page(proof), proof), true);
  assert.equal(verifyAttempt(task, 'B', { outcome: 'success' }, []), false);
  assert.equal(verifyAttempt(task, 'B', { outcome: 'success', matchedBy: 'text' }, [], page(proof), proof), false);
});

test('verifyAttempt(state): 근거 화면·증명·앵커·값이 모두 맞아야 한다', () => {
  const task = parseTasks([{ instruction: 'a', criteria: { A: { state: st({ anchor: ANCHOR }) }, B: { state: st({ anchor: undefined, property: 'value', expected: 'warning' }) } } }])[0];
  const a = (html, proof) => verifyAttempt(task, 'A', { outcome: 'success', matchedBy: 'state' }, [], html, proof);
  const proof = proofOf('주의');
  assert.equal(a(page(proof), proof), true);
  assert.equal(a(null, proof), false, '근거 화면 없음');
  assert.equal(a(page(proof), ''), false, '증명 없음');
  assert.equal(a(page(proof), undefined), false);
  assert.equal(a(page(proofOf('안정')), proof), false, '증명이 화면에 없음');
  const stable = proofOf('안정');
  assert.equal(a(page(stable), stable), false, '값 불일치');
  assert.equal(a(page(proof, '<tr data-project-id="PRJ-999"><td>x</td><td>'), proof), false, '다른 앵커');
  assert.equal(a(`<html><body>${proof}</body></html>`, proof), false, '앵커 없음');
  // 앵커 자신이 증명인 경우
  const self = '<tr data-project-id="PRJ-101" data-status="주의"><td>x</td></tr>';
  const t2 = parseTasks([{ instruction: 'a', criteria: { A: { state: st({ anchor: ANCHOR, path: '', property: 'attr', attr: 'data-status' }) }, B: { state: st() } } }])[0];
  assert.equal(verifyAttempt(t2, 'A', { outcome: 'success', matchedBy: 'state' }, [], `<html><body><table>${self}</table></body></html>`, self), true);
  // B: 앵커 없음, value 속성
  const input = '<input type="text" value="warning" name="s">';
  const b = (proofHtml, html) => verifyAttempt(task, 'B', { outcome: 'success', matchedBy: 'state' }, [], html, proofHtml);
  assert.equal(b(input, `<html><body>${input}</body></html>`), true);
  const other = '<input value="stable">';
  assert.equal(b(other, `<html><body>${other}</body></html>`), false);
});

test('verifyAttempt(state): select·checked·attr·contains 분기', () => {
  const mk = (state) => parseTasks([{ instruction: 'a', criteria: { A: { state }, B: { state } } }])[0];
  const run = (task, proof) => verifyAttempt(task, 'A', { outcome: 'success', matchedBy: 'state' }, [], `<html><body>${proof}</body></html>`, proof);
  const select = '<select id="s"><option value="stable">안정</option><option value="warning" selected>주의</option></select>';
  assert.equal(run(mk({ anchor: '#s', path: '', property: 'value', expected: 'warning', match: 'equals' }), select), true);
  assert.equal(run(mk({ anchor: '#s', path: '', property: 'value', expected: 'stable', match: 'equals' }), select), false);
  const cb = '<input id="n" type="checkbox" checked>';
  const off = '<input id="n" type="checkbox">';
  const checked = mk({ anchor: '#n', path: '', property: 'checked', expected: 'true', match: 'equals' });
  assert.equal(run(checked, cb), true);
  assert.equal(run(checked, off), false);
  assert.equal(run(mk({ anchor: '#n', path: '', property: 'checked', expected: 'false', match: 'equals' }), off), true);
  const badge = '<span id="b" data-tone="Warning" class="a">주의 필요</span>';
  assert.equal(run(mk({ anchor: '#b', path: '', property: 'attr', attr: 'data-tone', expected: 'warning', match: 'equals' }), badge), true);
  assert.equal(run(mk({ anchor: '#b', path: '', property: 'text', expected: '주의', match: 'contains' }), badge), true);
  assert.equal(run(mk({ anchor: '#b', path: '', property: 'text', expected: '주의', match: 'equals' }), badge), false);
  assert.equal(run(mk({ anchor: '#b', path: '', property: 'attr', attr: 'data-none', expected: 'x', match: 'contains' }), badge), false);
  const fake = '<span id="b"><script>주의</script>안정</span>';
  assert.equal(run(mk({ anchor: '#b', path: '', property: 'text', expected: '주의', match: 'contains' }), fake), false);
});

test('verifyAttempt(state): 같은 증명이 앵커 앞의 다른 행에도 있어도, 앵커 뒤에 있으면 통과', () => {
  const task = parseTasks([{ instruction: 'a', criteria: { A: { state: st({ anchor: ANCHOR }) }, B: { state: st() } } }])[0];
  const proof = proofOf('주의');
  const html = `<html><body><table><tr data-project-id="PRJ-102"><td>${proof}</td></tr><tr data-project-id="PRJ-101"><td>${proof}</td></tr></table></body></html>`;
  assert.equal(verifyAttempt(task, 'A', { outcome: 'success', matchedBy: 'state' }, [], html, proof), true);
  const onlyBefore = `<html><body><tr data-project-id="PRJ-102"><td>${proof}</td></tr><tr data-project-id="PRJ-101"><td>안정</td></tr></body></html>`;
  assert.equal(verifyAttempt(task, 'A', { outcome: 'success', matchedBy: 'state' }, [], onlyBefore, proof), false);
});

test('anchorIndex: 같은 선택자가 여러 요소와 맞을 때 고른 요소를 읽는다 / 검증', () => {
  const mkAnchor = (txt) => ({ ...fakeEl({}), querySelector: () => fakeEl({ innerText: txt }) });
  const doc = { body: {}, querySelectorAll: () => [mkAnchor('안정'), mkAnchor('주의')] };
  assert.equal(readState(st(), doc), '안정');
  assert.equal(readState(st({ anchorIndex: 0 }), doc), '안정');
  assert.equal(readState(st({ anchorIndex: 1 }), doc), '주의');
  assert.equal(readState(st({ anchorIndex: 5 }), doc), null);
  const bad = (v) => parseTasks([{ instruction: 'a', criteria: { A: { state: st({ anchorIndex: v }) }, B: { state: st() } } }]);
  assert.equal(bad(3)[0].criteria.A.state.anchorIndex, 3);
  assert.equal(bad(0)[0].criteria.A.state.anchorIndex, undefined);
  for (const v of [-1, 201, 1.5, '1']) assert.throws(() => bad(v), /목표 상태/);
});

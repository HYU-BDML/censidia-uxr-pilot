import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickComponent } from '../../src/lib/component-pick.ts';

const VP = 1000 * 800;
const item = (o = {}) => ({ interactive: false, explicit: false, area: 100, descendants: 0, ...o });

test('버튼 안 아이콘을 누르면 버튼이 컴포넌트다', () => {
  const chain = [item(), item({ interactive: true })];
  assert.deepEqual(pickComponent(chain, VP), { index: 1, kind: 'interactive' });
});

test('버튼이 하나뿐인 클릭 카드 안에서는 바깥 카드가 컴포넌트다', () => {
  const chain = [item({ interactive: true }), item({ interactive: true, descendants: 1, area: 20000 })];
  assert.deepEqual(pickComponent(chain, VP), { index: 1, kind: 'interactive' });
});

test('상호작용 요소를 2개 이상 품은 위임 컨테이너는 건너뛴다', () => {
  const chain = [item({ interactive: true }), item({ interactive: true, descendants: 3, area: 30000 })];
  assert.deepEqual(pickComponent(chain, VP), { index: 0, kind: 'interactive' });
});

test('뷰포트 60% 이상을 덮는 요소는 컴포넌트가 아니다', () => {
  const chain = [item({ interactive: true }), item({ interactive: true, area: VP * 0.6 })];
  assert.deepEqual(pickComponent(chain, VP), { index: 0, kind: 'interactive' });
});

test('큰 요소 하나만 상호작용이면 비상호작용 클릭으로 본다', () => {
  const chain = [item({ interactive: true, area: VP * 0.7 })];
  assert.deepEqual(pickComponent(chain, VP), { index: 0, kind: 'static' });
});

test('data-component 로 명시한 경계는 컨테이너 규칙과 무관하게 이긴다', () => {
  const chain = [item({ interactive: true }), item({ explicit: true, descendants: 5, area: VP * 0.8 })];
  assert.deepEqual(pickComponent(chain, VP), { index: 1, kind: 'interactive' });
});

test('상호작용 조상이 없으면 누른 요소 자체가 비상호작용 컴포넌트다', () => {
  assert.deepEqual(pickComponent([item(), item()], VP), { index: 0, kind: 'static' });
});

test('body 를 직접 누르면 index -1', () => {
  assert.deepEqual(pickComponent([], VP), { index: -1, kind: 'static' });
});

test('toString() 으로 직렬화해도 같은 결과를 낸다', () => {
  const revived = new Function(`return (${pickComponent.toString()})`)();
  const cases = [
    [[item(), item({ interactive: true })], VP],
    [[item({ interactive: true }), item({ interactive: true, descendants: 3 })], VP],
    [[item({ interactive: true, area: VP })], VP],
    [[], VP],
  ];
  for (const [chain, vp] of cases) assert.deepEqual(revived(chain, vp), pickComponent(chain, vp));
});

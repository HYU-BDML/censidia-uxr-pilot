import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupScreens } from '../../src/lib/heatmap-groups.ts';

const ev = (o) => ({
  variant: 'A',
  elapsedMs: 0,
  component: 'c',
  tag: 'button',
  text: '',
  selector: '',
  x: 0,
  y: 0,
  viewportWidth: 1280,
  viewportHeight: 720,
  kind: 'interactive',
  ...o,
});

test('화면별로 묶고 컴포넌트 경로별로 센다, 많은 순', () => {
  const { screens } = groupScreens([
    ev({ screenId: 's1', componentPath: 'body>a:nth-of-type(1)', component: '홈' }),
    ev({ screenId: 's1', componentPath: 'body>a:nth-of-type(1)', component: '홈' }),
    ev({ screenId: 's1', componentPath: 'body>p:nth-of-type(1)', component: '설명', kind: 'static' }),
    ev({ screenId: 's2', componentPath: 'body>button:nth-of-type(1)', variant: 'B' }),
  ]);
  assert.deepEqual(
    screens.map((s) => [s.id, s.count]),
    [
      ['s1', 3],
      ['s2', 1],
    ],
  );
  assert.deepEqual(screens[0].components, [
    { path: 'body>a:nth-of-type(1)', label: '홈', kind: 'interactive', count: 2 },
    { path: 'body>p:nth-of-type(1)', label: '설명', kind: 'static', count: 1 },
  ]);
  assert.equal(screens[1].variant, 'B');
});

test('스냅샷이 없는 클릭은 따로 센다', () => {
  const r = groupScreens([ev({}), ev({ screenId: 's1' }), ev({ screenId: 's1', componentPath: 'body' })]);
  assert.equal(r.unsnapshotted, 2);
  assert.equal(r.screens.length, 1);
});

test('화면 크기는 가장 많이 쓰인 너비와 그 높이', () => {
  const { screens } = groupScreens([
    ev({ screenId: 's1', componentPath: 'body', viewportWidth: 390, viewportHeight: 844 }),
    ev({ screenId: 's1', componentPath: 'body', viewportWidth: 1280, viewportHeight: 720 }),
    ev({ screenId: 's1', componentPath: 'body', viewportWidth: 1280, viewportHeight: 700 }),
  ]);
  assert.equal(screens[0].viewportWidth, 1280);
  assert.equal(screens[0].viewportHeight, 720);
});

test('kind 가 없던 이벤트는 interactive 로 본다', () => {
  const { screens } = groupScreens([ev({ screenId: 's1', componentPath: 'body', kind: undefined })]);
  assert.equal(screens[0].components[0].kind, 'interactive');
});

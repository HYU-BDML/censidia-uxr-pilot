import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareSnapshot, PROTOTYPE_CSP } from '../../src/lib/snapshot.ts';

const html = `<!DOCTYPE html><html><head><title>t</title><script>document.body.innerHTML=''</script></head>
<body><button onclick="go()" class="b" ONMOUSEOVER='x()'>저장</button><dialog open id="d"><button>확인</button></dialog>
<script type="module" src="app.js"></script></body></html>`;

test('시안 스크립트와 on* 속성을 제거한다', () => {
  const out = prepareSnapshot(html);
  assert.ok(!out.includes("innerHTML=''"));
  assert.ok(!out.includes('app.js'));
  assert.ok(!/onclick|onmouseover/i.test(out.replace(/<script data-mindlens-overlay>[\s\S]*?<\/script>/, '')));
  assert.ok(out.includes('class="b"'), '다른 속성은 유지');
  assert.ok(out.includes('<dialog open id="d">'), '열린 다이얼로그 상태는 유지');
});

test('오버레이 스크립트는 body 끝에 하나, CSP 는 head 뒤에', () => {
  const out = prepareSnapshot(html);
  assert.equal(out.match(/<script data-mindlens-overlay>/g)?.length, 1);
  assert.ok(out.indexOf('<script data-mindlens-overlay>') < out.indexOf('</body>'));
  assert.ok(out.indexOf(PROTOTYPE_CSP) > out.indexOf('<head>'));
  assert.ok(out.indexOf(PROTOTYPE_CSP) < out.indexOf('<title>'));
});

test('head·body 가 없는 조각에도 동작한다', () => {
  const out = prepareSnapshot('<button>a</button>');
  assert.ok(out.includes(PROTOTYPE_CSP));
  assert.ok(out.includes('<script data-mindlens-overlay>'));
  assert.ok(out.includes('<button>a</button>'));
});

test('오버레이 스크립트는 문법적으로 유효한 JS 다', () => {
  const out = prepareSnapshot('<p></p>');
  const src = out.match(/<script data-mindlens-overlay>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new Function(src));
});

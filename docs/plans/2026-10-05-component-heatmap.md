# 컴포넌트 기준 클릭 히트맵 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 참가자가 HTML 시안에서 누른 클릭을 "클릭 순간의 화면 스냅샷 + 컴포넌트 경로"로 저장하고, 결과 화면에서 그 스냅샷 위에 컴포넌트별 클릭 수를 상자로 그린다.

**Architecture:** 시안 iframe 에 주입한 스크립트가 클릭마다 컴포넌트(가장 바깥쪽 상호작용 요소)를 고르고 DOM 스냅샷과 경로를 부모에 보낸다. 부모는 공용 해시로 화면 ID 를 만들어 화면은 `screens` 테이블에 한 번만, 클릭은 `events` 에 `screenId`·`componentPath`·`kind` 와 함께 저장한다. 결과 화면은 필터된 이벤트를 화면별로 묶고, 스냅샷을 격리 iframe 에 띄운 뒤 오버레이 스크립트에 경로·횟수를 보내 상자를 그리게 한다.

**Tech Stack:** Next.js 16.3 App Router · React 19 · TypeScript 5.9 · Node 22.13+ 내장 `node:sqlite` · 테스트는 `node --test` + `.mjs`(Node 타입 스트리핑으로 `.ts` 직접 import)

**설계 문서:** `docs/specs/2026-10-05-component-heatmap-design.md` — 각 태스크 전에 해당 절을 읽는다.

## Global Constraints

- Node.js `>=22.13.0` (`node:sqlite` 필요). 새 npm 의존성을 추가하지 않는다.
- 이 Next.js 는 학습 데이터와 다르다(`AGENTS.md`). 라우트 핸들러를 새로 만들 땐 `node_modules/next/dist/docs/` 의 route handler 문서를 먼저 읽고, 기존 `src/app/api/**/route.ts` 와 같은 형태(`export const runtime='nodejs'; export const dynamic='force-dynamic';` + `api(handler)`)를 따른다.
- `toString()` 으로 iframe 에 직렬화되는 함수(`pickComponent`·`clickTracker`·`heatmapOverlay`)는 **함수 밖의 값을 참조하지 않는다.** import 한 상수·헬퍼도 쓰지 않는다. 스프레드(`...`)·클래스·`async`·제너레이터를 쓰지 않는다(번들러가 외부 헬퍼를 끌어온다).
- Node 테스트에서 import 하는 모듈(`component-pick.ts`·`screen-hash.ts`·`snapshot.ts`·`heatmap-groups.ts`·`types.ts`)은 **값 import 를 하지 않는다**(Node ESM 은 확장자 없는 상대 import 를 못 푼다). `import type` 은 허용(타입 스트리핑이 지운다).
- 화면 ID: `${studyId}_${variant}_${hash}`. 해시: 28자리 소문자 16진수. 스냅샷 최대 `2_000_000` 자.
- 히트맵 색: 상호작용 `#00A4DF`(rgb `0,164,223`), 비상호작용 `#F18134`(rgb `241,129,52`).
- UI 문구는 한국어. 결과 화면 스타일은 `workspace.module.css` 의 기존 클래스(`panel`·`hint`·`table`·`tableWrap`·`badge`·`empty`)를 재사용한다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 을 붙인다.

## File Structure

| 파일 | 상태 | 책임 |
|---|---|---|
| `package.json` | 수정 | `test`·`test:integration` 스크립트 |
| `tests/unit/participant-session.test.mjs` | 이동 | 기존 테스트(위치만 이동) |
| `src/lib/component-pick.ts` | 생성 | 조상 목록에서 컴포넌트를 고르는 순수 함수 |
| `src/lib/screen-hash.ts` | 생성 | 화면 해시·ID·상한 (클라이언트·서버 공용) |
| `src/lib/snapshot.ts` | 생성 | 시안 CSP 상수, 스냅샷 표시용 HTML 준비, 히트맵 오버레이 스크립트 |
| `src/lib/instrument.ts` | 생성 | 참가자 iframe 주입 스크립트(클릭 추적·스냅샷). `participant-runner.tsx` 에서 이동 |
| `src/lib/heatmap-groups.ts` | 생성 | 이벤트 → 화면·컴포넌트 집계 순수 함수 |
| `src/lib/types.ts` | 수정 | `ClickEvent` 에 `screenId`·`componentPath`·`kind` |
| `src/lib/db.ts` | 수정 | `screens` 테이블, `saveScreen`·`screenExists`·`getScreenHtml` |
| `src/lib/server.ts` | 수정 | `screensPost`·`screenGet`, 이벤트 `screenId` 검증, `body()` 상한 인자 |
| `src/app/api/sessions/[id]/screens/route.ts` | 생성 | `POST` 화면 저장 |
| `src/app/api/screens/[id]/route.ts` | 생성 | `GET` 스냅샷 표시용 HTML |
| `src/components/participant-runner.tsx` | 수정 | 새 `instrument` 사용, 화면 대기열, 화면→이벤트 전송 순서 |
| `src/components/component-heatmap.tsx` | 생성 | 결과 히트맵 UI |
| `src/components/study-results.tsx` | 수정 | 좌표 점 분포를 히트맵으로 교체, CSV 필드 |
| `tests/unit/*.test.mjs` | 생성 | 순수 함수 단위 테스트 |
| `tests/integration/screens-api.test.mjs` | 생성 | 실행 중 서버 대상 API 테스트 |
| `README.md` | 수정 | 구현 범위·검증 방법 |

---

### Task 1: 테스트 실행 기반 정리

**Files:**
- Modify: `package.json`
- Move: `tests/participant-session.test.mjs` → `tests/unit/participant-session.test.mjs`

**Interfaces:**
- Produces: `npm test` (단위), `npm run test:integration` (서버 필요, `BASE_URL` 환경변수)

- [ ] **Step 1: 의존성 설치와 기준 빌드 확인**

Run: `npm install`
Expected: 오류 없이 종료, `node_modules/next` 생성

Run: `npm run typecheck`
Expected: 오류 0건. 오류가 있으면 이 계획과 무관한 기존 문제이므로 내용을 기록만 하고 진행한다.

- [ ] **Step 2: 기존 테스트 이동**

```bash
mkdir -p tests/unit tests/integration
git mv tests/participant-session.test.mjs tests/unit/participant-session.test.mjs
```

이동한 파일의 import 경로를 한 단계 위로 고친다:

```js
import { participantSessionKey, canResumeParticipant } from '../../src/lib/participant-session.ts';
```

- [ ] **Step 3: 스크립트 추가**

`package.json` 의 `scripts` 를 다음으로 바꾼다:

```json
  "scripts": {
    "dev": "next dev --hostname 0.0.0.0",
    "build": "next build",
    "start": "next start --hostname 0.0.0.0",
    "typecheck": "tsc --noEmit",
    "test": "node --test \"tests/unit/*.test.mjs\"",
    "test:integration": "node --test \"tests/integration/*.test.mjs\""
  },
```

- [ ] **Step 4: 실행 확인**

Run: `npm test`
Expected: `# pass 1`, `# fail 0` (파일 단위로 1개 통과). `MODULE_TYPELESS_PACKAGE_JSON` 경고는 무시한다.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tests
git commit -m "chore: add unit/integration test scripts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 컴포넌트 결정 순수 함수

**Files:**
- Create: `src/lib/component-pick.ts`
- Test: `tests/unit/component-pick.test.mjs`

**Interfaces:**
- Produces:
  - `type ChainItem = { interactive: boolean; explicit: boolean; area: number; descendants: number }`
  - `type ComponentPick = { index: number; kind: 'interactive' | 'static' }`
  - `function pickComponent(chain: ChainItem[], viewportArea: number): ComponentPick`
    — `chain[0]` 은 클릭 대상, 뒤로 갈수록 바깥 조상(`<body>` 제외). 후보가 없고 `chain` 이 비면 `index: -1`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/component-pick.test.mjs`:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module .../src/lib/component-pick.ts`

- [ ] **Step 3: 구현**

`src/lib/component-pick.ts`:

```ts
/**
 * 클릭 대상에서 위로 올라간 조상 목록 중 어느 요소를 "컴포넌트"로 셀지 고른다.
 *
 * ⚠️ 이 함수는 instrument.ts 가 toString() 으로 참가자 iframe 에 그대로 주입한다.
 *    함수 밖의 값(상수·헬퍼)을 참조하지 말고, 스프레드·클래스·async 를 쓰지 말 것.
 *
 * 규칙(설계 3-4): 상호작용 후보 중 가장 바깥쪽. 단 아래는 후보에서 뺀다.
 *   - 뷰포트 면적 60% 이상 (이벤트 위임용 앱 래퍼)
 *   - 안에 상호작용 요소가 2개 이상 (리스너를 단 묶음 컨테이너)
 *   data-component 로 명시된 요소는 위 두 규칙과 무관하게 후보다.
 */
export type ChainItem = {
  /** 태그·role·리스너·cursor:pointer 등으로 판정한 상호작용 여부 */
  interactive: boolean;
  /** 의뢰자가 data-component 로 경계를 명시했는가 */
  explicit: boolean;
  /** 화면상 면적(px²) */
  area: number;
  /** 자기 아래에 있는 상호작용 요소 수 */
  descendants: number;
};

export type ComponentPick = { index: number; kind: 'interactive' | 'static' };

export function pickComponent(chain: ChainItem[], viewportArea: number): ComponentPick {
  let best = -1;
  for (let i = 0; i < chain.length; i++) {
    const item = chain[i];
    if (item.explicit) { best = i; continue; }
    if (!item.interactive) continue;
    if (item.area >= viewportArea * 0.6) continue;
    if (item.descendants >= 2) continue;
    best = i;
  }
  if (best >= 0) return { index: best, kind: 'interactive' };
  return { index: chain.length ? 0 : -1, kind: 'static' };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add src/lib/component-pick.ts tests/unit/component-pick.test.mjs
git commit -m "feat: add outermost-component picker for click heatmap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 공용 화면 해시

**Files:**
- Create: `src/lib/screen-hash.ts`
- Test: `tests/unit/screen-hash.test.mjs`

**Interfaces:**
- Produces:
  - `function screenHash(html: string): string` — 28자리 소문자 16진수, 동기
  - `function screenId(studyId: string, variant: 'A' | 'B', hash: string): string` — `${studyId}_${variant}_${hash}`
  - `const SCREEN_HASH_PATTERN: RegExp` — `/^[0-9a-f]{28}$/`
  - `const MAX_SCREEN_CHARS = 2_000_000`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/screen-hash.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenHash, screenId, SCREEN_HASH_PATTERN, MAX_SCREEN_CHARS } from '../../src/lib/screen-hash.ts';

test('같은 HTML 은 같은 해시, 28자리 16진수', () => {
  const html = '<!DOCTYPE html><html><body><button>저장</button></body></html>';
  assert.equal(screenHash(html), screenHash(html));
  assert.match(screenHash(html), SCREEN_HASH_PATTERN);
});

test('한 글자만 달라도 해시가 다르다', () => {
  assert.notEqual(screenHash('<p>a</p>'), screenHash('<p>b</p>'));
  assert.notEqual(screenHash(''), screenHash(' '));
});

test('화면 ID 는 연구_시안_해시', () => {
  const h = screenHash('x');
  assert.equal(screenId('study-1', 'B', h), `study-1_B_${h}`);
});

test('상한은 200만 자', () => {
  assert.equal(MAX_SCREEN_CHARS, 2_000_000);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module .../src/lib/screen-hash.ts`

- [ ] **Step 3: 구현**

`src/lib/screen-hash.ts`:

```ts
/**
 * 화면 스냅샷 해시 — 참가자 브라우저와 서버가 **같은 함수**를 쓴다.
 *
 * crypto.subtle(SHA-256)을 쓰지 않는 이유: 앱이 0.0.0.0 으로 떠서 다른 기기가
 * http://192.168.x.x 로 참여하면 보안 컨텍스트가 아니라 crypto.subtle 이 없다.
 * 위조 방지는 서버가 이 함수로 다시 계산해 대조하는 것으로 충분하다.
 *
 * Node 테스트가 직접 import 하므로 값 import 를 하지 않는다.
 */
export const SCREEN_HASH_PATTERN = /^[0-9a-f]{28}$/;

/** 이보다 큰 스냅샷은 저장하지 않는다(클라이언트가 보내지 않고, 서버는 400). */
export const MAX_SCREEN_CHARS = 2_000_000;

function cyrb53(str: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export function screenHash(html: string): string {
  return cyrb53(html, 0x9e3779b9) + cyrb53(html, 0x85ebca6b);
}

export function screenId(studyId: string, variant: 'A' | 'B', hash: string): string {
  return `${studyId}_${variant}_${hash}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add src/lib/screen-hash.ts tests/unit/screen-hash.test.mjs
git commit -m "feat: add shared screen snapshot hash

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 스냅샷 표시 준비 + 히트맵 오버레이 스크립트

**Files:**
- Create: `src/lib/snapshot.ts`
- Test: `tests/unit/snapshot.test.mjs`

**Interfaces:**
- Produces:
  - `const PROTOTYPE_CSP: string` — 시안·스냅샷 공용 CSP 문자열(외부 네트워크 차단)
  - `function heatmapOverlay(): void` — iframe 안에서 실행. `message` 로 `{type:'mindlens-heatmap', items:{path,count,kind}[], highlight:string}` 를 받아 상자를 그리고, 못 찾은 경로를 `{type:'mindlens-heatmap-missing', paths:string[]}` 로 부모에 알린다.
  - `function prepareSnapshot(html: string): string` — 시안 `<script>`·`on*` 속성 제거, CSP `<meta>` 를 `<head>` 뒤에, `<script data-mindlens-overlay>` 를 `</body>` 앞(없으면 끝)에 넣는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/snapshot.test.mjs`:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module .../src/lib/snapshot.ts`

- [ ] **Step 3: 구현**

`src/lib/snapshot.ts`:

```ts
/**
 * 결과 화면에서 클릭 순간의 스냅샷을 다시 띄우기 위한 준비 + 그 위에 상자를 그리는 오버레이.
 *
 * Node 테스트가 직접 import 하므로 값 import 를 하지 않는다.
 * heatmapOverlay 는 toString() 으로 주입되므로 함수 밖의 값을 참조하지 않는다.
 */

/** 시안·스냅샷 공용 CSP — 외부 요청·폼 전송·하위 프레임 차단. 인라인 스크립트·스타일만 허용. */
export const PROTOTYPE_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:; font-src data: https:; connect-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'";

export function heatmapOverlay(): void {
  type Item = { path: string; count: number; kind: 'interactive' | 'static' };
  let items: Item[] = [];
  let highlight = '';
  let reopened = false;

  // 스냅샷의 <dialog open> 은 모달이 아닌 상태로 그려진다. 참가자가 본 것처럼 모달로 다시 연다.
  function reopenDialogs() {
    if (reopened) return;
    reopened = true;
    const dialogs = document.querySelectorAll('dialog[open]');
    for (let i = 0; i < dialogs.length; i++) {
      const d = dialogs[i] as HTMLDialogElement;
      d.removeAttribute('open');
      try { d.showModal(); } catch { d.setAttribute('open', ''); }
    }
  }

  function draw() {
    reopenDialogs();
    const old = document.querySelectorAll('[data-mindlens-box]');
    for (let i = 0; i < old.length; i++) old[i].remove();
    let max = 1;
    for (let i = 0; i < items.length; i++) if (items[i].count > max) max = items[i].count;
    const missing: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let el: Element | null = null;
      try { el = document.querySelector(item.path); } catch { el = null; }
      if (!el) { missing.push(item.path); continue; }
      const r = el.getBoundingClientRect();
      // 모달 다이얼로그는 톱 레이어라 documentElement 에 붙인 상자보다 위에 뜬다 → 상자를 다이얼로그 안에 붙인다.
      const host = el.closest('dialog[open]') as HTMLElement | null;
      let left = r.left + scrollX;
      let top = r.top + scrollY;
      if (host) {
        const hr = host.getBoundingClientRect();
        left = r.left - hr.left - host.clientLeft + host.scrollLeft;
        top = r.top - hr.top - host.clientTop + host.scrollTop;
      }
      const rgb = item.kind === 'static' ? '241,129,52' : '0,164,223';
      const alpha = (0.15 + 0.5 * (item.count / max)).toFixed(2);
      const strong = item.path === highlight;
      const box = document.createElement('div');
      box.setAttribute('data-mindlens-box', '');
      box.style.cssText =
        'position:absolute;pointer-events:none;box-sizing:border-box;z-index:2147483647;border-radius:4px;' +
        `left:${left}px;top:${top}px;width:${Math.max(r.width, 4)}px;height:${Math.max(r.height, 4)}px;` +
        `background:rgba(${rgb},${alpha});border:${strong ? 3 : 2}px solid rgb(${rgb});` +
        (strong ? `box-shadow:0 0 0 4px rgba(${rgb},.35);` : '');
      const badge = document.createElement('span');
      badge.textContent = String(item.count);
      badge.style.cssText =
        'position:absolute;top:-10px;right:-10px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;' +
        `background:rgb(${rgb});color:#fff;font:600 11px/20px system-ui,sans-serif;text-align:center;`;
      box.appendChild(badge);
      (host || document.documentElement).appendChild(box);
    }
    parent.postMessage({ type: 'mindlens-heatmap-missing', paths: missing }, '*');
  }

  addEventListener('message', (event) => {
    if (event.source !== parent) return;
    const data = event.data;
    if (!data || data.type !== 'mindlens-heatmap') return;
    items = Array.isArray(data.items) ? data.items : [];
    highlight = typeof data.highlight === 'string' ? data.highlight : '';
    draw();
  });
  addEventListener('resize', draw);
}

/** 시안 스크립트가 다시 돌면 DOM 이 바뀌어 경로가 어긋난다 → 제거하고 오버레이만 남긴다. */
export function prepareSnapshot(html: string): string {
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${PROTOTYPE_CSP}">`;
  const overlay = `<script data-mindlens-overlay>(${heatmapOverlay.toString()})()</script>`;
  const headRe = /<head(?:\s[^>]*)?>/i;
  const withMeta = headRe.test(stripped) ? stripped.replace(headRe, (head) => head + meta) : meta + stripped;
  return /<\/body\s*>/i.test(withMeta)
    ? withMeta.replace(/<\/body\s*>/i, (end) => overlay + end)
    : withMeta + overlay;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add src/lib/snapshot.ts tests/unit/snapshot.test.mjs
git commit -m "feat: prepare snapshots and heatmap overlay script

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 서버 — 화면 저장·조회, 이벤트 확장

**Files:**
- Modify: `src/lib/types.ts` (`ClickEvent`)
- Modify: `src/lib/db.ts` (스키마·함수)
- Modify: `src/lib/server.ts` (`body`·`cleanEvent`·`eventsPost`, 신규 `screensPost`·`screenGet`)
- Create: `src/app/api/sessions/[id]/screens/route.ts`
- Create: `src/app/api/screens/[id]/route.ts`
- Test: `tests/integration/screens-api.test.mjs`

**Interfaces:**
- Consumes: `screenHash`·`screenId`·`SCREEN_HASH_PATTERN`·`MAX_SCREEN_CHARS` (Task 3), `prepareSnapshot` (Task 4)
- Produces:
  - `ClickEvent` 에 `screenId?: string; componentPath?: string; kind?: 'interactive' | 'static'`
  - `POST /api/sessions/[id]/screens` body `{variant, hash, html}` → `200 {id, created}` · 해시 불일치·형식 오류 400 · 완료 세션 409
  - `POST /api/sessions/[id]/events` — `screenId` 가 있으면 같은 연구·시안의 존재하는 화면이어야 함, 아니면 400
  - `GET /api/screens/[id]` → `prepareSnapshot` 한 HTML, `Content-Security-Policy: sandbox allow-scripts; frame-ancestors 'self'`

- [ ] **Step 0: Next 라우트 문서 확인**

`node_modules/next/dist/docs/` 에서 route handler(동적 세그먼트 `params` 가 `Promise`)를 읽고, 기존 `src/app/api/sessions/[id]/events/route.ts` 와 형태가 같은지 확인한다.

- [ ] **Step 1: 실패하는 통합 테스트 작성**

`tests/integration/screens-api.test.mjs`:

```js
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { screenHash } from '../../src/lib/screen-hash.ts';
import { SURVEY_QUESTIONS } from '../../src/lib/types.ts';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3100';
const post = (path, body) => fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (path, body) => fetch(BASE + path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const html = '<!DOCTYPE html><html><head></head><body><main><button>저장</button></main><script>1</script></body></html>';
const hash = screenHash(html);
let study, session;

before(async () => {
  const s = await post('/api/demo', { owner: 'heatmap-test', durationSeconds: 15 });
  assert.equal(s.status, 201, `서버(${BASE})가 떠 있어야 한다`);
  study = (await s.json()).study;
  const r = await post('/api/sessions', { studyId: study.id, name: 'tester' });
  session = (await r.json()).session;
});

const click = (extra) => ({ variant: session.currentVariant, elapsedMs: 10, component: '저장', tag: 'button', text: '저장', selector: 'button', x: 1, y: 1, viewportWidth: 800, viewportHeight: 600, ...extra });

test('해시가 내용과 다르면 400', async () => {
  const r = await post(`/api/sessions/${session.id}/screens`, { variant: session.currentVariant, hash: '0'.repeat(28), html });
  assert.equal(r.status, 400);
});

test('해시 형식이 틀리면 400', async () => {
  const r = await post(`/api/sessions/${session.id}/screens`, { variant: session.currentVariant, hash: 'abc', html });
  assert.equal(r.status, 400);
});

test('같은 화면은 한 번만 저장된다', async () => {
  const first = await post(`/api/sessions/${session.id}/screens`, { variant: session.currentVariant, hash, html });
  assert.equal(first.status, 200);
  const a = await first.json();
  assert.equal(a.id, `${study.id}_${session.currentVariant}_${hash}`);
  assert.equal(a.created, true);
  const again = await (await post(`/api/sessions/${session.id}/screens`, { variant: session.currentVariant, hash, html })).json();
  assert.deepEqual(again, { id: a.id, created: false });
});

test('없는 화면을 가리키는 클릭은 400, 있는 화면은 저장', async () => {
  const bad = await post(`/api/sessions/${session.id}/events`, { events: [click({ screenId: `${study.id}_${session.currentVariant}_${'f'.repeat(28)}`, componentPath: 'body>main:nth-of-type(1)>button:nth-of-type(1)', kind: 'interactive' })] });
  assert.equal(bad.status, 400);
  const other = session.currentVariant === 'A' ? 'B' : 'A';
  const wrongVariant = await post(`/api/sessions/${session.id}/events`, { events: [click({ variant: other, screenId: `${study.id}_${session.currentVariant}_${hash}` })] });
  assert.equal(wrongVariant.status, 400, '다른 시안의 화면을 가리키면 안 된다');
  const ok = await post(`/api/sessions/${session.id}/events`, { events: [click({ screenId: `${study.id}_${session.currentVariant}_${hash}`, componentPath: 'body>main:nth-of-type(1)>button:nth-of-type(1)', kind: 'interactive' })] });
  assert.equal(ok.status, 200);
  const detail = await (await fetch(`${BASE}/api/sessions/${session.id}`)).json();
  const saved = detail.events.at(-1);
  assert.equal(saved.componentPath, 'body>main:nth-of-type(1)>button:nth-of-type(1)');
  assert.equal(saved.kind, 'interactive');
});

test('스냅샷 조회는 시안 스크립트를 빼고 오버레이를 넣어 샌드박스로 내려준다', async () => {
  const r = await fetch(`${BASE}/api/screens/${study.id}_${session.currentVariant}_${hash}`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.match(r.headers.get('content-security-policy'), /sandbox allow-scripts/);
  const body = await r.text();
  assert.ok(body.includes('data-mindlens-overlay'));
  assert.ok(!body.includes('<script>1</script>'));
  assert.equal((await fetch(`${BASE}/api/screens/nope`)).status, 404);
});

test('완료한 세션은 화면을 더 저장할 수 없다(409)', async () => {
  const answers = SURVEY_QUESTIONS.map((q) => ({ questionId: q.id, choice: q.options[0], otherText: '' }));
  const [first, second] = session.order;
  assert.equal((await post(`/api/sessions/${session.id}/surveys`, { variant: first, answers })).status, 200);
  assert.equal((await patch(`/api/sessions/${session.id}`, { currentVariant: second })).status, 200);
  assert.equal((await post(`/api/sessions/${session.id}/surveys`, { variant: second, answers })).status, 200);
  const done = await patch(`/api/sessions/${session.id}`, { elapsedA: 15, elapsedB: 15, preference: 'A', status: 'completed' });
  assert.equal(done.status, 200);
  const r = await post(`/api/sessions/${session.id}/screens`, { variant: 'A', hash: screenHash('<p>late</p>'), html: '<p>late</p>' });
  assert.equal(r.status, 409);
});
```

- [ ] **Step 2: 테스트 서버 띄우고 실패 확인**

별도 터미널(백그라운드)에서 임시 DB 로 개발 서버를 띄운다:

```bash
MINDLENS_DATA_DIR="$(mktemp -d)" node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100
```

Run: `BASE_URL=http://127.0.0.1:3100 npm run test:integration`
Expected: FAIL — screens 엔드포인트 404 등 다수 실패(`before` 는 통과해야 한다)

- [ ] **Step 3: `ClickEvent` 타입 확장**

`src/lib/types.ts` 의 `ClickEvent` 줄을 다음으로 바꾼다:

```ts
export interface ClickEvent { id?:number; sessionId?:string; variant:Variant; elapsedMs:number; component:string; tag:string; text:string; selector:string; x:number; y:number; viewportWidth:number; viewportHeight:number; source?:'prototype'|'platform'; createdAt?:string; screenId?:string; componentPath?:string; kind?:'interactive'|'static'; }
```

- [ ] **Step 4: DB 스키마와 함수**

`src/lib/db.ts`:

1) 상단 import 에 추가:

```ts
import { screenId } from './screen-hash';
```

2) `singleton.exec(` 의 SQL 마지막(`CREATE INDEX IF NOT EXISTS turns_session ON turns(sessionId);`) 바로 뒤, 백틱 앞에 추가:

```sql
      CREATE TABLE IF NOT EXISTS screens (id TEXT PRIMARY KEY, studyId TEXT NOT NULL REFERENCES studies(id), variant TEXT NOT NULL, hash TEXT NOT NULL, html TEXT NOT NULL, createdAt TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS screens_study ON screens(studyId, variant);
```

3) `export function getRecording` 줄 바로 위에 추가:

```ts
export function saveScreen(studyId:string,variant:Variant,hash:string,html:string):{id:string;created:boolean}{const id=screenId(studyId,variant,hash);const result=db().prepare('INSERT INTO screens(id,studyId,variant,hash,html,createdAt) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(id,studyId,variant,hash,html,new Date().toISOString());return {id,created:Number(result.changes)>0};}
export function screenExists(id:string):boolean{return !!db().prepare('SELECT 1 FROM screens WHERE id=?').get(id);}
export function getScreenHtml(id:string):string{return (required(db().prepare('SELECT html FROM screens WHERE id=?').get(id),'화면을 찾을 수 없습니다.') as {html:string}).html;}
```

- [ ] **Step 5: 서버 핸들러**

`src/lib/server.ts`:

1) import 추가(기존 import 아래):

```ts
import { screenHash, SCREEN_HASH_PATTERN, MAX_SCREEN_CHARS } from './screen-hash';
import { prepareSnapshot } from './snapshot';
```

2) `body` 를 상한 인자를 받게 바꾼다(기존 호출은 기본값 2MB 그대로):

```ts
export async function body(request:Request,maxBytes=2*1024*1024) {if(Number(request.headers.get('content-length')||0)>maxBytes)throw new store.HttpError(413,'요청 크기가 너무 큽니다.');const value=await request.json();if(!value||typeof value!=='object'||Array.isArray(value))throw new store.HttpError(400,'요청 형식을 확인해주세요.');return value;}
```

3) `cleanEvent` 의 반환 객체 끝(`source:e.source==='platform'?'platform':'prototype'` 뒤)에 필드 3개를 추가한다:

```ts
,screenId:e.screenId===undefined||e.screenId===null?undefined:text(e.screenId,'화면 ID',200),componentPath:typeof e.componentPath==='string'&&e.componentPath?text(e.componentPath,'컴포넌트 경로',1000):undefined,kind:e.kind==='static'?'static':e.kind==='interactive'?'interactive':undefined
```

4) `eventsPost` 를 다음으로 교체한다(세션을 잡아 두고, 화면 참조를 검증):

```ts
export async function eventsPost(request:Request,context:RouteContext){const {id}=await context.params;const s=mutableSession(id);const b=await body(request);if(!Array.isArray(b.events)||b.events.length>500)throw new store.HttpError(400,'클릭 이벤트는 한 번에 500개까지 저장할 수 있습니다.');const events=b.events.map((e:unknown)=>{if(!e||typeof e!=='object')throw new store.HttpError(400,'클릭 이벤트 형식을 확인해주세요.');return cleanEvent(e as Record<string,unknown>);});for(const e of events as ClickEvent[]){if(e.screenId&&(!e.screenId.startsWith(`${s.studyId}_${e.variant}_`)||!store.screenExists(e.screenId)))throw new store.HttpError(400,'화면 기록을 먼저 저장해주세요.');}return json({saved:store.addEvents(id,events)});}
```

5) 파일 끝에 추가:

```ts
export async function screensPost(request:Request,context:RouteContext){const {id}=await context.params;const s=mutableSession(id);const b=await body(request,8*1024*1024);const v=variant(b.variant);
 // html 은 trim 하지 않는다 — 한 글자라도 바뀌면 해시가 달라진다.
 if(typeof b.html!=='string'||!b.html||b.html.length>MAX_SCREEN_CHARS)throw new store.HttpError(400,`화면 기록은 ${MAX_SCREEN_CHARS.toLocaleString('ko-KR')}자 이하여야 합니다.`);
 if(typeof b.hash!=='string'||!SCREEN_HASH_PATTERN.test(b.hash))throw new store.HttpError(400,'화면 해시 형식이 올바르지 않습니다.');
 if(screenHash(b.html)!==b.hash)throw new store.HttpError(400,'화면 해시가 내용과 일치하지 않습니다.');
 return json(store.saveScreen(s.studyId,v,b.hash,b.html));}
export async function screenGet(_request:Request,context:RouteContext){const {id}=await context.params;return new Response(prepareSnapshot(store.getScreenHtml(id)),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"sandbox allow-scripts; frame-ancestors 'self'"}});}
```

- [ ] **Step 6: 라우트 파일**

`src/app/api/sessions/[id]/screens/route.ts`:

```ts
export const runtime='nodejs';
export const dynamic='force-dynamic';
import {api,screensPost} from '@/lib/server';export const POST=api(screensPost);
```

`src/app/api/screens/[id]/route.ts`:

```ts
export const runtime='nodejs';
export const dynamic='force-dynamic';
import {api,screenGet} from '@/lib/server';export const GET=api(screenGet);
```

- [ ] **Step 7: 통과 확인**

개발 서버를 **재시작**한다(새 `MINDLENS_DATA_DIR` 로). DB 스키마는 첫 연결 때 한 번만 만들어지므로,
Step 2 에서 띄운 서버의 SQLite 연결에는 `screens` 테이블이 없을 수 있다. 로그에 컴파일 오류가 없어야 한다.

Run: `BASE_URL=http://127.0.0.1:3100 npm run test:integration`
Expected: PASS, `# fail 0`

Run: `npm test && npm run typecheck`
Expected: 둘 다 오류 0

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/lib/db.ts src/lib/server.ts src/app/api/sessions/[id]/screens src/app/api/screens tests/integration
git commit -m "feat: store click-time screen snapshots and serve them for heatmaps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 참가자 쪽 — 컴포넌트 추적 주입 스크립트와 전송 순서

**Files:**
- Create: `src/lib/instrument.ts`
- Modify: `src/components/participant-runner.tsx` (4·23·27·32·33·41 줄 — 아래 각 단계에 정확한 교체 내용)

**Interfaces:**
- Consumes: `pickComponent`·`ChainItem` (Task 2), `screenHash`·`screenId`·`MAX_SCREEN_CHARS` (Task 3), `PROTOTYPE_CSP` (Task 4), `POST /api/sessions/[id]/screens` (Task 5)
- Produces:
  - `function instrument(html: string): string` — CSP `<meta data-mindlens>` + `<script data-mindlens>` 를 `<head>` 바로 뒤(없으면 맨 앞)에 넣는다.
  - `type PrototypeClick = { type: 'mindlens-click'; html: string; componentPath: string; kind: 'interactive'|'static'; component: string; tag: string; text: string; selector: string; x: number; y: number; viewportWidth: number; viewportHeight: number }`
  - 참가자 iframe 이 클릭마다 `PrototypeClick` 을 `parent.postMessage` 로 보낸다.

이 태스크는 DOM 실행이 필요해 단위 테스트 대신 **빌드 + 브라우저 확인**으로 검증한다(판정 로직 자체는 Task 2 에서 테스트됨).

- [ ] **Step 1: `src/lib/instrument.ts` 작성**

```ts
import { pickComponent } from './component-pick';
import { PROTOTYPE_CSP } from './snapshot';

/** 참가자 iframe → 부모 창 메시지. 클릭 1회 = 1개. */
export type PrototypeClick = {
  type: 'mindlens-click';
  /** 클릭 순간(시안 핸들러 실행 전) DOM. 주입한 data-mindlens 요소는 제거됨 */
  html: string;
  /** body 부터 컴포넌트까지 tag:nth-of-type 경로 */
  componentPath: string;
  kind: 'interactive' | 'static';
  /** 표시용 이름: data-component → aria-label → 텍스트 40자 → 태그명 */
  component: string;
  tag: string;
  text: string;
  selector: string;
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
};

/**
 * iframe 안에서 실행된다. toString() 으로 주입되므로 함수 밖 값을 참조하지 않고,
 * 컴포넌트 판정 함수는 인자로 받는다(같은 로직이 두 벌 생기지 않게).
 */
export function clickTracker(pick: typeof pickComponent): void {
  const LISTENED = new WeakSet<Element>();
  const TYPES: Record<string, true> = { click: true, pointerdown: true, pointerup: true, mousedown: true, mouseup: true, touchstart: true, touchend: true };
  const original = EventTarget.prototype.addEventListener;
  // 시안 스크립트보다 먼저 실행되므로 이후 붙는 클릭 리스너를 전부 본다. 전역(window·document·html·body)은 제외.
  EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
    if (TYPES[type] && this instanceof Element && this !== document.documentElement && this !== document.body) LISTENED.add(this);
    return original.call(this, type, listener, options);
  };
  const INTERACTIVE = 'a[href],button,input:not([type=hidden]),select,textarea,label,summary,[onclick],[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=radio],[role=switch],[role=option],[tabindex],[data-component]';
  const ROLES = /^(button|link|tab|menuitem|checkbox|radio|switch|option)$/;

  function isInteractive(el: Element): boolean {
    if (LISTENED.has(el)) return true;
    if (typeof (el as HTMLElement).onclick === 'function') return true;
    if (el.matches('a[href],button,input:not([type=hidden]),select,textarea,label,summary,[onclick]')) return true;
    const role = el.getAttribute('role');
    if (role && ROLES.test(role)) return true;
    const tab = el.getAttribute('tabindex');
    if (tab !== null && Number(tab) >= 0) return true;
    // cursor 는 상속된다 → 포인터 영역의 꼭대기만 센다(위임 리스너로 동작하는 tr.project-row 등).
    const parentEl = el.parentElement;
    return getComputedStyle(el).cursor === 'pointer' && (!parentEl || getComputedStyle(parentEl).cursor !== 'pointer');
  }

  function pathOf(el: Element): string {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body && node !== document.documentElement) {
      const tag = node.localName;
      let n = 1;
      let sib = node.previousElementSibling;
      while (sib) { if (sib.localName === tag) n++; sib = sib.previousElementSibling; }
      parts.unshift(CSS.escape(tag) + ':nth-of-type(' + n + ')');
      node = node.parentElement;
    }
    parts.unshift('body');
    return parts.join('>');
  }

  function snapshot(): string {
    const clone = document.documentElement.cloneNode(true) as HTMLElement;
    const ours = clone.querySelectorAll('[data-mindlens]');
    for (let i = 0; i < ours.length; i++) ours[i].remove();
    return '<!DOCTYPE html>' + clone.outerHTML;
  }

  // window 캡처 단계 = 시안 핸들러보다 먼저 → 화면이 바뀌기 전 상태가 스냅샷에 남는다.
  original.call(window, 'click', function (event: Event) {
    const raw = event.target;
    if (!(raw instanceof Element)) return;
    const els: Element[] = [];
    let node: Element | null = raw;
    while (node && node !== document.body && node !== document.documentElement) { els.push(node); node = node.parentElement; }
    const chain = els.map(function (el) {
      const r = el.getBoundingClientRect();
      return { interactive: isInteractive(el), explicit: el.hasAttribute('data-component'), area: r.width * r.height, descendants: el.querySelectorAll(INTERACTIVE).length };
    });
    const picked = pick(chain, innerWidth * innerHeight);
    const el = picked.index >= 0 ? els[picked.index] : document.body;
    const text = ((el as HTMLElement).innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 180);
    const component = el.getAttribute('data-component') || el.getAttribute('aria-label') || text.slice(0, 40) || el.localName;
    let selector = el.localName;
    if (el.id) selector += '#' + CSS.escape(el.id);
    else if (el.classList.length) selector += '.' + Array.from(el.classList).slice(0, 3).map(function (c) { return CSS.escape(c); }).join('.');
    const mouse = event as MouseEvent;
    parent.postMessage({ type: 'mindlens-click', html: snapshot(), componentPath: pathOf(el), kind: picked.kind, component, tag: el.localName, text, selector, x: mouse.clientX, y: mouse.clientY, viewportWidth: innerWidth, viewportHeight: innerHeight }, '*');
  }, true);
}

export function instrument(html: string): string {
  const meta = `<meta data-mindlens http-equiv="Content-Security-Policy" content="${PROTOTYPE_CSP}">`;
  const script = `<script data-mindlens>(${clickTracker.toString()})(${pickComponent.toString()})</script>`;
  const headRe = /<head(?:\s[^>]*)?>/i;
  return headRe.test(html) ? html.replace(headRe, (head) => head + meta + script) : meta + script + html;
}
```

- [ ] **Step 2: participant-runner — import 교체**

4번째 줄 다음(6번째 줄 `participant-session` import 아래)에 추가:

```ts
import { instrument, type PrototypeClick } from '@/lib/instrument';
import { screenHash, screenId, MAX_SCREEN_CHARS } from '@/lib/screen-hash';
```

- [ ] **Step 3: participant-runner — 기존 `instrument` 삭제**

`function instrument(html:string){` 로 시작하는 23번째 줄(한 줄짜리 함수 전체)을 삭제한다.

- [ ] **Step 4: participant-runner — 화면 대기열 ref 추가**

`const iframe=useRef<HTMLIFrameElement>(null),...` 로 시작하는 ref 선언 줄 바로 아래에 추가:

```ts
 // 아직 서버에 없는 화면 스냅샷. 이벤트보다 먼저 보낸다(없는 화면을 가리키는 클릭을 만들지 않게).
 const screens=useRef<{id:string;variant:Variant;hash:string;html:string}[]>([]),sentScreens=useRef(new Set<string>());
```

- [ ] **Step 5: participant-runner — `flush` 교체**

`const flush=useCallback(` 로 시작하는 줄 전체를 다음으로 교체:

```ts
 const flush=useCallback(async()=>{const s=sessionRef.current;if(!s)return;while(screens.current.length){const screen=screens.current[0];await api(`/api/sessions/${s.id}/screens`,json({variant:screen.variant,hash:screen.hash,html:screen.html}));sentScreens.current.add(screen.id);screens.current.shift();}if(!events.current.length)return;const batch=events.current.splice(0);try{await api(`/api/sessions/${s.id}/events`,json({events:batch}));}catch(e){events.current.unshift(...batch);throw e}},[]);
```

- [ ] **Step 6: participant-runner — 클릭 수신 교체**

`useEffect(()=>{const receive=(e:MessageEvent)=>{` 로 시작하는 줄 전체를 다음으로 교체:

```ts
 useEffect(()=>{const receive=(e:MessageEvent)=>{if(e.source!==iframe.current?.contentWindow||e.data?.type!=='mindlens-click'||stageRef.current!=='experience')return;const s=sessionRef.current;if(!s)return;const d=e.data as PrototypeClick;let sid:string|undefined;if(typeof d.html==='string'&&d.html&&d.html.length<=MAX_SCREEN_CHARS){const hash=screenHash(d.html);sid=screenId(s.studyId,s.currentVariant,hash);if(!sentScreens.current.has(sid)&&!screens.current.some(x=>x.id===sid))screens.current.push({id:sid,variant:s.currentVariant,hash,html:d.html});}const ev:ClickEvent={variant:s.currentVariant,elapsedMs:Math.max(0,Date.now()-clock.current),component:String(d.component||'').slice(0,180),tag:String(d.tag||'').slice(0,30),text:String(d.text||'').slice(0,180),selector:String(d.selector||'').slice(0,300),x:Number(d.x)||0,y:Number(d.y)||0,viewportWidth:Math.max(1,Number(d.viewportWidth)||1),viewportHeight:Math.max(1,Number(d.viewportHeight)||1),source:'prototype',screenId:sid,componentPath:String(d.componentPath||'').slice(0,1000)||undefined,kind:d.kind==='static'?'static':'interactive'};events.current.push(ev);clicks.current=[...clicks.current.slice(-7),ev]};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)},[]);
```

`finishExperience`(41번째 줄)는 이미 `await flush()` 를 호출하므로 수정하지 않는다 — 새 `flush` 가 화면을 먼저 보낸다.

- [ ] **Step 7: 타입체크·빌드**

Run: `npm run typecheck`
Expected: 오류 0

Run: `npm test`
Expected: PASS

Run: `node node_modules/next/dist/bin/next build`
Expected: 빌드 성공. (production 번들에서도 `toString()` 직렬화가 유효한지는 Task 8 에서 `next start` 로 확인한다.)

- [ ] **Step 8: 브라우저로 수집 확인**

Task 5 의 개발 서버(포트 3100)에서:

1. `http://127.0.0.1:3100` → 의뢰자 이름 입력 → **샘플 연구로 둘러보기**
2. 결과 화면의 **참여 화면 열기** → 참가자 이름 → 텍스트로 시작
3. A안에서: 좌측 내비 버튼, 7일/30일 버튼, 프로젝트 행, 새 프로젝트 다이얼로그 열기 → 다이얼로그 안 버튼, 빈 여백을 차례로 클릭
4. 3초 뒤 개발자 도구 콘솔에서(참가자 탭):

```js
const id = Object.keys(sessionStorage).filter(k => k.startsWith('mindlens:participant:')).map(k => sessionStorage.getItem(k))[0];
const d = await (await fetch(`/api/sessions/${id}`)).json();
console.table(d.events.map(e => ({ component: e.component, kind: e.kind, path: e.componentPath, screen: e.screenId?.slice(-8) })));
```

Expected:
- 7일/30일/90일 클릭이 `#rangeControls` 하나로 합쳐지지 **않고** 각각 다른 `componentPath`
- 다이얼로그 안 버튼 클릭이 `dialog` 로 합쳐지지 않음
- 빈 여백 클릭은 `kind: 'static'`
- 화면 전환 전후 클릭의 `screen` 값이 다름

- [ ] **Step 9: Commit**

```bash
git add src/lib/instrument.ts src/components/participant-runner.tsx
git commit -m "feat: track outermost components with click-time snapshots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 결과 화면 — 화면별 컴포넌트 히트맵

**Files:**
- Create: `src/lib/heatmap-groups.ts`
- Test: `tests/unit/heatmap-groups.test.mjs`
- Create: `src/components/component-heatmap.tsx`
- Modify: `src/components/study-results.tsx` (클릭 탭 블록 교체, CSV 상세 필드)

**Interfaces:**
- Consumes: `ClickEvent.screenId`·`componentPath`·`kind` (Task 5), `GET /api/screens/[id]` + 오버레이 메시지 계약 (Task 4·5)
- Produces:
  - `type HeatmapComponent = { path: string; label: string; kind: 'interactive' | 'static'; count: number }`
  - `type HeatmapScreen = { id: string; variant: Variant; count: number; viewportWidth: number; viewportHeight: number; components: HeatmapComponent[] }`
  - `function groupScreens(events: ClickEvent[]): { screens: HeatmapScreen[]; unsnapshotted: number }`
  - `default function ComponentHeatmap({ events }: { events: ClickEvent[] })`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/heatmap-groups.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupScreens } from '../../src/lib/heatmap-groups.ts';

const ev = (o) => ({ variant: 'A', elapsedMs: 0, component: 'c', tag: 'button', text: '', selector: '', x: 0, y: 0, viewportWidth: 1280, viewportHeight: 720, kind: 'interactive', ...o });

test('화면별로 묶고 컴포넌트 경로별로 센다, 많은 순', () => {
  const { screens } = groupScreens([
    ev({ screenId: 's1', componentPath: 'body>a:nth-of-type(1)', component: '홈' }),
    ev({ screenId: 's1', componentPath: 'body>a:nth-of-type(1)', component: '홈' }),
    ev({ screenId: 's1', componentPath: 'body>p:nth-of-type(1)', component: '설명', kind: 'static' }),
    ev({ screenId: 's2', componentPath: 'body>button:nth-of-type(1)', variant: 'B' }),
  ]);
  assert.deepEqual(screens.map((s) => [s.id, s.count]), [['s1', 3], ['s2', 1]]);
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
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module .../src/lib/heatmap-groups.ts`

- [ ] **Step 3: 집계 구현**

`src/lib/heatmap-groups.ts`:

```ts
// Node 테스트가 직접 import 하므로 값 import 금지(타입만).
import type { ClickEvent, Variant } from './types';

export type HeatmapComponent = { path: string; label: string; kind: 'interactive' | 'static'; count: number };
export type HeatmapScreen = { id: string; variant: Variant; count: number; viewportWidth: number; viewportHeight: number; components: HeatmapComponent[] };

/** 필터된 클릭 이벤트 → 화면별 컴포넌트 집계. 참여자·시안 필터가 히트맵에도 그대로 걸리도록 클라이언트에서 만든다. */
export function groupScreens(events: ClickEvent[]): { screens: HeatmapScreen[]; unsnapshotted: number } {
  let unsnapshotted = 0;
  const byScreen = new Map<string, ClickEvent[]>();
  for (const e of events) {
    if (!e.screenId || !e.componentPath) { unsnapshotted++; continue; }
    const list = byScreen.get(e.screenId);
    if (list) list.push(e); else byScreen.set(e.screenId, [e]);
  }
  const screens: HeatmapScreen[] = [];
  for (const [id, list] of byScreen) {
    const widths = new Map<number, number>();
    for (const e of list) widths.set(e.viewportWidth, (widths.get(e.viewportWidth) || 0) + 1);
    let width = list[0].viewportWidth;
    for (const [w, n] of widths) if (n > (widths.get(width) || 0)) width = w;
    const height = list.find((e) => e.viewportWidth === width)!.viewportHeight;
    const byPath = new Map<string, HeatmapComponent>();
    for (const e of list) {
      const path = e.componentPath!;
      const row = byPath.get(path);
      if (row) row.count++;
      else byPath.set(path, { path, label: e.component || e.tag || path, kind: e.kind === 'static' ? 'static' : 'interactive', count: 1 });
    }
    screens.push({ id, variant: list[0].variant, count: list.length, viewportWidth: width, viewportHeight: height, components: Array.from(byPath.values()).sort((a, b) => b.count - a.count) });
  }
  screens.sort((a, b) => b.count - a.count);
  return { screens, unsnapshotted };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS, `# fail 0`

- [ ] **Step 5: 히트맵 컴포넌트 작성**

`src/components/component-heatmap.tsx`:

```tsx
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClickEvent } from '@/lib/types';
import { groupScreens } from '@/lib/heatmap-groups';
import s from './workspace.module.css';

const COLOR = { interactive: '#00A4DF', static: '#F18134' } as const;

export default function ComponentHeatmap({ events }: { events: ClickEvent[] }) {
  const { screens, unsnapshotted } = useMemo(() => groupScreens(events), [events]);
  const [selected, setSelected] = useState('');
  const [hover, setHover] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const [boxWidth, setBoxWidth] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const screen = screens.find((x) => x.id === selected) || screens[0];

  // 패널 폭 측정 — 화면이 없을 땐 상자가 렌더되지 않으므로 콜백 ref 로 붙였다 뗀다.
  const box = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    observer.current = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    observer.current.observe(el);
  }, []);

  const send = useCallback(() => {
    const w = frame.current?.contentWindow;
    if (!w || !screen) return;
    w.postMessage({ type: 'mindlens-heatmap', items: screen.components.map((c) => ({ path: c.path, count: c.count, kind: c.kind })), highlight: hover }, '*');
  }, [screen, hover]);

  useEffect(send, [send]);
  useEffect(() => setMissing([]), [screen?.id]);
  useEffect(() => {
    const receive = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.type !== 'mindlens-heatmap-missing') return;
      setMissing(Array.isArray(e.data.paths) ? e.data.paths : []);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  if (!screen) return <div className={s.empty} style={{ border: 0, padding: '42px 20px' }}>스냅샷이 있는 클릭이 아직 없습니다.{unsnapshotted ? ` (스냅샷 없는 클릭 ${unsnapshotted}회)` : ''}</div>;

  const scale = boxWidth ? Math.min(1, boxWidth / screen.viewportWidth) : 1;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,200px) minmax(0,1fr) minmax(220px,280px)', gap: 16, alignItems: 'start' }}>
      <div>
        <p className={s.hint}>화면 {screens.length}개 · 클릭 많은 순</p>
        {screens.map((x, i) => (
          <button key={x.id} onClick={() => setSelected(x.id)} className={s.recordCard} style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', outline: x.id === screen.id ? `2px solid ${COLOR.interactive}` : undefined }}>
            <span className={s.badge}>{x.variant}</span> <strong>화면 {i + 1}</strong> · {x.count}회
            <p className={s.hint} style={{ marginTop: 4, overflowWrap: 'anywhere' }}>{x.components[0]?.label}</p>
          </button>
        ))}
        {unsnapshotted > 0 && <p className={s.hint}>스냅샷 없는 클릭 {unsnapshotted}회는 히트맵에서 제외됩니다.</p>}
      </div>
      <div ref={box} style={{ position: 'relative', overflow: 'hidden', height: screen.viewportHeight * scale, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
        <iframe
          key={screen.id}
          ref={frame}
          src={`/api/screens/${screen.id}`}
          sandbox="allow-scripts"
          title="클릭 순간의 화면"
          onLoad={send}
          style={{ width: screen.viewportWidth, height: screen.viewportHeight, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        />
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead><tr><th>컴포넌트</th><th>횟수</th></tr></thead>
          <tbody>
            {screen.components.map((c) => (
              <tr key={c.path} onMouseEnter={() => setHover(c.path)} onMouseLeave={() => setHover('')} style={{ background: hover === c.path ? '#edf7fc' : undefined }}>
                <td>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: COLOR[c.kind], marginRight: 6 }} />
                  {c.label}
                  {missing.includes(c.path) && <span className={s.badge} style={{ marginLeft: 6 }}>화면에서 찾지 못함</span>}
                </td>
                <td>{c.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={s.hint}>● 하늘색: 버튼·링크 등 · 주황: 누를 수 없는 곳</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: study-results — 클릭 탭 교체**

`src/components/study-results.tsx`:

1) import 추가(`import WorkspaceShell from './workspace-shell';` 아래):

```ts
import ComponentHeatmap from './component-heatmap';
```

2) 아래 **원문 전체**(클릭 탭의 시작부터 좌표 점 분포 섹션 끝 `</section></div>` 까지)를 찾아:

```tsx
{tab==='clicks'&&<><div className={s.twoCols}><section className={s.panel}><h3>컴포넌트별 클릭</h3><p className={s.hint}>선택한 참여자 · 버전 기준 {filtered.events.length}회</p>{components.length?<div className={s.tableWrap}><table className={s.table}><thead><tr><th>컴포넌트</th><th>버전</th><th>횟수</th><th>첫 클릭</th><th>마지막</th></tr></thead><tbody>{components.map((x,i)=><tr key={i}><td><strong>{x.component}</strong></td><td>{x.variant}</td><td>{x.count}</td><td className={s.timestamp}>{seconds(x.first)}</td><td className={s.timestamp}>{seconds(x.last)}</td></tr>)}</tbody></table></div>:<Empty text="수집된 클릭이 없습니다."/>}</section><section className={s.panel}><h3>클릭 위치 분포</h3><p className={s.hint}>화면 너비·높이로 정규화한 좌표. 점에 마우스를 올려 기록을 확인하세요.</p><div className={s.dotMap}>{filtered.events.map((e,i)=><span key={i} className={s.dot} style={{left:`${Math.min(100,Math.max(0,e.x/Math.max(1,e.viewportWidth)*100))}%`,top:`${Math.min(100,Math.max(0,e.y/Math.max(1,e.viewportHeight)*100))}%`,background:e.variant==='B'?'#5277a366':undefined,borderColor:e.variant==='B'?'#5277a388':undefined}} title={`${sessionName(e.sessionId)} · ${e.variant} · ${e.component} · ${seconds(e.elapsedMs)}`}/>)}</div><p className={s.hint}>● A: 하늘색 · B: 파란색 · 서로 다른 화면 크기와 스크롤 위치의 점이 함께 표시됩니다. 실제 화면의 시각적 히트맵과는 다릅니다.</p></section></div>
```

다음으로 교체한다(히트맵을 전폭으로 위에, 기존 컴포넌트 표는 그 아래 전폭으로):

```tsx
{tab==='clicks'&&<><section className={s.panel}><h3>컴포넌트 히트맵</h3><p className={s.hint}>클릭한 순간의 화면 위에 컴포넌트별 클릭 수를 표시합니다. 선택한 참여자 · 버전 기준 {filtered.events.length}회</p><ComponentHeatmap events={filtered.events}/></section><section className={`${s.panel} ${s.sectionSpace}`}><h3>컴포넌트별 클릭</h3><p className={s.hint}>모든 화면을 합친 컴포넌트 이름 기준 집계입니다.</p>{components.length?<div className={s.tableWrap}><table className={s.table}><thead><tr><th>컴포넌트</th><th>버전</th><th>횟수</th><th>첫 클릭</th><th>마지막</th></tr></thead><tbody>{components.map((x,i)=><tr key={i}><td><strong>{x.component}</strong></td><td>{x.variant}</td><td>{x.count}</td><td className={s.timestamp}>{seconds(x.first)}</td><td className={s.timestamp}>{seconds(x.last)}</td></tr>)}</tbody></table></div>:<Empty text="수집된 클릭이 없습니다."/>}</section>
```

3) CSV 상세에 새 필드를 넣는다. 원문:

```ts
JSON.stringify({selector:x.selector,x:x.x,y:x.y,viewportWidth:x.viewportWidth,viewportHeight:x.viewportHeight})
```

교체:

```ts
JSON.stringify({selector:x.selector,componentPath:x.componentPath,kind:x.kind,screenId:x.screenId,x:x.x,y:x.y,viewportWidth:x.viewportWidth,viewportHeight:x.viewportHeight})
```

- [ ] **Step 7: 타입체크·테스트**

Run: `npm run typecheck && npm test`
Expected: 오류 0, `# fail 0`

- [ ] **Step 8: Commit**

```bash
git add src/lib/heatmap-groups.ts tests/unit/heatmap-groups.test.mjs src/components/component-heatmap.tsx src/components/study-results.tsx
git commit -m "feat: show per-screen component heatmap in study results

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 전체 흐름 검증 (production 빌드) + README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1~7 전체

- [ ] **Step 1: production 빌드로 띄우기**

`toString()` 직렬화는 minify 후에 깨질 수 있으므로 반드시 production 에서 확인한다.

```bash
node node_modules/next/dist/bin/next build
MINDLENS_DATA_DIR="$(mktemp -d)" node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3200
```

Run: `BASE_URL=http://127.0.0.1:3200 npm run test:integration`
Expected: PASS

- [ ] **Step 2: 참가자 2명 진행**

브라우저로 `http://127.0.0.1:3200` 에서 샘플 연구를 만들고 참여 링크로 두 번 참여한다(두 번째는 창 너비를 다르게, 예: 모바일 폭). 각 참여에서:

- A안: 좌측 내비 버튼으로 화면 전환, 7일/30일/90일, 프로젝트 행, 알림 버튼 → 팝오버 안 항목, 새 프로젝트 다이얼로그 → 다이얼로그 안 버튼, 버튼 안 아이콘, 빈 여백
- B안: 아무 버튼 3개
- 설문·선호까지 완료

- [ ] **Step 3: 결과 히트맵 확인 (설계 7절 체크리스트)**

결과 화면 → **클릭 · 타임라인** 탭에서:

1. 화면 전환마다 별도 화면이 왼쪽 목록에 생긴다.
2. 버튼 안 아이콘을 누른 클릭이 바깥 버튼 상자에 합산된다(별도 상자 없음).
3. 7일/30일/90일이 각각 상자로 나뉜다(`#rangeControls` 하나로 뭉치지 않음).
4. 다이얼로그 안 버튼이 열린 다이얼로그 위에 상자로 표시된다.
5. 빈 여백 클릭이 주황 상자로 표시된다.
6. 두 참여자의 같은 버튼 클릭이 한 상자에 합산된다(같은 화면 스냅샷이 공유된 경우). 너비별로 시안 JS 가 DOM 을 다르게 그렸다면 화면이 둘로 나뉘는 것이 정상이다(설계 4-2 참고).
7. 오른쪽 표의 행에 마우스를 올리면 해당 상자가 굵게 강조된다.
8. 참여자 선택·버전 필터를 바꾸면 화면 목록과 상자 숫자가 같이 바뀐다.
9. 「화면에서 찾지 못함」 배지가 뜨는 컴포넌트가 없다. 있으면 경로·스냅샷을 기록해 원인을 조사한다.

하나라도 실패하면 `superpowers:systematic-debugging` 으로 원인을 찾고 해당 태스크로 돌아가 고친다.

- [ ] **Step 4: README 갱신**

`README.md` 의 `## 구현 범위` 목록에서 `- 클릭 시각·요소명·텍스트·셀렉터·좌표 기록` 줄을 다음으로 교체:

```markdown
- 클릭마다 컴포넌트(가장 바깥쪽 상호작용 요소)와 클릭 순간의 화면 스냅샷 기록 — 설계: `docs/specs/2026-10-05-component-heatmap-design.md`
- 결과 화면의 컴포넌트 히트맵: 화면별 스냅샷 위에 컴포넌트별 클릭 수(하늘색 = 버튼·링크, 주황 = 누를 수 없는 곳)
```

`## 데이터 및 시연 범위` 의 `- 클릭은 업로드한 HTML의 DOM 안에서 수집합니다. ...` 줄 아래에 추가:

```markdown
- 의뢰자가 HTML 요소에 `data-component="이름"` 을 붙이면 그 요소를 하나의 컴포넌트 경계로 강제할 수 있습니다.
- 입력창에 입력한 값과 스크롤 위치는 스냅샷에 복원되지 않습니다.
```

`## 실행` 아래에 추가:

```markdown
## 테스트

- 단위: `npm test`
- API 통합(서버 필요): `MINDLENS_DATA_DIR="$(mktemp -d)" node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100` 실행 후 `BASE_URL=http://127.0.0.1:3100 npm run test:integration`
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document component heatmap and test commands

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

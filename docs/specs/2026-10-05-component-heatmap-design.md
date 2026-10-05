# 컴포넌트 기준 클릭 히트맵 설계

- 작성일: 2026-10-05
- 근거: 2026-10-05 회의 합의 「행동 데이터는 기존 컴포넌트 방식의 클릭스트림으로 수집」
- 범위: 업로드한 단일 HTML 시안(A/B). Figma·사진·영상은 이 설계의 범위가 아니다.

## 1. 목표

결과 화면에서 **어떤 컴포넌트가 몇 번 눌렸는지**를 시안 화면 위에 직접 표시한다.
컴포넌트 이름 라벨링은 부차적이다. 핵심은 "어느 요소인가"를 정확히 가리키는 것이다.

### 성공 기준

1. 시안 안에서 화면이 바뀌어도(`data-view` 전환, 다이얼로그, `innerHTML` 재렌더) 각 클릭이
   **그 클릭 순간의 화면** 위에 표시된다.
2. 같은 컴포넌트를 누른 클릭은 참가자·화면 너비가 달라도 한 상자로 합산된다.
3. 버튼 안의 아이콘처럼 중첩된 요소를 눌러도 바깥 컴포넌트 1회로 센다.
4. 버튼·링크가 아닌 곳을 누른 클릭도 그 요소 위에 별도 색으로 표시된다.

### 현재 문제

`participant-runner.tsx` 의 주입 스크립트는 컴포넌트 이름을 `aria-label → name → 태그명` 으로
정한다. `aria-label` 이 없는 버튼은 전부 `button` 하나로 묶인다(데모 A안 26개 중 13개, B안 17개 중 3개).
결과의 「클릭 위치 분포」는 뷰포트 기준 좌표 점이라 배경 화면이 없고 스크롤·너비가 다르면 겹친다.

## 2. 결정 사항

| 쟁점 | 결정 | 이유 |
|---|---|---|
| 첫 화면에 없는 컴포넌트 | **클릭 순간 DOM 스냅샷** 저장 | 데모 시안이 모두 화면을 전환한다. 첫 화면 위에만 그리면 대부분의 클릭이 자리를 잃는다 |
| 중첩된 상호작용 요소 | **가장 바깥쪽** 컴포넌트로 센다 | 사용자 결정. 카드 안 버튼은 카드로 합산된다 |
| 비상호작용 요소 클릭 | **누른 요소 기준으로 기록·표시**, 다른 색 | 눌릴 줄 알았는데 안 눌리는 곳을 찾는 신호 |
| 기각: 좌표 상자만 저장 | — | 배경이 없어 지금의 점 분포와 다르지 않다 |
| 기각: rrweb 등 DOM 녹화 | — | 회의에서 미룬 「화면 녹화」에 해당 |

## 3. 컴포넌트 판별 (시안 주입 스크립트)

### 3-1. 실행 시점

주입 스크립트는 `<head>` 맨 앞에 들어가 **시안 스크립트보다 먼저** 실행된다(현재 `instrument()` 와 같은 위치).
`<head>` 가 없으면 문서 맨 앞에 둔다.

### 3-2. 클릭 리스너 감지

`EventTarget.prototype.addEventListener` 를 감싸서, `click`·`pointerdown`·`pointerup`·`mousedown`·
`mouseup`·`touchstart`·`touchend` 리스너가 붙는 **Element** 를 `WeakSet` 에 표시한다.
`window`·`document`·`<html>`·`<body>` 는 표시하지 않는다(전역 위임은 컴포넌트가 아니다).

### 3-3. 상호작용 요소

다음 중 하나면 상호작용 요소다.

- `a[href]`, `button`, `input`(hidden 제외), `select`, `textarea`, `label`, `summary`
- `role` 이 `button|link|tab|menuitem|checkbox|radio|switch|option` 중 하나
- `[onclick]` 속성, `tabindex` 가 0 이상
- 3-2 에서 표시된 요소
- `[data-component]` (의뢰자가 명시한 경계)

### 3-4. 컴포넌트 결정

1. 클릭 대상에서 `<body>` 직전까지 조상을 올라가며 상호작용 요소를 모은다.
2. **컨테이너 제외**: 요소 면적이 뷰포트 면적의 60% 이상이면 후보에서 뺀다
   (이벤트 위임용 `#app` 래퍼가 모든 클릭을 삼키는 것을 막는다).
3. 남은 후보 중 **가장 바깥쪽**을 컴포넌트로 하고 `kind = 'interactive'`.
4. 후보가 없으면 클릭 대상 자체를 컴포넌트로 하고 `kind = 'static'`.
   대상이 `<body>`·`<html>` 이면 `kind = 'static'`, 경로는 `body`.

이 결정 로직은 DOM 에 의존하지 않는 순수 함수로 분리한다. 입력은 조상 목록
(각 항목: 상호작용 여부, 면적)과 뷰포트 면적이고, 출력은 선택된 인덱스와 `kind` 다.
주입 스크립트는 이 함수를 문자열로 직렬화해 넣는다 — 같은 로직이 두 벌 생기지 않게 한다.

### 3-5. 경로

컴포넌트의 경로는 `<body>` 에서 그 요소까지의 `tag:nth-of-type(n)` 체인이다
(예: `body>main:nth-of-type(1)>section:nth-of-type(2)>button:nth-of-type(1)`).
`id` 는 시안이 중복 id 를 만들 수 있어 쓰지 않는다. 같은 스냅샷 안에서는 항상 같은 요소를 가리킨다.

### 3-6. 스냅샷

`window` 의 **캡처 단계** 클릭 리스너에서 기록한다. 시안의 핸들러보다 먼저 실행되므로
화면이 바뀌기 **전**, 사용자가 보고 누른 화면이 남는다.

- 직렬화: `document.documentElement.outerHTML`. 주입한 `<meta>`·`<script>` 는 `data-mindlens`
  속성으로 표시해 두고 직렬화 결과에서 제거한다.
- `postMessage` 로 부모에 전달: `{type:'mindlens-click', html, componentPath, kind, tag, text, x, y, viewportWidth, viewportHeight}`.
  `text` 는 지금처럼 컴포넌트의 보이는 텍스트 180자, 이름이 필요한 곳의 라벨로만 쓴다.

## 4. 저장

### 4-1. 화면 해시

부모 창(`participant-runner`)이 받은 `html` 의 SHA-256(`crypto.subtle`)을 계산한다.
iframe 은 불투명 origin 이라 보안 컨텍스트가 보장되지 않으므로 해시는 부모에서 한다.

### 4-2. 테이블

```sql
CREATE TABLE IF NOT EXISTS screens (
  id TEXT PRIMARY KEY,              -- `${studyId}:${variant}:${hash}`
  studyId TEXT NOT NULL REFERENCES studies(id),
  variant TEXT NOT NULL,
  hash TEXT NOT NULL,
  html TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS screens_study ON screens(studyId, variant);
```

해시만 PK 로 쓰면 같은 HTML 을 올린 다른 연구와 충돌하므로 연구·시안을 접두어로 붙인다.
같은 연구·시안 안에서는 참여자가 달라도 같은 화면이 한 행으로 합쳐진다.
클릭 이벤트는 이 `id` 를 `screenId` 로 참조한다.

참고: 화면 너비에 따라 시안 JS 가 다른 DOM 을 그리면(반응형 재렌더) 해시가 달라져 다른 화면으로 나뉜다.
CSS 미디어쿼리만으로 바뀌는 반응형은 DOM 이 같으므로 한 화면으로 합쳐진다.

### 4-3. 클릭 이벤트 필드 추가

`ClickEvent` 에 `screenId?: string`, `componentPath?: string`, `kind?: 'interactive'|'static'` 을 추가한다.
기존 필드(`component`·`text`·`selector`·좌표)는 유지한다 — CSV·타임라인·AI 인터뷰 맥락이 쓴다.
`component` 는 3-4 로 정한 컴포넌트의 `aria-label` → 텍스트 앞 40자 → 태그명 순으로 채운다.

### 4-4. API

`POST /api/sessions/[id]/screens` — `{variant, hash, html}`.

- 세션이 완료됐으면 409(`mutableSession`).
- `variant` 검증, `hash` 는 64자리 16진수, `html` 은 2MB 이하.
- 서버가 `html` 의 SHA-256 을 다시 계산해 `hash` 와 다르면 400 — 클라이언트가 다른 화면을 같은 키로 덮지 못하게 한다.
- 이미 있으면 덮지 않고 200 (`INSERT ... ON CONFLICT DO NOTHING`).

`POST /api/sessions/[id]/events` 는 `screenId` 가 있으면 그 화면이 같은 연구·시안에 존재하는지 확인하고 없으면 400.

### 4-5. 클라이언트 전송 순서

`participant-runner` 는 보낸 해시를 `Set` 으로 기억하고, 새 해시의 화면을 대기열에 둔다.
`flush()` 는 **화면 대기열을 먼저 보낸 뒤** 이벤트를 보낸다. 화면 전송이 실패하면 이벤트도 보내지 않고
다음 주기에 다시 시도한다(이벤트가 없는 화면을 가리키는 상태를 만들지 않는다).

## 5. 결과 화면 — 히트맵

「클릭 · 타임라인」 탭의 「클릭 위치 분포」(좌표 점)를 히트맵으로 교체한다. 타임라인·컴포넌트 표·CSV 는 유지한다.

### 5-1. 데이터

`GET /api/studies/[id]/results` 에 화면 목록을 추가한다: `screens: {id, variant, clickCount}[]` (HTML 제외).
스냅샷 HTML 은 `GET /api/studies/[id]/screens/[screenId]` 로 따로 받는다(결과 전체가 무거워지지 않게).
이 응답은 `Content-Security-Policy: sandbox allow-scripts` 로 내려준다.

### 5-2. 화면 구성

- **왼쪽**: 현재 필터(참여자·시안)에 해당하는 화면 목록, 클릭 많은 순. 항목 = 시안 배지 + 클릭 수 + 대표 컴포넌트 텍스트.
- **가운데**: 고른 스냅샷을 `sandbox="allow-scripts"` iframe 에 띄운다.
  렌더 전 스냅샷에서 시안의 `<script>` 와 `on*` 속성을 제거하고 오버레이 스크립트 하나만 넣는다
  (시안 스크립트가 다시 실행돼 DOM 을 바꾸면 경로가 어긋난다).
- **오버레이 스크립트**: 부모가 `postMessage` 로 `[{componentPath, count, kind}]` 를 보내면
  `querySelector` 로 요소를 찾아 상자와 숫자 배지를 그린다. 색 농도는 클릭 수 / 그 화면 최대 클릭 수.
  `interactive` 는 하늘색(`#00A4DF`), `static` 은 주황(`#F18134`).
  - 열려 있던 `<dialog open>` 은 `open` 을 지우고 `showModal()` 로 다시 연다. 다이얼로그 안 요소의 상자는
    그 다이얼로그 안에 붙인다(톱 레이어 위에 그려지도록).
  - 경로로 요소를 못 찾으면 부모에 알려 오른쪽 표에 「화면에서 찾지 못함」으로 표시한다.
- **오른쪽**: 이 화면의 컴포넌트별 클릭 수 표. 행에 마우스를 올리면 해당 상자를 강조한다.

### 5-3. 기존 데이터

`screenId` 가 없는 이전 클릭은 히트맵에 그리지 않고 화면 목록 아래 「스냅샷 없는 클릭 N회」로만 알린다.
로컬 데모 DB 라 마이그레이션은 하지 않는다.

## 6. 범위 밖

- 입력창에 사용자가 입력한 값, 스크롤 위치 복원
- 컴포넌트 이름 라벨링 기능
- 화면 녹화, 마우스 이동·스크롤 기록
- 화면 해시의 근사 동일성 판정(텍스트만 다른 목록을 같은 화면으로 묶기) — 우선 정확히 같은 HTML 만 묶는다

## 7. 검증

### 자동

`node` 테스트(기존 `tests/*.test.mjs` 방식):

- 컴포넌트 결정 순수 함수: 가장 바깥쪽 선택, 60% 컨테이너 제외, 후보 없음 → `static`
- 서버 화면 저장: 해시 불일치 400, 같은 해시 재전송 시 1행 유지, 완료 세션 409
- 이벤트 저장: 존재하지 않는 `screenId` 400

### 실제 실행

앱을 띄우고 데모 연구로 참가자 흐름을 진행하며, A안에서 화면 전환·다이얼로그·목록 안 버튼·아이콘·빈 여백을 클릭한다.
결과 히트맵에서 다음을 브라우저로 확인한다.

1. 화면 전환마다 별도 화면이 목록에 생긴다.
2. 아이콘을 눌러도 바깥 버튼 상자에 합산된다.
3. 다이얼로그 안 버튼이 열린 다이얼로그 위에 표시된다.
4. 빈 여백 클릭이 주황 상자로 표시된다.
5. 창 너비를 바꿔 참여한 두 세션의 같은 버튼 클릭이 한 상자로 합산된다.

# 과업 기반 테스트 설계

- 작성일: 2026-10-05
- 결정자: 사용자와 대화로 확정(아래 「결정 사항」)

## 1. 목표

의뢰자가 직접 과업과 완료 기준을 설정하고, 참가자는 시안마다 **자유 탐색 → 과업 1…N → 설문** 순서로 진행한다.
결과 화면은 과업 × 시안별 성공률·소요 시간·첫 클릭 정확도·헛클릭과 실패 지점을 A/B 로 비교해 보여준다.

## 2. 결정 사항

| 항목 | 결정 |
|---|---|
| 완료 기준 | **목표 컴포넌트 클릭** 또는 **목표 상태**(특정 요소의 값이 X 가 됨 — 예: Orbit 의 상태가 '주의'). 둘 다 지정하면 하나만 맞아도 성공. (초안의 「목표 문구 등장」은 폐기 — 문구는 화면에 우연히 있을 수 있어 과업 달성을 증명하지 못한다) |
| 기준 지정 단위 | **시안별**(A·B 구조가 다르므로). 각 시안에 기준이 하나 이상 있어야 저장 가능 |
| 진행 순서 | 자유 탐색(기존 체험 시간) → 과업 1 → … → 설문 |
| 실패 | 제한 시간 초과 / 참가자 「포기할게요」 |
| 기록 | 과업 중에도 히트맵·경로 기록 유지. **자유 탐색은 흐름(경로) 화면에서 제외**, 히트맵 집계에만 사용 |
| AI 인터뷰 | 자유 탐색 중에만. 과업 중엔 질문하지 않는다(소요 시간 오염 방지) |
| 범위 밖 | 기대 경로(바로/돌아서 성공), 참가자 자기 보고, 과업 순서 섞기 |
| 한도 | 과업 최대 5개, 지시문 1~300자, 제한 시간 15~600초(기본 120), 목표 값 1~200자 |

## 3. 데이터 계약 (이미 커밋됨 — 작업자는 바꾸지 않는다)

`src/lib/types.ts`

- `StateCriterion { anchor?; anchorIndex?; path; property: 'text'|'value'|'checked'|'attr'; attr?; expected; match: 'equals'|'contains'; label? }`
  - `anchor`: 고른 요소에서 body 쪽으로 올라가며 처음 만나는 안정 조상(`#id`(문서 안에서 유일할 때) 또는 `[data-*-id|data-setting|data-id|data-key="…"]`)의 선택자. 없으면 body.
  - `anchorIndex`: 같은 선택자가 여러 요소와 맞을 때(보드 카드·목록 행·상세 패널) `querySelectorAll(anchor)` 안에서 **고른 요소의 순번**. 0 이면 생략. 선택 시 보이는 조상을 우선한다.
  - `path`: 앵커 기준 `tag:nth-of-type(n)` 사슬(''=앵커 자신). `expected`: 목표 값. `match`: 공백 제거·소문자 후 일치/포함. `label`: 화면 표시용.
- `TaskCriteria { componentPath?; componentLabel?; state? }` (시안마다 컴포넌트·상태 중 하나 이상)
- `StudyTask { id ('t1'..); instruction; timeLimitSeconds; criteria: Record<Variant, TaskCriteria> }`, `Study.tasks?: StudyTask[]`
- `TaskOutcome = 'success'|'timeout'|'gave_up'`
- `TaskAttempt { taskId; variant; outcome; matchedBy? ('component'|'state'); durationMs; clickCount; firstClickCorrect?; evidenceScreenId?; evidenceProof? (상태 성공 때 맞은 요소의 outerHTML, ≤20000자); lastScreenId?; verified?; sessionId?; createdAt? }`
- `ClickEvent.phase?: string` — `'free'` 또는 `` `task:${taskId}` ``. 값이 없는 옛 이벤트는 자유 탐색으로 취급. `ParticipantComment.phase?` 도 같다.
- 시간 기준: `elapsedMs` = 이벤트가 속한 단계(phase)의 시작으로부터의 ms. phase 'free' 또는 없음 = 체험 시작 기준(재개 시 이어짐), `task:tN` = 그 과업 iframe 로드 시점 기준(`TaskAttempt.durationMs` 와 같은 기준). 서로 다른 단계의 값은 비교할 수 없다 — 정렬·min·max 전에 단계별로 묶을 것.
- `StudyResults.taskAttempts: TaskAttempt[]`

`src/lib/task-rules.ts` (값 import 없음, Node 테스트 가능)

- `parseTasks(raw)` — 의뢰자 입력 검증, id 를 `t1..tN` 으로 서버가 다시 붙인다. 오류는 한국어 `Error`.
- `matchTask(criteria, {componentPath?, label?}) → 'component'|null` — 컴포넌트 기준만. 참가자 iframe 과 서버가 같은 함수로 판정. toString 직렬화 가능.
  - 컴포넌트: 경로가 같거나, 라벨(공백·대소문자 무시)이 같으면 성공(목록 재렌더로 경로가 바뀌는 경우 대비).
- `readState(state, doc) → string|null`, `stateMatches(state, observed) → boolean` — 참가자 iframe 에서 상태를 읽고 비교한다. toString 직렬화 가능.
  - 읽기: text=`innerText`, value=`.value`, checked=`'true'|'false'`, attr=`getAttribute`. 요소가 없으면 null(=불일치).
- `htmlToText(html)`, `verifyAttempt(task, variant, attempt, clicks, evidenceHtml, evidenceProof)` — 서버 재검증.

`src/lib/db.ts`

- 테이블 `task_attempts(sessionId, taskId, variant, payload, UNIQUE(sessionId,taskId,variant))`
- `addTaskAttempts(sessionId, attempts) → 저장 수` (같은 시도 재전송은 무시 — 멱등)
- `results()` 가 `taskAttempts` 를 포함

## 4. 판정과 재검증

- 참가자 iframe 이 즉시 판정한다.
  - 컴포넌트: 클릭 순간(캡처 단계, 시안 핸들러 전).
  - 상태: 과업 시작 **후** 클릭(약 150·600ms 뒤)·`input`/`change`(약 50ms)·DOM 변화(디바운스 150ms)에서 `readState`→`stateMatches` 로 확인. 과업 시작 순간에는 확인하지 않는다
    → 첫 화면에 이미 목표 값이면 첫 동작 직후 성공 처리되므로, 설정 화면이 그 경우를 경고한다.
  - 상태 성공 시 그 순간의 화면 스냅샷(`evidenceScreenId`)과 맞은 요소의 `outerHTML`(`evidenceProof`)을 함께 저장한다(클릭 스냅샷은 클릭 *전* 상태라 성공 화면이 남지 않기 때문).
  - 스냅샷은 `input`·`select`·`textarea` 의 라이브 값(프로퍼티)을 복제본의 속성(`value`·`checked`·`selected`·textarea 내용)으로 옮겨 직렬화한다(비밀번호·파일 입력 제외) — 증거 화면과 히트맵이 참가자가 본 값을 보여 준다.
- 서버 `verifyAttempt`(상태): 근거 화면이 있고 · `evidenceProof` 가 비어 있지 않고 · 근거 화면에 그대로 들어 있고 · 앵커의 `id="…"`/`attr="…"` 문자열이 증명 끝 이전에 나오고 · 증명 자신의 값(text→`htmlToText`, value→루트 태그 `value`(select 는 selected option), checked→루트 태그의 `checked` 유무, attr→루트 태그 속성)이 `stateMatches` 를 만족해야 한다.
  - **한계(문자열 기반)**: Node 에는 DOM 이 없다. 같은 증명 문자열이 화면에 여러 번 나오면 앵커 뒤의 어느 한 곳이면 통과하고, `anchorIndex` 로 정확히 어느 요소인지는 서버가 확인하지 않는다. 즉 서버 검증은 「조작되지 않은 근거 화면에 이 값을 가진 요소가 앵커 부근에 있다」까지만 보증한다(클라이언트가 위조한 증명·화면 쌍은 막지 못한다). `htmlToText` 는 숨겨진 DOM 텍스트도 포함해 iframe 의 `innerText` 보다 관대하다.
- 서버는 `verifyAttempt` 로 다시 확인해 `verified` 를 저장한다. 실패해도 시도를 거부하지 않는다(영구 400 이 참가자 저장 대기열을 막지 않게).
  결과 지표의 **성공은 `outcome==='success' && verified`** 만 센다. 검증 실패 건은 따로 표시한다.

## 5. 화면

- 의뢰자: 연구 생성 모달의 「과업」 편집기 + 연구 결과 「연구 개요」 탭의 과업 패널(참여 전만 수정 가능, 409).
  목표 컴포넌트는 시안 미리보기에서 **탐색 모드 ↔ 선택 모드**를 오가며 직접 찍는다(의견 남기기의 선택 기능 재사용).
- 참가자: 과업마다 시안을 첫 상태로 다시 불러오고, 지시문 카드·남은 시간·「포기할게요」를 보여준다. 성공 시 「완료!」 후 다음 과업.
- 결과: 새 「과업」 탭(과업 × 시안 비교, 실패 지점 화면). 흐름 타임라인은 과업 연구에서 과업 구간만 과업별로, 과업이 없는 연구는 기존처럼 전체.
  히트맵은 「전체 / 자유 탐색 / 과업 N」 필터.

## 6. 범위 밖 · 알려진 동작

- 설문 전에 모든 과업을 시도했는지는 서버가 강제하지 않는다(UI 가 강제). 서버 측 강제는 범위 밖.
- 과업 기준(목표 컴포넌트·상태)은 `GET /api/studies/:id` 로 참가자에게 보인다. 설계상 의도다.
- 목표 상태가 시안에서 비동기·애니메이션으로 바뀌면 참가자 행동 없이도 성공 처리될 수 있다(DOM 변화마다 확인하므로).
- 상태 기준은 앵커가 없는 시안(id·data-*-id 가 없음)에서는 body 기준 nth-of-type 경로라 DOM 구조가 바뀌면 깨진다 — 시안에 `data-project-id` 같은 안정 속성을 달아 두는 것을 권장한다.

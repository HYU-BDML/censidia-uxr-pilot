# 과업 기반 테스트 설계

- 작성일: 2026-10-05
- 결정자: 사용자와 대화로 확정(아래 「결정 사항」)

## 1. 목표

의뢰자가 직접 과업과 완료 기준을 설정하고, 참가자는 시안마다 **자유 탐색 → 과업 1…N → 설문** 순서로 진행한다.
결과 화면은 과업 × 시안별 성공률·소요 시간·첫 클릭 정확도·헛클릭과 실패 지점을 A/B 로 비교해 보여준다.

## 2. 결정 사항

| 항목 | 결정 |
|---|---|
| 완료 기준 | **목표 컴포넌트 클릭** 또는 **목표 문구 등장**. 둘 다 지정하면 하나만 맞아도 성공 |
| 기준 지정 단위 | **시안별**(A·B 구조가 다르므로). 각 시안에 기준이 하나 이상 있어야 저장 가능 |
| 진행 순서 | 자유 탐색(기존 체험 시간) → 과업 1 → … → 설문 |
| 실패 | 제한 시간 초과 / 참가자 「포기할게요」 |
| 기록 | 과업 중에도 히트맵·경로 기록 유지. **자유 탐색은 흐름(경로) 화면에서 제외**, 히트맵 집계에만 사용 |
| AI 인터뷰 | 자유 탐색 중에만. 과업 중엔 질문하지 않는다(소요 시간 오염 방지) |
| 범위 밖 | 기대 경로(바로/돌아서 성공), 참가자 자기 보고, 과업 순서 섞기 |
| 한도 | 과업 최대 5개, 지시문 1~300자, 제한 시간 15~600초(기본 120), 목표 문구 1~200자 |

## 3. 데이터 계약 (이미 커밋됨 — 작업자는 바꾸지 않는다)

`src/lib/types.ts`

- `TaskCriteria { componentPath?; componentLabel?; text? }`
- `StudyTask { id ('t1'..); instruction; timeLimitSeconds; criteria: Record<Variant, TaskCriteria> }`, `Study.tasks?: StudyTask[]`
- `TaskOutcome = 'success'|'timeout'|'gave_up'`
- `TaskAttempt { taskId; variant; outcome; matchedBy?; durationMs; clickCount; firstClickCorrect?; evidenceScreenId?; lastScreenId?; verified?; sessionId?; createdAt? }`
- `ClickEvent.phase?: string` — `'free'` 또는 `` `task:${taskId}` ``. 값이 없는 옛 이벤트는 자유 탐색으로 취급.
- `StudyResults.taskAttempts: TaskAttempt[]`

`src/lib/task-rules.ts` (값 import 없음, Node 테스트 가능)

- `parseTasks(raw)` — 의뢰자 입력 검증, id 를 `t1..tN` 으로 서버가 다시 붙인다. 오류는 한국어 `Error`.
- `matchTask(criteria, {componentPath?, label?, pageText?}) → 'component'|'text'|null` — **참가자 iframe 과 서버가 같은 함수로 판정**. toString 직렬화 가능.
  - 컴포넌트: 경로가 같거나, 라벨(공백·대소문자 무시)이 같으면 성공(목록 재렌더로 경로가 바뀌는 경우 대비).
  - 문구: 공백 제거·소문자 후 포함 여부.
- `htmlToText(html)`, `verifyAttempt(task, variant, attempt, clicks, evidenceHtml)` — 서버 재검증.

`src/lib/db.ts`

- 테이블 `task_attempts(sessionId, taskId, variant, payload, UNIQUE(sessionId,taskId,variant))`
- `addTaskAttempts(sessionId, attempts) → 저장 수` (같은 시도 재전송은 무시 — 멱등)
- `results()` 가 `taskAttempts` 를 포함

## 4. 판정과 재검증

- 참가자 iframe 이 즉시 판정한다.
  - 컴포넌트: 클릭 순간(캡처 단계, 시안 핸들러 전).
  - 문구: 과업 시작 **후** 클릭이나 DOM 변화가 있을 때 `document.body.innerText` 로 확인. 과업 시작 순간에는 확인하지 않는다
    → 첫 화면에 이미 있는 문구는 첫 클릭 직후 성공 처리되므로, 설정 화면이 그 경우를 경고한다.
  - 문구 성공 시 그 순간의 화면 스냅샷을 근거(`evidenceScreenId`)로 함께 저장한다(클릭 스냅샷은 클릭 *전* 상태라 성공 화면이 남지 않기 때문).
- 서버는 `verifyAttempt` 로 다시 확인해 `verified` 를 저장한다. 실패해도 시도를 거부하지 않는다(영구 400 이 참가자 저장 대기열을 막지 않게).
  결과 지표의 **성공은 `outcome==='success' && verified`** 만 센다. 검증 실패 건은 따로 표시한다.

## 5. 화면

- 의뢰자: 연구 생성 모달의 「과업」 편집기 + 연구 결과 「연구 개요」 탭의 과업 패널(참여 전만 수정 가능, 409).
  목표 컴포넌트는 시안 미리보기에서 **탐색 모드 ↔ 선택 모드**를 오가며 직접 찍는다(의견 남기기의 선택 기능 재사용).
- 참가자: 과업마다 시안을 첫 상태로 다시 불러오고, 지시문 카드·남은 시간·「포기할게요」를 보여준다. 성공 시 「완료!」 후 다음 과업.
- 결과: 새 「과업」 탭(과업 × 시안 비교, 실패 지점 화면). 흐름 타임라인은 과업 연구에서 과업 구간만 과업별로, 과업이 없는 연구는 기존처럼 전체.
  히트맵은 「전체 / 자유 탐색 / 과업 N」 필터.

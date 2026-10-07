# Censidia UXR Pilot — MindLens UXR 시연 플랫폼

HTML 프로토타입 두 개(A/B)를 실제 사람이 써 보게 하고, **클릭 행동 · 과업 수행 · AI 인터뷰 · 설문**을 한곳에서 모아 비교하는
사용자 경험 리서치(UXR) 파일럿입니다. 로컬 시연용이며 로그인은 없습니다.

---

## 빠른 실행

### 1. 준비물

- **Node.js 22.13 이상** (내장 `node:sqlite`를 씁니다. `node -v`로 확인)
- npm (Node에 포함)

### 2. 설치

```bash
git clone https://github.com/HYU-BDML/censidia-uxr-pilot.git
cd censidia-uxr-pilot
npm install
```

### 3. 환경변수 (선택 — 없어도 실행됩니다)

```bash
cp .env.example .env.local
```

`.env.local`을 열어 키를 넣습니다. 키가 없으면 AI 인터뷰는 **데모 질문**으로, 음성 전사는 **직접 입력 안내**로 대체됩니다.

| 변수 | 용도 | 비고 |
|---|---|---|
| `KIMI_API_KEY` | AI 인터뷰 질문 생성 | Moonshot **국제판** 키 (`https://api.moonshot.ai/v1`에서만 인증됨) |
| `KIMI_BASE_URL` | Kimi API 주소 | 기본 `https://api.moonshot.ai/v1` |
| `KIMI_INTERVIEW_MODEL` | 질문 생성 모델 | 기본 `kimi-k3` |
| `KIMI_THINKING` | 생각하기 모드 | 기본 `disabled` (켜면 느려지고 짧은 답이 비어 올 수 있음) |
| `OPENAI_API_KEY` | 음성 전사(Whisper) | 크레딧이 있어야 동작 |
| `OPENAI_TRANSCRIBE_MODEL` | 전사 모델 | 기본 `whisper-1` |
| `MINDLENS_SPEECH_API_URL` / `_TOKEN` | 별도 전사 서버(선택) | 설정되면 OpenAI보다 우선 |
| `MINDLENS_DATA_DIR` | 데이터 폴더(선택) | 기본 `./data` |

> `.env.local`은 git에 올라가지 않습니다(`.gitignore`). 키를 커밋하지 마세요.

### 4. 실행

```bash
npm run dev        # 개발 모드 → http://localhost:3000
```

또는 실제 배포에 가까운 모드로:

```bash
npm run build
npm start          # → http://localhost:3000
```

- `npm run dev` / `npm start`는 `0.0.0.0`으로 열려서 같은 와이파이의 다른 기기(휴대폰 등)에서도 `http://<내 IP>:3000`으로 참여할 수 있습니다.
- macOS에서는 `start.command`를 더블클릭해도 설치 → 빌드 → 실행이 한 번에 됩니다.
- 실행 로그의 `ExperimentalWarning: SQLite is an experimental feature`는 정상입니다.

### 5. 바로 써 보기 (약 15분)

1. http://localhost:3000 → **의뢰자** 이름 입력 → **샘플 연구로 둘러보기**
   (예제 목업 A/B로 연구가 만들어집니다. 같은 이름으로 다시 누르면 같은 연구로 들어갑니다.)
2. 결과 화면의 **참여 화면 열기** → 참가자 이름 → **텍스트로 시작**(또는 마이크 연결)
3. 버전마다 5분 동안 자유롭게 둘러보고, 설문에 답하고, 마지막에 A/B 선호를 고릅니다.
4. 결과 화면에서 히트맵 · 사용자 흐름 · 설문 · 인터뷰 · 참가자 의견을 확인합니다.

---

## 주요 기능

### 의뢰자 (연구 만들기)
- A/B **단일 HTML 파일** 업로드 (CSS·JS 내장, 외부 리소스 없이)
- **직접 만든 질문**: 객관식 · 주관식, 최대 10개 (기본 5문항 뒤에 이어서 출제)
- **과업 기반 테스트**: 과업 최대 5개, 과업마다 지시문 · 제한 시간 · **시안별 완료 기준**
  - **목표 컴포넌트 클릭** — 미리보기에서 탐색 모드로 원하는 화면까지 간 뒤 선택 모드로 버튼을 찍어 지정
  - **목표 상태** — 요소의 값이 기대값이 되면 성공 (예: "Orbit 모바일 앱의 상태를 '주의'로", "작업 '접근성 점검' 완료")
  - 첫 참가자가 시작하기 전까지 연구 화면에서 과업을 수정할 수 있습니다

### 참가자 (참여 화면)
- 진행 순서: **자유 탐색(시안별 5분) → 과업 1…N → 설문** → (다음 버전) → A/B 선호
- 시안은 AB/BA 순서로 번갈아 노출
- **AI 인터뷰어**(자유 탐색 중): 클릭과 답변을 근거로 짧은 후속 질문, 음성 읽기 지원
- 음성 답변 녹음 + 전사, 마이크 없이 텍스트 참여 가능
- **의견 남기기**: 시안의 컴포넌트를 골라 의견을 남김 (시안은 반응하지 않음)
- 과업은 시안 안에서 즉시 판정되어 「완료!」 후 다음 과업으로 넘어가고, 서버가 저장된 근거로 다시 검증

### 결과 화면
- **컴포넌트 히트맵**: 클릭 순간의 화면 스냅샷 위에 컴포넌트별 클릭 수 (하늘색 = 버튼·링크, 주황 = 누를 수 없는 곳), 전체/자유 탐색/과업 N 필터
- **사용자 흐름 타임라인**: 참여자 × 버전별로 지나간 화면과 클릭을 시간 순서대로(오른쪽이 나중)
- **과업 탭**: 과업 × 시안별 성공률 · 소요 시간 · 첫 클릭 정확도 · 헛클릭 · 실패 지점 화면
- 설문 분포(직접 만든 질문 포함), 인터뷰 원문 · 녹음, 참가자 의견, A/B 선호와 이유
- **CSV / JSON 내보내기**, 인쇄용 리포트

---

## 목업 시안 (`public/demo/`)

| 파일 | 구성 |
|---|---|
| `variant-a.html` | 좌측 사이드바 + 표/목록 중심 + 오른쪽 드로어 상세 |
| `variant-b.html` | 상단 탭 + 상태별 보드(칸반) + 넓은 상세 패널 |

두 시안은 **같은 데이터(프로젝트 12개 · 멤버 8명 · 알림 8개)와 같은 기능**을 갖고 화면 구성만 다릅니다.
프로젝트 상태·우선순위·담당자·마감일·진행률 변경, 작업 체크리스트, 댓글, 보관/삭제, 일괄 변경, 팀 관리, 알림, 설정(테마·언어 등)을 지원합니다.

### 내 HTML로 과업을 만들 때
- 과업 판정은 DOM을 읽습니다. 값이 바뀌면 **화면의 텍스트·속성이 실제로 바뀌어야** 판정할 수 있습니다.
- 요소에 고정 식별자를 붙이면 목록이 다시 그려져도 같은 요소를 찾습니다:
  `data-project-id="…"`, `data-task-id="…"`, `data-field="status"`, `data-setting="…"` 등 (`data-*-id`, `id` 모두 인식)
- `data-component="이름"`을 붙이면 그 요소를 하나의 컴포넌트로 강제할 수 있습니다.
- 시안은 샌드박스 iframe에서 돌아갑니다: `localStorage`·쿠키·`fetch`·외부 스크립트·`alert/confirm`을 쓸 수 없습니다.

---

## 테스트

```bash
npm test                 # 단위 테스트
npm run typecheck        # 타입 검사
```

API 통합 테스트는 서버가 떠 있어야 합니다. 테스트와 서버가 **같은 임시 데이터 폴더**를 써야 합니다.

```bash
export MINDLENS_DATA_DIR="$(mktemp -d)"
npm run build && npx next start --hostname 127.0.0.1 --port 3100 &
BASE_URL=http://127.0.0.1:3100 npm run test:integration
```

---

## 프로젝트 구조

```
src/
  app/                 Next.js App Router 페이지와 API 라우트
    page.tsx           시작 화면 (의뢰자/참가자 입장)
    workspace/         의뢰자 워크스페이스 · 연구 결과
    test/[studyId]/    참가자 참여 화면
    api/               studies · sessions(events/screens/comments/task-attempts/…) · screens · transcribe · status
  components/          화면 컴포넌트 (참여 러너, 결과, 히트맵, 흐름, 과업 편집기 등)
  lib/
    server.ts          API 핸들러와 입력 검증
    db.ts              SQLite 저장소
    instrument.ts      시안 iframe에 주입하는 클릭·스냅샷·과업 판정 스크립트
    task-rules.ts      과업 기준 검증 · 판정 · 서버 재검증 (iframe과 서버가 같은 함수 사용)
    kimi.ts            Kimi(Moonshot) 호출
public/demo/           예제 목업 A/B
tests/unit|integration 단위 · API 통합 테스트
docs/specs, docs/plans 설계 문서와 구현 계획
```

데이터는 `data/mindlens.sqlite`(SQLite)와 `data/recordings/`(녹음 파일)에 저장되며 git에 올라가지 않습니다.

---

## 한계와 주의사항

- **로그인이 없습니다.** 이름이 곧 워크스페이스이고, 연구 ID를 알면 결과를 볼 수 있습니다. 공개 서버에 그대로 배포하지 마세요.
- 서버는 참가자가 모든 과업을 수행했는지 강제하지 않습니다(화면 흐름으로만 보장).
- 과업 완료 기준(목표 컴포넌트·상태)은 참가자 화면에서도 조회됩니다.
- 상태 기준의 서버 재검증은 HTML 문자열 대조 방식이라, 같은 식별자를 가진 요소가 여럿일 때 찍은 위치까지는 확인하지 못합니다.
- 화면 스냅샷은 입력값·체크 상태는 남기지만 스크롤 위치는 복원하지 않습니다. 화면 녹화는 하지 않습니다.
- 음성 녹음은 답변 전송 또는 체험 종료 때 저장됩니다. 그 전에 새로고침하면 현재 녹음 구간은 사라집니다.
- 결과는 수집 표본의 기술 통계이며 통계적 유의성 검정은 포함하지 않습니다.

설계 근거: `docs/specs/2026-10-05-component-heatmap-design.md`, `docs/specs/2026-10-05-task-testing-design.md`

# MindLens UXR 시연 플랫폼

## 실행

- 주소: http://localhost:3000
- `start.command`를 실행하면 빌드 후 로컬 서버를 시작합니다. 기존 3000번 서버가 실행 중이면 먼저 종료하세요.
- Node.js 22.13 이상이 필요합니다. 현재 Mac에서는 `/opt/homebrew/bin/node`를 사용합니다.
- 개발: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1`
- 빌드: `node node_modules/next/dist/bin/next build`

## 테스트

- 단위: `npm test`
- API 통합(서버 필요): `MINDLENS_DATA_DIR="$(mktemp -d)" node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100` 실행 후 `BASE_URL=http://127.0.0.1:3100 npm run test:integration`

## 회의 시연 순서

1. 시작 화면에서 의뢰자 이름을 입력합니다.
2. **샘플 연구로 둘러보기**로 예제 HTML로 연구를 시작합니다. 가짜 응답은 생성되지 않으며 화면마다 5분입니다.
3. 실제 테스트는 워크스페이스에서 A/B HTML을 업로드합니다. 기본 체험 시간은 시안별 5분입니다.
4. 참여 링크를 새 탭에서 열고 참가자 이름을 입력합니다.
5. 마이크 연결 후 체험하거나 텍스트로 시작합니다. AI는 클릭과 발화 내용을 참고해 질문합니다.
6. 시안별 5개 설문에 응답하고 최종 A/B 선호도를 선택합니다.
7. 결과 화면에서 선호도, 문항별 분포, 참가자별 클릭 타임라인, 인터뷰·녹음을 확인합니다.

## 구현 범위

- 이름 기반 워크스페이스, 연구 검색·필터, A/B HTML 업로드 및 미리보기
- AB/BA 교대 노출, 시간 제한 자유 탐색, 시안별 설문과 기타 서술 응답
- 클릭마다 컴포넌트(가장 바깥쪽 상호작용 요소)와 클릭 순간의 화면 스냅샷 기록 — 설계: `docs/specs/2026-10-05-component-heatmap-design.md`
- 결과 화면의 컴포넌트 히트맵: 화면별 스냅샷 위에 컴포넌트별 클릭 수(하늘색 = 버튼·링크, 주황 = 누를 수 없는 곳)
- 음성 녹음, 실제 마이크 음량 파형, 음성 전사, AI 후속 질문, 브라우저 음성 읽기
- SQLite 응답 저장, 녹음 파일 저장, 참가자·시안별 분석 필터
- A/B 선호도, 클릭 분포·타임라인, 설문 분포, 인터뷰 원문, CSV/JSON/인쇄 리포트
- 빠른 체험 연구와 일반 연구 구분

## AI 설정

`.env.example`을 참고해 `.env.local`에 키를 입력합니다. 키는 브라우저로 전달하지 않습니다.

```env
KIMI_API_KEY=본인의_키            # Moonshot 국제판 키 — https://api.moonshot.ai/v1 에서만 인증됩니다
KIMI_BASE_URL=https://api.moonshot.ai/v1
KIMI_INTERVIEW_MODEL=kimi-k3
KIMI_THINKING=disabled            # 켜면 응답이 느려지고 짧은 답이 비어 올 수 있습니다
OPENAI_API_KEY=본인의_키          # 음성 전사(Whisper) 전용 — 크레딧이 있어야 동작합니다
OPENAI_TRANSCRIBE_MODEL=whisper-1
MINDLENS_SPEECH_API_URL=          # 선택: 별도 음성 전사 서버(설정되면 OpenAI보다 우선)
MINDLENS_SPEECH_API_TOKEN=
```

- AI 인터뷰 질문은 Kimi(OpenAI 호환 API)로 만듭니다. 키가 없거나 호출이 실패하면 **데모 질문 모드**로 표시됩니다.
- 음성 전사는 OpenAI Whisper로 합니다(Kimi에는 음성 전사 API가 없습니다). 키가 없거나 크레딧이 없어 실패하면 직접 입력 안내가 뜨고, 녹음 파일은 그대로 저장됩니다.
- 키 설정 여부는 `/api/status`(`aiProvider`)에서 확인하지만, 유효성은 실제 호출로 확인해야 합니다.

## 데이터 및 시연 범위

- DB: `data/mindlens.sqlite`; 음성: `data/recordings/`
- 로그인은 요구사항에 따라 생략했습니다. 이름은 인증 수단이 아니므로 이번 버전은 로컬 시연용입니다.
- HTML은 단일 파일로 준비하고 CSS/JS를 내부에 포함하세요. 외부 API 호출, 외부 스크립트, 다른 페이지로 이동하는 앱은 이 시연의 추적 대상에 포함되지 않습니다.
- 클릭은 업로드한 HTML의 DOM 안에서 수집합니다. 화면 녹화나 픽셀 기반 AI 관찰은 구현 범위에 포함되지 않습니다.
- 의뢰자가 HTML 요소에 `data-component="이름"` 을 붙이면 그 요소를 하나의 컴포넌트 경계로 강제할 수 있습니다.
- 입력창에 입력한 값과 스크롤 위치는 스냅샷에 복원되지 않습니다.
- 음성은 답변 전송 또는 체험 종료 때 저장됩니다. 전송 전 새로고침하면 현재 녹음 구간은 사라집니다.
- 음성 읽기는 운영체제/브라우저의 한국어 음성 지원에 따라 달라집니다.
- 결과는 수집 표본의 기술 통계이며 통계적 유의성 검정은 포함하지 않습니다.
- 기존 기능 분석 MD는 제품 로드맵입니다. 이번 구현은 요청한 HTML A/B 자유 탐색·인터뷰·응답 저장 흐름에 집중했습니다.

## 디자인

MindLens 홈페이지 팔레트: 하늘색 `#00A4DF`, 배경 `#FCFCFC`, 본문 `#0D0D0D`, 보조 텍스트 `#454545`, 구분선 `#E5E7EB`. 업로드한 A/B HTML의 디자인은 원본을 유지합니다.

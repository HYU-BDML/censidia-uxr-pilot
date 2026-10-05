export type Variant = 'A' | 'B';
export type SessionStatus = 'active' | 'survey' | 'completed';
export interface CustomQuestion { id: string; type: 'choice' | 'text'; question: string; options: string[] }
export interface Study { id:string; owner:string; title:string; description:string; durationSeconds:number; createdAt:string; isDemo:boolean; variantAName:string; variantBName:string; sessionCount?:number; completedCount?:number; customQuestions?:CustomQuestion[]; tasks?:StudyTask[]; }
export interface Session { id:string; studyId:string; name:string; status:SessionStatus; currentVariant:Variant; order:Variant[]; startedAt:string; completedAt:string|null; elapsedA:number; elapsedB:number; preference:Variant|'tie'|null; preferenceReason:string; isDemo:boolean; }
export interface ClickEvent { id?:number; sessionId?:string; variant:Variant; elapsedMs:number; component:string; tag:string; text:string; selector:string; x:number; y:number; viewportWidth:number; viewportHeight:number; source?:'prototype'|'platform'; createdAt?:string; screenId?:string; componentPath?:string; kind?:'interactive'|'static'; phase?:string; }
export interface SurveyQuestion { id:string; question:string; options:string[]; }
export interface SurveyAnswer { questionId:string; choice:string; otherText:string; }
export interface StoredAnswer extends SurveyAnswer { id:number;sessionId:string;variant:Variant;createdAt:string; }
export interface InterviewTurn {id:number;sessionId:string;variant:Variant;role:'assistant'|'user';text:string;elapsedSeconds:number;mode:'ai'|'demo';createdAt:string;}
export interface Recording {id:string;sessionId:string;variant:Variant;mimeType:string;durationSeconds:number;createdAt:string;}
export interface SessionDetail {session:Session;study:Study;events:ClickEvent[];answers:StoredAnswer[];interviewTurns:InterviewTurn[];recordings:Recording[];taskAttempts:TaskAttempt[];}
export interface StudyResults {study:Study;sessions:Session[];events:ClickEvent[];answers:StoredAnswer[];interviewTurns:InterviewTurn[];recordings:Recording[];comments:ParticipantComment[];taskAttempts:TaskAttempt[];summary:{total:number;completed:number;preferenceA:number;preferenceB:number;preferenceTie:number;totalClicks:number;avgDurationSeconds:number;};}
export interface ParticipantComment { id?:number; sessionId?:string; variant:Variant; screenId?:string; componentPath?:string; label:string; kind?:'interactive'|'static'; text:string; elapsedMs:number; viewportWidth?:number; viewportHeight?:number; createdAt?:string; }
/** 과업 완료 기준(시안별). componentPath·text 중 하나 이상. componentLabel 은 목록이 다시 그려져 경로가 바뀔 때의 보조 매칭용. */
export interface TaskCriteria { componentPath?:string; componentLabel?:string; text?:string; }
/** 의뢰자가 설정하는 과업. 자유 탐색이 끝난 뒤 순서대로 진행한다. */
export interface StudyTask { id:string; instruction:string; timeLimitSeconds:number; criteria:Record<Variant,TaskCriteria>; }
export type TaskOutcome = 'success'|'timeout'|'gave_up';
/** 과업 시도 1회 = 1행. ClickEvent.phase 가 `task:${taskId}` 인 클릭들이 이 시도의 클릭이다(자유 탐색은 'free'). */
export interface TaskAttempt { id?:number; sessionId?:string; taskId:string; variant:Variant; outcome:TaskOutcome; matchedBy?:'component'|'text'; durationMs:number; clickCount:number; firstClickCorrect?:boolean; evidenceScreenId?:string; lastScreenId?:string; verified?:boolean; createdAt?:string; }
export const SURVEY_QUESTIONS:SurveyQuestion[] = [
{id:'clarity',question:'이 화면의 목적과 주요 기능을 이해하기 쉬웠나요?',options:['매우 쉬웠어요','쉬웠어요','보통이에요','어려웠어요','매우 어려웠어요']},
{id:'navigation',question:'원하는 정보나 기능을 찾는 과정은 어땠나요?',options:['바로 찾았어요','대체로 쉽게 찾았어요','여러 번 살펴봤어요','찾기 어려웠어요','찾지 못했어요']},
{id:'confidence',question:'클릭했을 때 어떤 일이 일어날지 예상할 수 있었나요?',options:['항상 예상할 수 있었어요','대체로 예상했어요','보통이에요','예상하기 어려웠어요','전혀 예상하지 못했어요']},
{id:'comfort',question:'화면을 사용하는 동안 가장 가까웠던 느낌은 무엇인가요?',options:['편안하고 명확했어요','익숙하고 자연스러웠어요','조금 복잡했어요','답답하거나 혼란스러웠어요','특별한 느낌이 없었어요']},
{id:'reuse',question:'실제로 이 서비스를 다시 사용하고 싶은가요?',options:['꼭 사용하고 싶어요','사용하고 싶어요','잘 모르겠어요','별로 사용하고 싶지 않아요','사용하고 싶지 않아요']}
];

/**
 * 과업 기반 테스트의 공용 규칙 — 의뢰자 입력 검증, 성공 판정, 서버 재검증.
 *
 * Node 테스트가 직접 import 하므로 값 import 를 하지 않는다(타입만).
 * matchTask 는 instrument.ts 가 toString() 으로 참가자 iframe 에 주입한다 →
 * 함수 밖의 값을 참조하지 말고, 스프레드·클래스·async 를 쓰지 말 것.
 */
import type { StudyTask, TaskAttempt, TaskCriteria, Variant } from './types';

export const TASK_LIMITS = {
  maxTasks: 5,
  instructionMax: 300,
  timeMin: 15,
  timeMax: 600,
  timeDefault: 120,
  textMax: 200,
  pathMax: 1000,
  labelMax: 100,
} as const;

/** 성공 판정 입력: 클릭한 컴포넌트(경로·라벨) 또는 지금 화면의 보이는 텍스트. */
export type TaskHit = { componentPath?: string; label?: string; pageText?: string };

/**
 * 과업 성공 판정. 컴포넌트가 먼저, 그다음 문구.
 * - 컴포넌트: 경로가 같으면 성공. 경로가 달라도 라벨(공백·대소문자 무시)이 같으면 성공 —
 *   목록이 다시 그려져 nth-of-type 경로가 바뀐 같은 버튼을 놓치지 않기 위해서다.
 * - 문구: 공백을 모두 지우고 소문자로 맞춘 뒤 포함 여부.
 */
export function matchTask(criteria: TaskCriteria | null | undefined, hit: TaskHit): 'component' | 'text' | null {
  if (!criteria) return null;
  const norm = function (value: string | undefined | null): string {
    return String(value || '').replace(/\s+/g, '').toLowerCase();
  };
  if (criteria.componentPath && hit.componentPath) {
    if (hit.componentPath === criteria.componentPath) return 'component';
    if (criteria.componentLabel && norm(criteria.componentLabel) && norm(criteria.componentLabel) === norm(hit.label)) return 'component';
  }
  if (criteria.text && typeof hit.pageText === 'string') {
    const needle = norm(criteria.text);
    if (needle && norm(hit.pageText).indexOf(needle) >= 0) return 'text';
  }
  return null;
}

function cleanCriteria(raw: unknown, label: string): TaskCriteria {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: TaskCriteria = {};
  if (c.componentPath !== undefined && c.componentPath !== null && c.componentPath !== '') {
    if (typeof c.componentPath !== 'string' || c.componentPath.length > TASK_LIMITS.pathMax) throw new Error(`${label}의 목표 컴포넌트를 확인해주세요.`);
    out.componentPath = c.componentPath;
    if (typeof c.componentLabel === 'string' && c.componentLabel.trim()) out.componentLabel = c.componentLabel.trim().slice(0, TASK_LIMITS.labelMax);
  }
  if (c.text !== undefined && c.text !== null && c.text !== '') {
    if (typeof c.text !== 'string' || !c.text.trim() || c.text.trim().length > TASK_LIMITS.textMax) throw new Error(`${label}의 목표 문구는 1~${TASK_LIMITS.textMax}자로 입력해주세요.`);
    out.text = c.text.trim();
  }
  if (!out.componentPath && !out.text) throw new Error(`${label}에 완료 기준(목표 컴포넌트 또는 목표 문구)을 하나 이상 지정해주세요.`);
  return out;
}

/** 의뢰자 입력 검증. id 는 서버가 t1..tN 으로 다시 붙인다(클라이언트 id 무시). */
export function parseTasks(raw: unknown): StudyTask[] {
  if (raw === undefined || raw === null || raw === '') return [];
  if (!Array.isArray(raw)) throw new Error('과업 형식을 확인해주세요.');
  if (raw.length > TASK_LIMITS.maxTasks) throw new Error(`과업은 최대 ${TASK_LIMITS.maxTasks}개까지 만들 수 있습니다.`);
  return raw.map((item, i) => {
    const t = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const n = i + 1;
    const instruction = typeof t.instruction === 'string' ? t.instruction.trim() : '';
    if (!instruction || instruction.length > TASK_LIMITS.instructionMax) throw new Error(`과업 ${n}의 지시문은 1~${TASK_LIMITS.instructionMax}자로 입력해주세요.`);
    const time = t.timeLimitSeconds === undefined || t.timeLimitSeconds === null || t.timeLimitSeconds === '' ? TASK_LIMITS.timeDefault : Number(t.timeLimitSeconds);
    if (!Number.isInteger(time) || time < TASK_LIMITS.timeMin || time > TASK_LIMITS.timeMax) throw new Error(`과업 ${n}의 제한 시간은 ${TASK_LIMITS.timeMin}~${TASK_LIMITS.timeMax}초로 입력해주세요.`);
    const criteria = (t.criteria && typeof t.criteria === 'object' ? t.criteria : {}) as Record<string, unknown>;
    return {
      id: `t${n}`,
      instruction,
      timeLimitSeconds: time,
      criteria: { A: cleanCriteria(criteria.A, `과업 ${n} 버전 A`), B: cleanCriteria(criteria.B, `과업 ${n} 버전 B`) },
    };
  });
}

/** 스냅샷 HTML → 텍스트(서버 재검증용). script·style 은 버린다. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&');
}

/**
 * 서버 재검증: 클라이언트가 보낸 성공 주장을 저장된 근거로 다시 확인한다.
 * - success 가 아니면 검증할 게 없으므로 true.
 * - component: 이 시도의 클릭 중 하나가 matchTask 로 성공해야 한다.
 * - text: 근거 화면(evidenceHtml)의 텍스트에 목표 문구가 있어야 한다.
 * 실패해도 시도를 거부하지 않는다(verified=false 로 저장 — 영구 400 이 참가자 저장 대기열을 막지 않게).
 */
export function verifyAttempt(
  task: StudyTask,
  variant: Variant,
  attempt: Pick<TaskAttempt, 'outcome' | 'matchedBy'>,
  clicks: { componentPath?: string; component?: string }[],
  evidenceHtml?: string | null,
): boolean {
  if (attempt.outcome !== 'success') return true;
  const criteria = task.criteria[variant];
  if (attempt.matchedBy === 'component') return clicks.some((c) => matchTask(criteria, { componentPath: c.componentPath, label: c.component }) === 'component');
  if (attempt.matchedBy === 'text') return !!evidenceHtml && matchTask({ text: criteria.text }, { pageText: htmlToText(evidenceHtml) }) === 'text';
  return false;
}

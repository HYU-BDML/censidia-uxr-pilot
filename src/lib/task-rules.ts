/**
 * 과업 기반 테스트의 공용 규칙 — 의뢰자 입력 검증, 성공 판정, 서버 재검증.
 *
 * Node 테스트가 직접 import 하므로 값 import 를 하지 않는다(타입만).
 * matchTask 는 instrument.ts 가 toString() 으로 참가자 iframe 에 주입한다 →
 * 함수 밖의 값을 참조하지 말고, 스프레드·클래스·async 를 쓰지 말 것.
 */
import type { StateCriterion, StudyTask, TaskAttempt, TaskCriteria, Variant } from './types';

export const TASK_LIMITS = {
  maxTasks: 5,
  instructionMax: 300,
  timeMin: 15,
  timeMax: 600,
  timeDefault: 120,
  expectedMax: 200,
  anchorMax: 300,
  anchorIndexMax: 200,
  pathMax: 1000,
  labelMax: 100,
} as const;

/** 컴포넌트 성공 판정 입력: 클릭한 컴포넌트(경로·라벨). */
export type TaskHit = { componentPath?: string; label?: string };

/**
 * 컴포넌트 성공 판정(상태 기준은 readState/stateMatches 가 따로 본다).
 * 경로가 같으면 성공. 경로가 달라도 라벨(공백·대소문자 무시)이 같으면 성공 —
 * 목록이 다시 그려져 nth-of-type 경로가 바뀐 같은 버튼을 놓치지 않기 위해서다.
 */
export function matchTask(criteria: TaskCriteria | null | undefined, hit: TaskHit): 'component' | null {
  if (!criteria) return null;
  const norm = function (value: string | undefined | null): string {
    return String(value || '').replace(/\s+/g, '').toLowerCase();
  };
  if (criteria.componentPath && hit.componentPath) {
    if (hit.componentPath === criteria.componentPath) return 'component';
    if (criteria.componentLabel && norm(criteria.componentLabel) && norm(criteria.componentLabel) === norm(hit.label)) return 'component';
  }
  return null;
}

/**
 * 목표 상태의 요소를 찾는다(앵커의 anchorIndex 번째 → path). 없으면 null. 잘못된 선택자는 예외를 던진다.
 * 요소 해석의 유일한 구현 — readState 와 iframe 의 증명 추출이 같이 쓴다.
 * toString 직렬화 가능. readState 가 이 함수를 이름으로 부르므로, 직렬화해 주입할 때 함께(같은 이름으로) 주입해야 한다.
 */
export function resolveStateElement(state: StateCriterion, doc: Document): Element | null {
  const root: Element | null = state.anchor ? doc.querySelectorAll(state.anchor)[state.anchorIndex || 0] || null : doc.body;
  if (!root) return null;
  return state.path ? root.querySelector(':scope > ' + state.path) : root;
}

/**
 * 참가자 iframe 에서 목표 상태의 현재 값을 읽는다(없으면 null). toString 직렬화 가능.
 * 앵커(없으면 body) 아래에서 path 의 요소를 찾아 property 로 읽는다.
 */
export function readState(state: StateCriterion, doc: Document): string | null {
  try {
    const el = resolveStateElement(state, doc);
    if (!el) return null;
    const any = el as unknown as { innerText?: string; textContent?: string | null; value?: unknown; checked?: unknown };
    if (state.property === 'text') return String(any.innerText !== undefined && any.innerText !== null ? any.innerText : any.textContent || '');
    if (state.property === 'value') return any.value !== undefined && any.value !== null ? String(any.value) : el.getAttribute('value');
    if (state.property === 'checked') return any.checked !== undefined ? String(!!any.checked) : String(el.hasAttribute('checked'));
    return state.attr ? el.getAttribute(state.attr) : null;
  } catch (e) {
    return null;
  }
}

/** 관찰한 값이 목표와 같은가(공백 제거·소문자 후 equals/contains). null 은 항상 false. toString 직렬화 가능. */
export function stateMatches(state: StateCriterion, observed: string | null | undefined): boolean {
  if (observed === null || observed === undefined) return false;
  const norm = function (value: string | undefined | null): string {
    return String(value || '').replace(/\s+/g, '').toLowerCase();
  };
  const want = norm(state.expected);
  if (!want) return false;
  const got = norm(observed);
  return state.match === 'contains' ? got.indexOf(want) >= 0 : got === want;
}

function cleanState(raw: unknown, label: string): StateCriterion {
  const fail = (why: string) => new Error(`${label}의 목표 상태를 확인해주세요(${why}).`);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw fail('형식');
  const r = raw as Record<string, unknown>;
  const out: StateCriterion = { path: '', property: 'text', expected: '', match: 'equals' };
  if (r.anchor !== undefined && r.anchor !== null && r.anchor !== '') {
    if (typeof r.anchor !== 'string' || !r.anchor.trim() || r.anchor.length > TASK_LIMITS.anchorMax) throw fail(`앵커 1~${TASK_LIMITS.anchorMax}자`);
    out.anchor = r.anchor;
  }
  if (r.anchorIndex !== undefined && r.anchorIndex !== null) {
    if (typeof r.anchorIndex !== 'number' || !Number.isInteger(r.anchorIndex) || r.anchorIndex < 0 || r.anchorIndex > TASK_LIMITS.anchorIndexMax) throw fail(`앵커 순번 0~${TASK_LIMITS.anchorIndexMax}`);
    if (r.anchorIndex > 0 && out.anchor) out.anchorIndex = r.anchorIndex;
  }
  if (r.path !== undefined && r.path !== null) {
    if (typeof r.path !== 'string' || r.path.length > TASK_LIMITS.pathMax) throw fail(`경로 ${TASK_LIMITS.pathMax}자 이하`);
    out.path = r.path;
  }
  if (r.property !== 'text' && r.property !== 'value' && r.property !== 'checked' && r.property !== 'attr') throw fail('읽을 값 종류');
  out.property = r.property;
  if (r.property === 'attr') {
    if (typeof r.attr !== 'string' || !/^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(r.attr)) throw fail('속성 이름');
    out.attr = r.attr;
  }
  if (typeof r.expected !== 'string' || !r.expected.trim() || r.expected.trim().length > TASK_LIMITS.expectedMax) throw fail(`목표 값 1~${TASK_LIMITS.expectedMax}자`);
  out.expected = r.expected.trim();
  if (r.match !== undefined && r.match !== null && r.match !== 'equals' && r.match !== 'contains') throw fail('일치 방식');
  out.match = r.match === 'contains' ? 'contains' : 'equals';
  if (typeof r.label === 'string' && r.label.trim()) out.label = r.label.trim().slice(0, TASK_LIMITS.labelMax);
  return out;
}

function cleanCriteria(raw: unknown, label: string): TaskCriteria {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: TaskCriteria = {};
  if (c.componentPath !== undefined && c.componentPath !== null && c.componentPath !== '') {
    if (typeof c.componentPath !== 'string' || c.componentPath.length > TASK_LIMITS.pathMax) throw new Error(`${label}의 목표 컴포넌트를 확인해주세요.`);
    out.componentPath = c.componentPath;
    if (typeof c.componentLabel === 'string' && c.componentLabel.trim()) out.componentLabel = c.componentLabel.trim().slice(0, TASK_LIMITS.labelMax);
  }
  if (c.state !== undefined && c.state !== null) out.state = cleanState(c.state, label);
  if (!out.componentPath && !out.state) throw new Error(`${label}에 완료 기준(목표 컴포넌트 또는 목표 상태)을 하나 이상 지정해주세요.`);
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

/** CSS 이스케이프 해제: 16진수(`\31 23` — 뒤의 공백 1개 포함)와 문자(`\x`) 이스케이프 모두. */
const unescapeCss = (v: string) =>
  v.replace(/\\([0-9a-fA-F]{1,6})[ \t\n\r\f]?|\\([\s\S])/g, (_m, hex: string | undefined, ch: string | undefined) =>
    hex ? String.fromCodePoint(Math.min(parseInt(hex, 16) || 0xfffd, 0x10ffff)) : (ch as string));
const escapeHtmlAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** 앵커 선택자(#id 또는 [attr="value"])를 HTML 에서 찾을 문자열(id="…" / attr="…")로 바꾼다. 못 읽으면 null. */
function anchorNeedle(anchor: string): string | null {
  const id = /^#((?:[^\\]|\\[0-9a-fA-F]{1,6}[ \t\n\r\f]?|\\[\s\S])+)$/.exec(anchor);
  if (id) return `id="${escapeHtmlAttr(unescapeCss(id[1]))}"`;
  const attr = /^\[([a-zA-Z_:][-a-zA-Z0-9_:.]*)="((?:[^"\\]|\\.)*)"\]$/.exec(anchor);
  if (attr) return `${attr[1]}="${escapeHtmlAttr(unescapeCss(attr[2]))}"`;
  return null;
}

/** 증명(outerHTML)의 루트 여는 태그 → {tag, attrs}. */
function rootTag(proof: string): { tag: string; attrs: Record<string, string> } | null {
  const m = /^\s*<([a-zA-Z][^\s>/]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(proof);
  if (!m) return null;
  const attrs: Record<string, string> = {};
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let a: RegExpExecArray | null;
  while ((a = re.exec(m[2]))) attrs[a[1].toLowerCase()] = a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : '';
  return { tag: m[1].toLowerCase(), attrs };
}

const decodeAttr = (v: string) => v.replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&');

/** 증명 문자열만 보고 state.property 의 값을 읽는다(서버에는 DOM 이 없다). */
function proofValue(state: StateCriterion, proof: string): string | null {
  const root = rootTag(proof);
  if (!root) return null;
  if (state.property === 'text') return htmlToText(proof);
  if (state.property === 'checked') return String('checked' in root.attrs);
  if (state.property === 'attr') return state.attr && state.attr.toLowerCase() in root.attrs ? decodeAttr(root.attrs[state.attr.toLowerCase()]) : null;
  if (root.tag === 'select') {
    const opt = /<option\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)(?=<\/option|<option\b|$)/gi;
    let first: string | null = null;
    let o: RegExpExecArray | null;
    while ((o = opt.exec(proof))) {
      const oa = rootTag('<option' + o[1] + '>');
      const val = oa && 'value' in oa.attrs ? decodeAttr(oa.attrs.value) : htmlToText(o[2]).trim();
      if (first === null) first = val;
      if (oa && 'selected' in oa.attrs) return val;
    }
    return first;
  }
  if (root.tag === 'textarea') return htmlToText(proof.replace(/^\s*<[^>]*>/, '').replace(/<\/textarea\s*>\s*$/i, ''));
  return 'value' in root.attrs ? decodeAttr(root.attrs.value) : null;
}

/**
 * 서버 재검증: 클라이언트가 보낸 성공 주장을 저장된 근거로 다시 확인한다.
 * - success 가 아니면 검증할 게 없으므로 true.
 * - component: 이 시도의 클릭 중 하나가 matchTask 로 성공해야 한다.
 * - state: 근거 화면(evidenceHtml)이 있고, 증명(outerHTML)이 그 화면에 글자 그대로 들어 있고,
 *   앵커의 id/속성 문자열이 증명 끝보다 앞에 나오고, 증명 자신의 값이 stateMatches 를 만족해야 한다.
 *   (Node 에는 DOM 이 없어 문자열로만 본다 — 한계는 설계 문서 참고.)
 * 실패해도 시도를 거부하지 않는다(verified=false 로 저장 — 영구 400 이 참가자 저장 대기열을 막지 않게).
 */
export function verifyAttempt(
  task: StudyTask,
  variant: Variant,
  attempt: Pick<TaskAttempt, 'outcome' | 'matchedBy'>,
  clicks: { componentPath?: string; component?: string }[],
  evidenceHtml?: string | null,
  evidenceProof?: string | null,
): boolean {
  if (attempt.outcome !== 'success') return true;
  const criteria = task.criteria[variant];
  if (attempt.matchedBy === 'component') return clicks.some((c) => matchTask(criteria, { componentPath: c.componentPath, label: c.component }) === 'component');
  if (attempt.matchedBy === 'state') {
    const state = criteria.state;
    if (!state || !evidenceHtml || !evidenceProof || !evidenceProof.trim()) return false;
    // 증명 문자열은 화면 안에 여러 번 나올 수 있다(같은 배지가 다른 행에도 있음) → 앵커 뒤에 오는 어느 한 곳이면 된다.
    const needle = state.anchor ? anchorNeedle(state.anchor) : null;
    if (state.anchor && !needle) return false;
    let found = false;
    for (let at = evidenceHtml.indexOf(evidenceProof); at >= 0 && !found; at = evidenceHtml.indexOf(evidenceProof, at + 1)) {
      if (!needle) found = true;
      else { const a = evidenceHtml.indexOf(needle); found = a >= 0 && a < at + evidenceProof.length; }
    }
    if (!found) return false;
    return stateMatches(state, proofValue(state, evidenceProof));
  }
  return false;
}

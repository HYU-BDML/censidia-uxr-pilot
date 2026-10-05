// Node 테스트가 직접 import 하므로 값 import 금지(타입만).
import type { ClickEvent, Variant } from './types';

export type FlowClick = { path: string; label: string; kind: 'interactive' | 'static'; elapsedMs: number };
export type FlowStep = { screenId: string | null; variant: Variant; startMs: number; endMs: number; viewportWidth: number; viewportHeight: number; clicks: FlowClick[] };
export type FlowLane = { sessionId: string; variant: Variant; steps: FlowStep[]; taskId?: string };
export type FlowOptions = { taskIds?: string[] };

/** 클릭 이벤트 → 참여자·버전별 여정. 같은 화면의 연속 클릭을 한 단계로 묶고, 화면이 바뀌면 새 단계(되돌아와도 새 단계). */
export function buildFlowLanes(events: ClickEvent[], options?: FlowOptions): FlowLane[] {
  if (!options?.taskIds) return lanesOf(events);
  // 과업 연구: 과업 구간만, 참여자 x 과업(과업 순서) x 버전. 자유 탐색(phase 'free'/없음)은 제외한다.
  const sessions: string[] = [];
  for (const e of events) { const sid = e.sessionId || ''; if (e.phase?.startsWith('task:') && options.taskIds.includes(e.phase.slice(5)) && !sessions.includes(sid)) sessions.push(sid); }
  const lanes: FlowLane[] = [];
  for (const sid of sessions) for (const taskId of options.taskIds) for (const lane of lanesOf(events.filter((e) => (e.sessionId || '') === sid && e.phase === `task:${taskId}`))) lanes.push({ ...lane, taskId });
  return lanes;
}

function lanesOf(events: ClickEvent[]): FlowLane[] {
  const sessions: string[] = [];
  const groups = new Map<string, ClickEvent[]>();
  for (const e of events) {
    const sid = e.sessionId || '';
    if (!sessions.includes(sid)) sessions.push(sid);
    const key = `${sid}\u0000${e.variant}`;
    const list = groups.get(key);
    if (list) list.push(e); else groups.set(key, [e]);
  }
  const lanes: FlowLane[] = [];
  for (const sid of sessions) {
    for (const variant of ['A', 'B'] as Variant[]) {
      const list = groups.get(`${sid}\u0000${variant}`);
      if (!list) continue;
      const sorted = list.map((e, i) => ({ e, i })).sort((a, b) => a.e.elapsedMs - b.e.elapsedMs || a.i - b.i).map((x) => x.e);
      const steps: FlowStep[] = [];
      for (const e of sorted) {
        const screenId = e.screenId || null;
        const click: FlowClick = { path: e.componentPath || '', label: e.component || e.tag || e.componentPath || '', kind: e.kind === 'static' ? 'static' : 'interactive', elapsedMs: e.elapsedMs };
        const last = steps[steps.length - 1];
        if (last && last.screenId === screenId) { last.clicks.push(click); last.endMs = e.elapsedMs; }
        else steps.push({ screenId, variant, startMs: e.elapsedMs, endMs: e.elapsedMs, viewportWidth: e.viewportWidth, viewportHeight: e.viewportHeight, clicks: [click] });
      }
      lanes.push({ sessionId: sid, variant, steps });
    }
  }
  return lanes;
}

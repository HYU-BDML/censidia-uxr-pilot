// Node 테스트가 직접 import 하므로 값 import 금지(타입만).
import type { ClickEvent, StudyTask, TaskAttempt, Variant } from './types';

export type TaskMetric = {
  taskId: string;
  instruction: string;
  variant: Variant;
  attempts: number;
  successes: number;
  unverified: number;
  timeouts: number;
  gaveUp: number;
  successRate: number;
  medianMs: number | null;
  meanMs: number | null;
  firstClickRate: number | null;
  avgStaticClicks: number;
  failureScreens: { screenId: string; count: number }[];
};

/** 과업 x 시안(A,B) 지표. 성공은 outcome==='success' && verified===true 만 센다. */
export function computeTaskMetrics(tasks: StudyTask[], attempts: TaskAttempt[], events: ClickEvent[]): TaskMetric[] {
  const out: TaskMetric[] = [];
  for (const task of tasks) {
    for (const variant of ['A', 'B'] as Variant[]) {
      const list = attempts.filter((a) => a.taskId === task.id && a.variant === variant);
      const ok = list.filter((a) => a.outcome === 'success' && a.verified === true);
      const times = ok.map((a) => a.durationMs).sort((a, b) => a - b);
      const mid = times.length >> 1;
      const medianMs = times.length ? (times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2) : null;
      const meanMs = times.length ? times.reduce((n, t) => n + t, 0) / times.length : null;
      const fc = list.filter((a) => a.firstClickCorrect !== undefined);
      const sessions = new Set(list.map((a) => a.sessionId));
      const statics = events.filter(
        (e) =>
          e.phase === `task:${task.id}` && e.variant === variant && e.kind === 'static' && sessions.has(e.sessionId),
      ).length;
      const fails = new Map<string, number>();
      for (const a of list)
        if (a.outcome !== 'success' && a.lastScreenId) fails.set(a.lastScreenId, (fails.get(a.lastScreenId) || 0) + 1);
      out.push({
        taskId: task.id,
        instruction: task.instruction,
        variant,
        attempts: list.length,
        successes: ok.length,
        unverified: list.filter((a) => a.outcome === 'success' && a.verified !== true).length,
        timeouts: list.filter((a) => a.outcome === 'timeout').length,
        gaveUp: list.filter((a) => a.outcome === 'gave_up').length,
        successRate: list.length ? ok.length / list.length : 0,
        medianMs,
        meanMs,
        firstClickRate: fc.length ? fc.filter((a) => a.firstClickCorrect).length / fc.length : null,
        avgStaticClicks: list.length ? statics / list.length : 0,
        failureScreens: Array.from(fails, ([screenId, count]) => ({ screenId, count })).sort(
          (a, b) => b.count - a.count,
        ),
      });
    }
  }
  return out;
}

// Node 테스트가 직접 import 하므로 값 import 금지(타입만). 셀 이스케이프(csvCell)는 호출 쪽이 적용한다.
import type { StudyResults } from './types';

/** 결과 CSV 행(헤더 포함). 문항 이름 조회는 호출 쪽이 넘긴다. */
export function resultsCsvRows(data: StudyResults, origin: string, questionText: (questionId: string) => string): unknown[][] {
  const name = (id?: string) => data.sessions.find((x) => x.id === id)?.name || id || '알 수 없음';
  const rows: unknown[][] = [['recordType', 'sessionId', 'participant', 'variant', 'elapsedSeconds', 'component', 'choiceOrText', 'detail']];
  data.sessions.forEach((x) => rows.push(['session', x.id, x.name, '', x.elapsedA + x.elapsedB, x.status, x.preference || '', x.preferenceReason]));
  data.events.forEach((x) => rows.push(['click', x.sessionId, name(x.sessionId), x.variant, (x.elapsedMs / 1000).toFixed(3), x.component, x.text, JSON.stringify({ selector: x.selector, componentPath: x.componentPath, kind: x.kind, screenId: x.screenId, phase: x.phase, x: x.x, y: x.y, viewportWidth: x.viewportWidth, viewportHeight: x.viewportHeight })]));
  data.answers.forEach((x) => rows.push(['survey', x.sessionId, name(x.sessionId), x.variant, '', questionText(x.questionId), x.choice, x.otherText]));
  (data.comments || []).forEach((x) => rows.push(['comment', x.sessionId, name(x.sessionId), x.variant, (x.elapsedMs / 1000).toFixed(3), x.label, x.text, JSON.stringify({ componentPath: x.componentPath, kind: x.kind, screenId: x.screenId, phase: x.phase })]));
  (data.taskAttempts || []).forEach((x) => rows.push(['taskAttempt', x.sessionId, name(x.sessionId), x.variant, (x.durationMs / 1000).toFixed(3), x.taskId, x.outcome, JSON.stringify({ matchedBy: x.matchedBy, verified: x.verified, clickCount: x.clickCount, firstClickCorrect: x.firstClickCorrect, lastScreenId: x.lastScreenId, evidenceScreenId: x.evidenceScreenId })]));
  data.interviewTurns.forEach((x) => rows.push(['interview', x.sessionId, name(x.sessionId), x.variant, x.elapsedSeconds, x.role, x.text, x.mode]));
  data.recordings.forEach((x) => rows.push(['recording', x.sessionId, name(x.sessionId), x.variant, x.durationSeconds, x.mimeType, `${origin}/api/recordings/${x.id}`, x.createdAt]));
  return rows;
}

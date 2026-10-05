'use client';
import { useMemo, useState } from 'react';
import type { ClickEvent, ParticipantComment, StudyTask } from '@/lib/types';
import ComponentHeatmap from './component-heatmap';
import s from './workspace.module.css';

/** 과업이 있는 연구에서만 「전체 / 자유 탐색 / 과업 N」 필터를 붙인 히트맵. 자유 탐색 = phase 'free' 또는 없음. */
export default function PhasedHeatmap({ events, comments, tasks, hint }: { events: ClickEvent[]; comments?: ParticipantComment[]; tasks?: StudyTask[]; hint?: string }) {
  const [phase, setPhase] = useState('all');
  const taskIds = useMemo(() => (tasks || []).map((t) => t.id), [tasks]);
  const active = taskIds.length && (phase === 'all' || phase === 'free' || taskIds.includes(phase)) ? phase : 'all';
  const shown = useMemo(() => (active === 'all' ? events : events.filter((e) => (active === 'free' ? !e.phase || e.phase === 'free' : e.phase === `task:${active}`))), [events, active]);
  const shownComments = useMemo(() => (comments && (active === 'all' ? comments : comments.filter((c) => (active === 'free' ? !c.phase || c.phase === 'free' : c.phase === `task:${active}`)))), [comments, active]);
  return (
    <>
      {hint && <p className={s.hint}>{hint} {shown.length}회</p>}
      {taskIds.length > 0 && <div className={s.pillGroup} style={{ marginBottom: 12 }} role="group" aria-label="단계 필터">
        {[['all', '전체'], ['free', '자유 탐색'], ...taskIds.map((id, i) => [id, `과업 ${i + 1}`])].map(([id, label]) => <button key={id} onClick={() => setPhase(id)} className={`${s.pill} ${active === id ? s.pillActive : ''}`}>{label}</button>)}
      </div>}
      <ComponentHeatmap events={shown} comments={shownComments} />
    </>
  );
}

'use client';
import { useEffect, useMemo, useState } from 'react';
import type { ClickEvent, StudyTask, TaskAttempt, TaskCriteria } from '@/lib/types';
import { computeTaskMetrics, type TaskMetric } from '@/lib/task-metrics';
import { loadScreen } from '@/lib/screen-cache';
import { stateSummary } from './task-editor';
import s from './workspace.module.css';

const COLOR = { A: '#00A4DF', B: '#5277a3' } as const;
const THUMB_W = 200;
const sec = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)}초`);
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

function Thumb({ screenId, viewport }: { screenId: string; viewport: { w: number; h: number } }) {
  const [html, setHtml] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setHtml('');
    setFailed(false);
    loadScreen(screenId)
      .then((h) => {
        if (alive) setHtml(h);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [screenId]);
  const scale = THUMB_W / viewport.w;
  const height = Math.min(viewport.h * scale, 140);
  return (
    <div
      style={{
        width: THUMB_W,
        height,
        overflow: 'hidden',
        position: 'relative',
        background: '#f3f4f6',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
      }}
    >
      {failed ? (
        <p className={s.hint} style={{ padding: 10 }}>
          화면 기록을 불러오지 못했습니다.
        </p>
      ) : !html ? (
        <p className={s.hint} style={{ padding: 10 }}>
          불러오는 중…
        </p>
      ) : (
        <iframe
          srcDoc={html}
          sandbox="allow-scripts"
          title="실패 지점 화면"
          style={{
            width: viewport.w,
            height: viewport.h,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
            pointerEvents: 'none',
            background: '#fff',
          }}
        />
      )}
    </div>
  );
}

function VariantColumn({
  m,
  viewportOf,
  excluded,
  criteria,
  attempts,
}: {
  m: TaskMetric;
  viewportOf: (id: string) => { w: number; h: number };
  excluded?: boolean;
  criteria?: TaskCriteria;
  attempts: TaskAttempt[];
}) {
  const hits = attempts.filter(
    (a) => a.taskId === m.taskId && a.variant === m.variant && a.outcome === 'success' && a.verified,
  );
  const byComponent = hits.filter((a) => a.matchedBy === 'component').length;
  const byState = hits.filter((a) => a.matchedBy === 'state').length;
  const rate = Math.round(m.successRate * 100);
  return (
    <div className={s.recordCard} style={{ minWidth: 0 }}>
      <span className={s.badge}>VERSION {m.variant}</span>
      {criteria && (
        <p className={s.hint} style={{ marginTop: 8 }}>
          {[
            criteria.componentPath ? `컴포넌트: ${criteria.componentLabel || criteria.componentPath}` : '',
            criteria.state ? `상태: ${stateSummary(criteria.state)}` : '',
          ]
            .filter(Boolean)
            .join(' · ') || '기준 없음'}
        </p>
      )}
      {m.attempts === 0 ? (
        <p className={s.hint} style={{ marginTop: 10 }}>
          {excluded ? '버전 필터로 제외됨' : '아직 시도한 참여자가 없습니다.'}
        </p>
      ) : (
        <>
          <div className={s.barRow} style={{ marginTop: 10 }}>
            <span>성공률</span>
            <div className={s.barTrack}>
              <div className={s.barFill} style={{ width: `${rate}%`, background: COLOR[m.variant] }} />
            </div>
            <strong>{rate}%</strong>
          </div>
          <p className={s.hint}>
            {m.attempts}명 중 {m.successes}명 성공
          </p>
          <table className={s.table} style={{ marginTop: 8 }}>
            <tbody>
              <tr>
                <td>평균 소요 시간</td>
                <td>{sec(m.meanMs)}</td>
              </tr>
              <tr>
                <td>중앙값 소요 시간</td>
                <td>{sec(m.medianMs)}</td>
              </tr>
              <tr>
                <td>첫 클릭 정확도</td>
                <td>{pct(m.firstClickRate)}</td>
              </tr>
              <tr>
                <td>평균 헛클릭</td>
                <td>{m.avgStaticClicks.toFixed(1)}회</td>
              </tr>
              <tr>
                <td>완료 방식</td>
                <td>
                  컴포넌트 클릭 {byComponent}명 · 상태 변경 {byState}명
                </td>
              </tr>
              <tr>
                <td>시간 초과 · 포기</td>
                <td>
                  {m.timeouts}명 · {m.gaveUp}명
                </td>
              </tr>
            </tbody>
          </table>
          <p className={s.hint} style={{ marginTop: 6 }}>
            소요 시간은 성공한 참여자 기준입니다. 헛클릭은 누를 수 없는 곳을 누른 횟수입니다.
          </p>
          {m.unverified > 0 && (
            <p className={s.hint} style={{ color: '#F18134' }}>
              검증 안 된 성공 {m.unverified}건은 성공률에서 제외했습니다.
            </p>
          )}
          {m.failureScreens.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p className={s.hint}>
                <strong>실패 지점</strong> · 포기하거나 시간이 끝났을 때의 화면
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {m.failureScreens.map((f) => (
                  <div key={f.screenId}>
                    <Thumb screenId={f.screenId} viewport={viewportOf(f.screenId)} />
                    <p className={s.hint} style={{ marginTop: 4 }}>
                      {f.count}명
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TaskResults({
  tasks,
  attempts,
  events,
  variantFilter,
}: {
  tasks?: StudyTask[];
  attempts: TaskAttempt[];
  events: ClickEvent[];
  variantFilter?: 'all' | 'A' | 'B';
}) {
  const metrics = useMemo(() => computeTaskMetrics(tasks || [], attempts, events), [tasks, attempts, events]);
  const viewports = useMemo(() => {
    const map = new Map<string, { w: number; h: number }>();
    for (const e of events)
      if (e.screenId && !map.has(e.screenId))
        map.set(e.screenId, { w: e.viewportWidth || 1280, h: e.viewportHeight || 800 });
    return map;
  }, [events]);
  const viewportOf = (id: string) => viewports.get(id) || { w: 1280, h: 800 };
  if (!tasks?.length)
    return (
      <section className={s.panel}>
        <div className={s.empty} style={{ border: 0, padding: '42px 20px' }}>
          이 연구에는 과업이 없습니다.
        </div>
      </section>
    );
  return (
    <>
      {tasks.map((t, i) => (
        <section key={t.id} className={`${s.panel} ${i ? s.sectionSpace : ''}`}>
          <h3>과업 {i + 1}</h3>
          <p style={{ fontSize: 14, margin: '4px 0 2px' }}>{t.instruction}</p>
          <p className={s.hint}>제한 시간 {t.timeLimitSeconds}초 · 선택한 참여자 기준</p>
          <div className={s.twoCols}>
            {metrics
              .filter((m) => m.taskId === t.id)
              .map((m) => (
                <VariantColumn
                  key={m.variant}
                  m={m}
                  criteria={t.criteria[m.variant]}
                  attempts={attempts}
                  viewportOf={viewportOf}
                  excluded={!!variantFilter && variantFilter !== 'all' && m.variant !== variantFilter}
                />
              ))}
          </div>
        </section>
      ))}
    </>
  );
}

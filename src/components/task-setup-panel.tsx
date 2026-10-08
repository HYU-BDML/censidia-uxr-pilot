'use client';
import { useState } from 'react';
import type { Study, TaskCriteria } from '@/lib/types';
import TaskEditor, { draftsToPayload, stateSummary, tasksToDrafts, type TaskDraft } from './task-editor';
import s from './workspace.module.css';

const summary = (c: TaskCriteria) =>
  [
    c.componentPath ? `컴포넌트: ${c.componentLabel || c.componentPath}` : '',
    c.state ? `상태: ${stateSummary(c.state)}` : '',
  ]
    .filter(Boolean)
    .join(' · ') || '기준 없음';

/** 연구 개요 탭의 과업 패널. 참여자가 없을 때만 편집(PATCH)할 수 있다. */
export default function TaskSetupPanel({
  study,
  sessionCount,
  onSaved,
}: {
  study: Study;
  sessionCount: number;
  onSaved?: (study: Study) => void;
}) {
  const [current, setCurrent] = useState(study.tasks || []);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [html, setHtml] = useState<{ A: string | null; B: string | null }>({ A: null, B: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function start() {
    setError('');
    setDrafts(tasksToDrafts(current));
    setEditing(true);
    try {
      const [a, b] = await Promise.all(
        (['A', 'B'] as const).map((v) =>
          fetch(`/api/studies/${study.id}/html?variant=${v}`).then((r) => {
            if (!r.ok) throw Error();
            return r.text();
          }),
        ),
      );
      setHtml({ A: a, B: b });
    } catch {
      setError('프로토타입 HTML 을 불러오지 못했습니다. 목표 컴포넌트·상태 선택은 사용할 수 없어요.');
    }
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/studies/${study.id}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: localStorage.getItem('mindlens-owner') || '', tasks: draftsToPayload(drafts) }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || '과업을 저장하지 못했습니다.');
      setCurrent(d.study.tasks || []);
      setEditing(false);
      onSaved?.(d.study);
    } catch (e) {
      setError(e instanceof Error ? e.message : '과업을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={s.panel} aria-label="과업">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h3>
          과업 <span className={s.count}>{current.length}개</span>
        </h3>
        {!editing && sessionCount === 0 && (
          <button type="button" className={s.button} onClick={start}>
            과업 편집
          </button>
        )}
      </div>
      {sessionCount > 0 && <p className={s.hint}>참여가 시작되어 과업을 수정할 수 없습니다.</p>}
      {error && (
        <div className={s.error} role="alert">
          {error}
        </div>
      )}
      {editing ? (
        <>
          <TaskEditor htmlA={html.A} htmlB={html.B} value={drafts} onChange={setDrafts} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              type="button"
              className={s.button}
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setError('');
              }}
            >
              취소
            </button>
            <button type="button" className={`${s.button} ${s.primary}`} disabled={busy} onClick={save}>
              {busy ? '저장 중…' : '과업 저장'}
            </button>
          </div>
        </>
      ) : current.length ? (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>과업</th>
                <th>지시문</th>
                <th>제한 시간</th>
                <th>버전 A 기준</th>
                <th>버전 B 기준</th>
              </tr>
            </thead>
            <tbody>
              {current.map((t, i) => (
                <tr key={t.id}>
                  <td>{i + 1}</td>
                  <td>{t.instruction}</td>
                  <td>{t.timeLimitSeconds}초</td>
                  <td>{summary(t.criteria.A)}</td>
                  <td>{summary(t.criteria.B)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={s.hint}>설정된 과업이 없습니다. 참여자는 자유 탐색과 설문만 진행합니다.</p>
      )}
    </section>
  );
}

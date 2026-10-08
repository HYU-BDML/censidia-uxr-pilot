'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClickEvent, ParticipantComment } from '@/lib/types';
import { groupScreens } from '@/lib/heatmap-groups';
import { loadScreen } from '@/lib/screen-cache';
import s from './workspace.module.css';

const COLOR = { interactive: '#00A4DF', static: '#F18134' } as const;

export default function ComponentHeatmap({
  events,
  comments = [],
}: {
  events: ClickEvent[];
  comments?: ParticipantComment[];
}) {
  const { screens: clicked, unsnapshotted } = useMemo(() => groupScreens(events), [events]);
  // 클릭은 없고 의견만 남은 화면도 목록에 올린다(의견 모드의 선택은 클릭으로 세지 않는다).
  const screens = useMemo(() => {
    const list = [...clicked];
    for (const c of comments) {
      if (!c.screenId || list.some((x) => x.id === c.screenId)) continue;
      list.push({
        id: c.screenId,
        variant: c.variant,
        count: 0,
        viewportWidth: c.viewportWidth || 1280,
        viewportHeight: c.viewportHeight || 800,
        components: [],
      });
    }
    return list;
  }, [clicked, comments]);
  const [selected, setSelected] = useState('');
  const [hover, setHover] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const [boxWidth, setBoxWidth] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const screen = screens.find((x) => x.id === selected) || screens[0];
  // 클릭은 없고 의견만 있는 컴포넌트도 표·오버레이에 올린다(의견 모드의 선택은 클릭으로 세지 않는다).
  const rows = useMemo(() => {
    if (!screen) return [];
    const list = screen.components.map((c) => ({ path: c.path, label: c.label, count: c.count, kind: c.kind }));
    for (const c of comments)
      if (c.screenId === screen.id && c.componentPath && !list.some((r) => r.path === c.componentPath))
        list.push({ path: c.componentPath, label: c.label, count: 0, kind: c.kind || 'interactive' });
    return list;
  }, [screen, comments]);

  // 패널 폭 측정 — 화면이 없을 땐 상자가 렌더되지 않으므로 콜백 ref 로 붙였다 뗀다.
  const box = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    observer.current = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    observer.current.observe(el);
  }, []);

  const send = useCallback(() => {
    const w = frame.current?.contentWindow;
    if (!w || !screen) return;
    w.postMessage(
      {
        type: 'mindlens-heatmap',
        items: rows.map((c) => ({ path: c.path, count: c.count, kind: c.kind })),
        highlight: hover,
      },
      '*',
    );
  }, [screen, rows, hover]);

  useEffect(send, [send]);
  const [html, setHtml] = useState('');
  const [loadError, setLoadError] = useState(false);
  const screenKey = screen?.id;
  useEffect(() => {
    setMissing([]);
    setHover('');
  }, [screenKey]);
  // 스냅샷은 fetch 로 받아 srcDoc 으로 넣는다 — 불투명 출처 iframe 의 직접 내비게이션은 일부 브라우저에서 차단된다.
  useEffect(() => {
    if (!screenKey) return;
    let alive = true;
    setHtml('');
    setLoadError(false);
    loadScreen(screenKey)
      .then((h) => {
        if (alive) setHtml(h);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, [screenKey]);
  useEffect(() => {
    const receive = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.type !== 'mindlens-heatmap-missing') return;
      setMissing(Array.isArray(e.data.paths) ? e.data.paths : []);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  if (!screen)
    return (
      <div className={s.empty} style={{ border: 0, padding: '42px 20px' }}>
        스냅샷이 있는 클릭이나 의견이 아직 없습니다.{unsnapshotted ? ` (스냅샷 없는 클릭 ${unsnapshotted}회)` : ''}
      </div>
    );

  const shown = comments.filter((c) => c.screenId === screen.id);
  const commentCount = (path: string) => shown.filter((c) => c.componentPath === path).length;
  const scale = boxWidth ? Math.min(1, boxWidth / screen.viewportWidth) : 1;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(160px,200px) minmax(0,1fr) minmax(220px,280px)',
        gap: 16,
        alignItems: 'start',
      }}
    >
      <div>
        <p className={s.hint}>화면 {screens.length}개 · 클릭 많은 순</p>
        {screens.map((x, i) => (
          <button
            key={x.id}
            onClick={() => setSelected(x.id)}
            className={s.recordCard}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              outline: x.id === screen.id ? `2px solid ${COLOR.interactive}` : undefined,
            }}
          >
            <span className={s.badge}>{x.variant}</span> <strong>화면 {i + 1}</strong> · {x.count}회
            <p className={s.hint} style={{ marginTop: 4, overflowWrap: 'anywhere' }}>
              {x.components[0]?.label || comments.find((c) => c.screenId === x.id)?.label}
            </p>
          </button>
        ))}
        {unsnapshotted > 0 && <p className={s.hint}>스냅샷 없는 클릭 {unsnapshotted}회는 히트맵에서 제외됩니다.</p>}
      </div>
      <div
        ref={box}
        style={{
          position: 'relative',
          overflow: 'hidden',
          height: screen.viewportHeight * scale,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          background: '#fff',
        }}
      >
        {loadError ? (
          <p className={s.hint} style={{ padding: 16 }}>
            화면 기록을 불러오지 못했습니다.
          </p>
        ) : !html ? (
          <p className={s.hint} style={{ padding: 16 }}>
            화면 기록을 불러오는 중…
          </p>
        ) : (
          <iframe
            key={screen.id}
            ref={frame}
            srcDoc={html}
            sandbox="allow-scripts"
            title="클릭 순간의 화면"
            onLoad={send}
            style={{
              width: screen.viewportWidth,
              height: screen.viewportHeight,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
            }}
          />
        )}
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>컴포넌트</th>
              <th>횟수</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.path}
                onMouseEnter={() => setHover(c.path)}
                onMouseLeave={() => setHover('')}
                style={{ background: hover === c.path ? '#edf7fc' : undefined }}
              >
                <td>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: COLOR[c.kind],
                      marginRight: 6,
                    }}
                  />
                  {c.label}
                  {commentCount(c.path) > 0 && (
                    <span className={s.badge} style={{ marginLeft: 6, background: '#edf7fc', color: '#007ba8' }}>
                      의견 {commentCount(c.path)}
                    </span>
                  )}
                  {missing.includes(c.path) && (
                    <span className={s.badge} style={{ marginLeft: 6 }}>
                      화면에서 찾지 못함
                    </span>
                  )}
                </td>
                <td>{c.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className={s.hint}>
              <strong>참가자 의견</strong> · 이 화면 {shown.length}개
            </p>
            {shown.map((c, i) => (
              <div
                key={c.id ?? i}
                className={s.recordCard}
                onMouseEnter={() => c.componentPath && setHover(c.componentPath)}
                onMouseLeave={() => setHover('')}
                style={{ background: c.componentPath && hover === c.componentPath ? '#edf7fc' : undefined }}
              >
                <span className={s.badge}>{c.variant}</span> <strong>{c.label}</strong>
                <p style={{ marginTop: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.text}</p>
              </div>
            ))}
          </div>
        )}
        <p className={s.hint}>● 하늘색: 버튼·링크 등 · 주황: 누를 수 없는 곳</p>
      </div>
    </div>
  );
}

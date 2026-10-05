'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClickEvent } from '@/lib/types';
import { groupScreens } from '@/lib/heatmap-groups';
import s from './workspace.module.css';

const COLOR = { interactive: '#00A4DF', static: '#F18134' } as const;

export default function ComponentHeatmap({ events }: { events: ClickEvent[] }) {
  const { screens, unsnapshotted } = useMemo(() => groupScreens(events), [events]);
  const [selected, setSelected] = useState('');
  const [hover, setHover] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const [boxWidth, setBoxWidth] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const screen = screens.find((x) => x.id === selected) || screens[0];

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
    w.postMessage({ type: 'mindlens-heatmap', items: screen.components.map((c) => ({ path: c.path, count: c.count, kind: c.kind })), highlight: hover }, '*');
  }, [screen, hover]);

  useEffect(send, [send]);
  useEffect(() => setMissing([]), [screen?.id]);
  useEffect(() => {
    const receive = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.type !== 'mindlens-heatmap-missing') return;
      setMissing(Array.isArray(e.data.paths) ? e.data.paths : []);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  if (!screen) return <div className={s.empty} style={{ border: 0, padding: '42px 20px' }}>스냅샷이 있는 클릭이 아직 없습니다.{unsnapshotted ? ` (스냅샷 없는 클릭 ${unsnapshotted}회)` : ''}</div>;

  const scale = boxWidth ? Math.min(1, boxWidth / screen.viewportWidth) : 1;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,200px) minmax(0,1fr) minmax(220px,280px)', gap: 16, alignItems: 'start' }}>
      <div>
        <p className={s.hint}>화면 {screens.length}개 · 클릭 많은 순</p>
        {screens.map((x, i) => (
          <button key={x.id} onClick={() => setSelected(x.id)} className={s.recordCard} style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', outline: x.id === screen.id ? `2px solid ${COLOR.interactive}` : undefined }}>
            <span className={s.badge}>{x.variant}</span> <strong>화면 {i + 1}</strong> · {x.count}회
            <p className={s.hint} style={{ marginTop: 4, overflowWrap: 'anywhere' }}>{x.components[0]?.label}</p>
          </button>
        ))}
        {unsnapshotted > 0 && <p className={s.hint}>스냅샷 없는 클릭 {unsnapshotted}회는 히트맵에서 제외됩니다.</p>}
      </div>
      <div ref={box} style={{ position: 'relative', overflow: 'hidden', height: screen.viewportHeight * scale, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
        <iframe
          key={screen.id}
          ref={frame}
          src={`/api/screens/${screen.id}`}
          sandbox="allow-scripts"
          title="클릭 순간의 화면"
          onLoad={send}
          style={{ width: screen.viewportWidth, height: screen.viewportHeight, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        />
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead><tr><th>컴포넌트</th><th>횟수</th></tr></thead>
          <tbody>
            {screen.components.map((c) => (
              <tr key={c.path} onMouseEnter={() => setHover(c.path)} onMouseLeave={() => setHover('')} style={{ background: hover === c.path ? '#edf7fc' : undefined }}>
                <td>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: COLOR[c.kind], marginRight: 6 }} />
                  {c.label}
                  {missing.includes(c.path) && <span className={s.badge} style={{ marginLeft: 6 }}>화면에서 찾지 못함</span>}
                </td>
                <td>{c.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={s.hint}>● 하늘색: 버튼·링크 등 · 주황: 누를 수 없는 곳</p>
      </div>
    </div>
  );
}

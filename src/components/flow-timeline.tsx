'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClickEvent } from '@/lib/types';
import { buildFlowLanes, type FlowStep } from '@/lib/flow-steps';
import { loadScreen } from '@/lib/screen-cache';
import s from './workspace.module.css';

const COLOR = { interactive: '#00A4DF', static: '#F18134' } as const;
const CARD_W = 220;
const CARD_PREVIEW_MAX_H = 170;

const fmt = (ms: number) => { const t = Math.max(0, ms) / 1000; const m = Math.floor(t / 60); return `${String(m).padStart(2, '0')}:${(t - m * 60).toFixed(1).padStart(4, '0')}`; };

type Item = { path: string; count: number; kind: 'interactive' | 'static' };
function stepItems(step: FlowStep): Item[] {
  const by = new Map<string, Item>();
  for (const c of step.clicks) {
    if (!c.path) continue;
    const row = by.get(c.path);
    if (row) row.count++; else by.set(c.path, { path: c.path, count: 1, kind: c.kind });
  }
  return Array.from(by.values());
}

function Snapshot({ step, width, maxHeight, lazy, highlight, interactive }: { step: FlowStep; width: number; maxHeight?: number; lazy: boolean; highlight?: string; interactive?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [seen, setSeen] = useState(!lazy);
  const [html, setHtml] = useState('');
  const [failed, setFailed] = useState(false);
  const items = useMemo(() => stepItems(step), [step]);
  const screenId = step.screenId;

  useEffect(() => {
    if (seen || !box.current) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((entries) => { if (entries.some((x) => x.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(box.current);
    return () => io.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen || !screenId) return;
    let alive = true;
    setFailed(false);
    loadScreen(screenId).then((h) => { if (alive) setHtml(h); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [seen, screenId]);

  const send = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: 'mindlens-heatmap', items, highlight: highlight || '' }, '*');
  }, [items, highlight]);
  useEffect(send, [send, html]);

  const vw = step.viewportWidth || 1280;
  const vh = step.viewportHeight || 720;
  const scale = width / vw;
  const height = Math.min(vh * scale, maxHeight ?? Infinity);
  return (
    <div ref={box} style={{ width, height, overflow: 'hidden', position: 'relative', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      {!screenId ? <p className={s.hint} style={{ padding: 12, textAlign: 'center', marginTop: height / 2 - 14 }}>스냅샷 없음</p>
        : failed ? <p className={s.hint} style={{ padding: 12 }}>화면 기록을 불러오지 못했습니다.</p>
        : !html ? <p className={s.hint} style={{ padding: 12 }}>{seen ? '불러오는 중…' : ''}</p>
        : <iframe ref={frame} srcDoc={html} sandbox="allow-scripts" title="클릭 순간의 화면" onLoad={send} style={{ width: vw, height: vh, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: interactive ? 'auto' : 'none', background: '#fff' }} />}
    </div>
  );
}

function ClickList({ step, onHover }: { step: FlowStep; onHover?: (path: string) => void }) {
  return (
    <ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.6, color: '#454545' }}>
      {step.clicks.map((c, i) => (
        <li key={i} onMouseEnter={() => onHover?.(c.path)} onMouseLeave={() => onHover?.('')} style={{ overflowWrap: 'anywhere' }}>
          {c.kind === 'static' && <span title="누를 수 없는 곳" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: COLOR.static, marginRight: 4 }} />}
          {c.label} <span style={{ color: '#8a8a8a' }}>({fmt(c.elapsedMs)})</span>
        </li>
      ))}
    </ol>
  );
}

function Modal({ step, who, onClose }: { step: FlowStep; who: string; onClose: () => void }) {
  const [hover, setHover] = useState('');
  const [width] = useState(() => Math.max(320, Math.min(1000, (typeof window === 'undefined' ? 1000 : window.innerWidth) - 80)));
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="화면 크게 보기" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,13,13,.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 20, maxHeight: '92vh', overflow: 'auto', width: 'fit-content', maxWidth: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <strong>{who} · 버전 {step.variant} · {fmt(step.startMs)} – {fmt(step.endMs)}</strong>
          <button onClick={onClose} aria-label="닫기" className={s.badge} style={{ cursor: 'pointer', border: 0 }}>닫기</button>
        </div>
        <Snapshot step={step} width={width} lazy={false} highlight={hover} />
        <ClickList step={step} onHover={setHover} />
        <p className={s.hint}>● 하늘색: 버튼·링크 등 · 주황: 누를 수 없는 곳</p>
      </div>
    </div>
  );
}

export default function FlowTimeline({ events, sessionName }: { events: ClickEvent[]; sessionName: (id?: string) => string }) {
  const lanes = useMemo(() => buildFlowLanes(events), [events]);
  const [open, setOpen] = useState<{ step: FlowStep; who: string } | null>(null);
  const close = useCallback(() => setOpen(null), []);
  if (!lanes.length) return <div className={s.empty} style={{ border: 0, padding: '42px 20px' }}>클릭 기록이 없습니다.</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 18 }}>
      {lanes.map((lane) => {
        const who = sessionName(lane.sessionId || undefined);
        const clicks = lane.steps.reduce((n, st) => n + st.clicks.length, 0);
        return (
          <div key={`${lane.sessionId}-${lane.variant}`} className={s.recordCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <strong>{who} · 버전 {lane.variant}</strong>
              <span className={s.hint}>클릭 {clicks}회 · 화면 {lane.steps.length}개</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 8, marginTop: 10 }}>
              {lane.steps.map((step, i) => {
                const prev = lane.steps[i - 1];
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start' }}>
                    {prev && (
                      <div aria-hidden style={{ width: 64, flex: 'none', textAlign: 'center', paddingTop: 48, color: '#8a8a8a', fontSize: 11 }}>
                        <div>+{((step.startMs - prev.endMs) / 1000).toFixed(1)}초</div>
                        <div style={{ fontSize: 16, lineHeight: 1 }}>→</div>
                      </div>
                    )}
                    <div role="button" tabIndex={0} onClick={() => setOpen({ step, who })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen({ step, who }); } }} title="크게 보기" style={{ width: CARD_W, flex: 'none', cursor: 'zoom-in', textAlign: 'left', border: '1px solid #E5E7EB', borderRadius: 10, padding: 8, background: '#fff' }}>
                      <Snapshot step={step} width={CARD_W - 18} maxHeight={CARD_PREVIEW_MAX_H} lazy />
                      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8, color: '#0D0D0D' }}>{fmt(step.startMs)} – {fmt(step.endMs)}</div>
                      <ClickList step={step} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {open && <Modal step={open.step} who={open.who} onClose={close} />}
    </div>
  );
}

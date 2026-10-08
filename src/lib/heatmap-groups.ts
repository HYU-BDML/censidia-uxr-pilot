// Node 테스트가 직접 import 하므로 값 import 금지(타입만).
import type { ClickEvent, Variant } from './types';

export type HeatmapComponent = { path: string; label: string; kind: 'interactive' | 'static'; count: number };
export type HeatmapScreen = {
  id: string;
  variant: Variant;
  count: number;
  viewportWidth: number;
  viewportHeight: number;
  components: HeatmapComponent[];
};

/** 필터된 클릭 이벤트 → 화면별 컴포넌트 집계. 참여자·시안 필터가 히트맵에도 그대로 걸리도록 클라이언트에서 만든다. */
export function groupScreens(events: ClickEvent[]): { screens: HeatmapScreen[]; unsnapshotted: number } {
  let unsnapshotted = 0;
  const byScreen = new Map<string, ClickEvent[]>();
  for (const e of events) {
    if (!e.screenId || !e.componentPath) {
      unsnapshotted++;
      continue;
    }
    const list = byScreen.get(e.screenId);
    if (list) list.push(e);
    else byScreen.set(e.screenId, [e]);
  }
  const screens: HeatmapScreen[] = [];
  for (const [id, list] of byScreen) {
    const widths = new Map<number, number>();
    for (const e of list) widths.set(e.viewportWidth, (widths.get(e.viewportWidth) || 0) + 1);
    let width = list[0].viewportWidth;
    for (const [w, n] of widths) if (n > (widths.get(width) || 0)) width = w;
    const height = list.find((e) => e.viewportWidth === width)!.viewportHeight;
    const byPath = new Map<string, HeatmapComponent>();
    for (const e of list) {
      const path = e.componentPath!;
      const row = byPath.get(path);
      if (row) row.count++;
      else
        byPath.set(path, {
          path,
          label: e.component || e.tag || path,
          kind: e.kind === 'static' ? 'static' : 'interactive',
          count: 1,
        });
    }
    screens.push({
      id,
      variant: list[0].variant,
      count: list.length,
      viewportWidth: width,
      viewportHeight: height,
      components: Array.from(byPath.values()).sort((a, b) => b.count - a.count),
    });
  }
  screens.sort((a, b) => b.count - a.count);
  return { screens, unsnapshotted };
}

/**
 * 결과 화면에서 클릭 순간의 스냅샷을 다시 띄우기 위한 준비 + 그 위에 상자를 그리는 오버레이.
 *
 * Node 테스트가 직접 import 하므로 값 import 를 하지 않는다.
 * heatmapOverlay 는 toString() 으로 주입되므로 함수 밖의 값을 참조하지 않는다.
 */

/** 시안·스냅샷 공용 CSP — 외부 요청·폼 전송·하위 프레임 차단. 인라인 스크립트·스타일만 허용. */
export const PROTOTYPE_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:; font-src data: https:; connect-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'";

export function heatmapOverlay(): void {
  type Item = { path: string; count: number; kind: 'interactive' | 'static' };
  let items: Item[] = [];
  let highlight = '';
  let reopened = false;

  // 스냅샷의 <dialog open> 은 모달이 아닌 상태로 그려진다. 참가자가 본 것처럼 모달로 다시 연다.
  function reopenDialogs() {
    if (reopened) return;
    reopened = true;
    const dialogs = document.querySelectorAll('dialog[open]');
    for (let i = 0; i < dialogs.length; i++) {
      const d = dialogs[i] as HTMLDialogElement;
      d.removeAttribute('open');
      try {
        d.showModal();
      } catch {
        d.setAttribute('open', '');
      }
    }
  }

  function draw() {
    reopenDialogs();
    const old = document.querySelectorAll('[data-mindlens-box]');
    for (let i = 0; i < old.length; i++) old[i].remove();
    let max = 1;
    for (let i = 0; i < items.length; i++) if (items[i].count > max) max = items[i].count;
    const missing: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let el: Element | null = null;
      try {
        el = document.querySelector(item.path);
      } catch {
        el = null;
      }
      if (!el) {
        missing.push(item.path);
        continue;
      }
      const r = el.getBoundingClientRect();
      // 모달 다이얼로그는 톱 레이어라 documentElement 에 붙인 상자보다 위에 뜬다 → 상자를 다이얼로그 안에 붙인다.
      const host = el.closest('dialog[open]') as HTMLElement | null;
      let left = r.left + scrollX;
      let top = r.top + scrollY;
      if (host) {
        const hr = host.getBoundingClientRect();
        left = r.left - hr.left - host.clientLeft + host.scrollLeft;
        top = r.top - hr.top - host.clientTop + host.scrollTop;
      }
      const rgb = item.kind === 'static' ? '241,129,52' : '0,164,223';
      const alpha = (0.15 + 0.5 * (item.count / max)).toFixed(2);
      const strong = item.path === highlight;
      const box = document.createElement('div');
      box.setAttribute('data-mindlens-box', '');
      box.style.cssText =
        'position:absolute;pointer-events:none;box-sizing:border-box;z-index:2147483647;border-radius:4px;' +
        `left:${left}px;top:${top}px;width:${Math.max(r.width, 4)}px;height:${Math.max(r.height, 4)}px;` +
        `background:rgba(${rgb},${alpha});border:${strong ? 3 : 2}px solid rgb(${rgb});` +
        (strong ? `box-shadow:0 0 0 4px rgba(${rgb},.35);` : '');
      const badge = document.createElement('span');
      badge.textContent = String(item.count);
      badge.style.cssText =
        'position:absolute;top:-10px;right:-10px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;' +
        `background:rgb(${rgb});color:#fff;font:600 11px/20px system-ui,sans-serif;text-align:center;`;
      box.appendChild(badge);
      (host || document.documentElement).appendChild(box);
    }
    parent.postMessage({ type: 'mindlens-heatmap-missing', paths: missing }, '*');
  }

  addEventListener('message', (event) => {
    if (event.source !== parent) return;
    const data = event.data;
    if (!data || data.type !== 'mindlens-heatmap') return;
    items = Array.isArray(data.items) ? data.items : [];
    highlight = typeof data.highlight === 'string' ? data.highlight : '';
    draw();
  });
  addEventListener('resize', draw);
}

/** 시안 스크립트가 다시 돌면 DOM 이 바뀌어 경로가 어긋난다 → 제거하고 오버레이만 남긴다. */
export function prepareSnapshot(html: string): string {
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${PROTOTYPE_CSP}">`;
  const overlay = `<script data-mindlens-overlay>(${heatmapOverlay.toString()})()</script>`;
  const headRe = /<head(?:\s[^>]*)?>/i;
  const withMeta = headRe.test(stripped) ? stripped.replace(headRe, (head) => head + meta) : meta + stripped;
  return /<\/body\s*>/i.test(withMeta) ? withMeta.replace(/<\/body\s*>/i, (end) => overlay + end) : withMeta + overlay;
}

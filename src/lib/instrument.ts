import { pickComponent } from './component-pick';
import { matchTask } from './task-rules';
import type { TaskCriteria } from './types';
import { PROTOTYPE_CSP } from './snapshot';

/** 참가자 iframe → 부모 창 메시지. 클릭 1회 = 1개. */
export type PrototypeClick = {
  type: 'mindlens-click' | 'mindlens-pick';
  /** 클릭 순간(시안 핸들러 실행 전) DOM. 주입한 data-mindlens 요소는 제거됨 */
  html: string;
  /** body 부터 컴포넌트까지 tag:nth-of-type 경로 */
  componentPath: string;
  kind: 'interactive' | 'static';
  /** 표시용 이름: data-component → aria-label → 텍스트 40자 → 태그명 */
  component: string;
  tag: string;
  text: string;
  selector: string;
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
};

/**
 * iframe 안에서 실행된다. toString() 으로 주입되므로 함수 밖 값을 참조하지 않고,
 * 컴포넌트 판정 함수는 인자로 받는다(같은 로직이 두 벌 생기지 않게).
 */
export function clickTracker(pick: typeof pickComponent, match: typeof matchTask): void {
  const LISTENED = new WeakSet<Element>();
  const TYPES: Record<string, true> = { click: true, pointerdown: true, pointerup: true, mousedown: true, mouseup: true, touchstart: true, touchend: true };
  const original = EventTarget.prototype.addEventListener;
  // 시안 스크립트보다 먼저 실행되므로 이후 붙는 클릭 리스너를 전부 본다. 전역(window·document·html·body)은 제외.
  EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
    if (TYPES[type] && this instanceof Element && this !== document.documentElement && this !== document.body) LISTENED.add(this);
    return original.call(this, type, listener, options);
  };
  const INTERACTIVE = 'a[href],button,input:not([type=hidden]),select,textarea,label,summary,[onclick],[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=radio],[role=switch],[role=option],[tabindex],[data-component]';
  const ROLES = /^(button|link|tab|menuitem|checkbox|radio|switch|option)$/;

  function isInteractive(el: Element): boolean {
    if (LISTENED.has(el)) return true;
    if (typeof (el as HTMLElement).onclick === 'function') return true;
    if (el.matches('a[href],button,input:not([type=hidden]),select,textarea,label,summary,[onclick]')) return true;
    const role = el.getAttribute('role');
    if (role && ROLES.test(role)) return true;
    const tab = el.getAttribute('tabindex');
    if (tab !== null && Number(tab) >= 0) return true;
    // cursor 는 상속된다 → 포인터 영역의 꼭대기만 센다(위임 리스너로 동작하는 tr.project-row 등).
    const parentEl = el.parentElement;
    return getComputedStyle(el).cursor === 'pointer' && (!parentEl || getComputedStyle(parentEl).cursor !== 'pointer');
  }

  function pathOf(el: Element): string {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body && node !== document.documentElement) {
      const tag = node.localName;
      let n = 1;
      let sib = node.previousElementSibling;
      while (sib) { if (sib.localName === tag) n++; sib = sib.previousElementSibling; }
      parts.unshift(CSS.escape(tag) + ':nth-of-type(' + n + ')');
      node = node.parentElement;
    }
    parts.unshift('body');
    return parts.join('>');
  }

  function snapshot(): string {
    const clone = document.documentElement.cloneNode(true) as HTMLElement;
    const ours = clone.querySelectorAll('[data-mindlens]');
    for (let i = 0; i < ours.length; i++) ours[i].remove();
    return '<!DOCTYPE html>' + clone.outerHTML;
  }

  // 부모가 보내는 의견 모드 스위치. 켜져 있으면 클릭은 시안에 닿지 않고 'mindlens-pick' 으로만 올라간다.
  let commentMode = false;
  let modeStyle: HTMLStyleElement | null = null;
  original.call(window, 'message', function (event: Event) {
    const data = (event as MessageEvent).data;
    if ((event as MessageEvent).source !== parent || !data || data.type !== 'mindlens-mode') return;
    commentMode = !!data.comment;
    if (commentMode && !modeStyle) {
      modeStyle = document.createElement('style');
      modeStyle.setAttribute('data-mindlens', '');
      modeStyle.textContent = '*:hover{outline:2px dashed #00A4DF !important;outline-offset:-2px}';
      (document.head || document.documentElement).appendChild(modeStyle);
    } else if (!commentMode && modeStyle) {
      modeStyle.remove();
      modeStyle = null;
    }
  }, false);

  // 부모가 보내는 과업 기준. 활성 동안만 성공을 감시하고, 한 번 맞으면 스스로 해제한다(1회 발화).
  let criteria: TaskCriteria | null = null;
  let observer: MutationObserver | null = null;
  let debounce = 0;
  const timers: number[] = [];
  function clearTask(): void {
    criteria = null;
    if (observer) { observer.disconnect(); observer = null; }
    clearTimeout(debounce);
    while (timers.length) clearTimeout(timers.pop() as number);
  }
  function checkText(): void {
    if (!criteria || !criteria.text) return;
    if (match({ text: criteria.text }, { pageText: document.body ? document.body.innerText : '' }) === 'text') {
      clearTask();
      parent.postMessage({ type: 'mindlens-task-hit', by: 'text', html: snapshot() }, '*');
    }
  }
  function armTask(next: TaskCriteria | null): void {
    clearTask();
    if (!next) return;
    criteria = next;
    // 설정 순간에는 확인하지 않는다 — 이후의 클릭이나 DOM 변화에서만 본다.
    if (next.text && document.body) {
      observer = new MutationObserver(function () { clearTimeout(debounce); debounce = setTimeout(checkText, 150) as unknown as number; });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    }
  }
  original.call(window, 'message', function (event: Event) {
    const data = (event as MessageEvent).data;
    if ((event as MessageEvent).source !== parent || !data || data.type !== 'mindlens-task') return;
    armTask(data.criteria || null);
  }, false);

  // window 캡처 단계 = 시안 핸들러보다 먼저 → 화면이 바뀌기 전 상태가 스냅샷에 남는다.
  original.call(window, 'click', function (event: Event) {
    const raw = event.target;
    if (!(raw instanceof Element)) return;
    if (commentMode) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); }
    const els: Element[] = [];
    let node: Element | null = raw;
    while (node && node !== document.body && node !== document.documentElement) { els.push(node); node = node.parentElement; }
    const chain = els.map(function (el) {
      const r = el.getBoundingClientRect();
      return { interactive: isInteractive(el), explicit: el.hasAttribute('data-component'), area: r.width * r.height, descendants: el.querySelectorAll(INTERACTIVE).length };
    });
    const picked = pick(chain, innerWidth * innerHeight);
    const el = picked.index >= 0 ? els[picked.index] : document.body;
    const text = ((el as HTMLElement).innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 180);
    const component = el.getAttribute('data-component') || el.getAttribute('aria-label') || text.slice(0, 40) || el.localName;
    let selector = el.localName;
    if (el.id) selector += '#' + CSS.escape(el.id);
    else if (el.classList.length) selector += '.' + Array.from(el.classList).slice(0, 3).map(function (c) { return CSS.escape(c); }).join('.');
    const mouse = event as MouseEvent;
    parent.postMessage({ type: commentMode ? 'mindlens-pick' : 'mindlens-click', html: snapshot(), componentPath: pathOf(el), kind: picked.kind, component, tag: el.localName, text, selector, x: mouse.clientX, y: mouse.clientY, viewportWidth: innerWidth, viewportHeight: innerHeight }, '*');
    if (!commentMode && criteria) {
      const componentPath = pathOf(el);
      if (match(criteria, { componentPath, label: component }) === 'component') {
        clearTask();
        parent.postMessage({ type: 'mindlens-task-hit', by: 'component' }, '*');
      } else if (criteria.text) {
        timers.push(setTimeout(checkText, 150) as unknown as number, setTimeout(checkText, 600) as unknown as number);
      }
    }
  }, true);
}

export function instrument(html: string): string {
  const meta = `<meta data-mindlens http-equiv="Content-Security-Policy" content="${PROTOTYPE_CSP}">`;
  const script = `<script data-mindlens>(${clickTracker.toString()})(${pickComponent.toString()},${matchTask.toString()})</script>`;
  const headRe = /<head(?:\s[^>]*)?>/i;
  return headRe.test(html) ? html.replace(headRe, (head) => head + meta + script) : meta + script + html;
}

import { pickComponent } from './component-pick';
import { PROTOTYPE_CSP } from './snapshot';

/** 참가자 iframe → 부모 창 메시지. 클릭 1회 = 1개. */
export type PrototypeClick = {
  type: 'mindlens-click';
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
export function clickTracker(pick: typeof pickComponent): void {
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

  // window 캡처 단계 = 시안 핸들러보다 먼저 → 화면이 바뀌기 전 상태가 스냅샷에 남는다.
  original.call(window, 'click', function (event: Event) {
    const raw = event.target;
    if (!(raw instanceof Element)) return;
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
    parent.postMessage({ type: 'mindlens-click', html: snapshot(), componentPath: pathOf(el), kind: picked.kind, component, tag: el.localName, text, selector, x: mouse.clientX, y: mouse.clientY, viewportWidth: innerWidth, viewportHeight: innerHeight }, '*');
  }, true);
}

export function instrument(html: string): string {
  const meta = `<meta data-mindlens http-equiv="Content-Security-Policy" content="${PROTOTYPE_CSP}">`;
  const script = `<script data-mindlens>(${clickTracker.toString()})(${pickComponent.toString()})</script>`;
  const headRe = /<head(?:\s[^>]*)?>/i;
  return headRe.test(html) ? html.replace(headRe, (head) => head + meta + script) : meta + script + html;
}

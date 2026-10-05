import { pickComponent } from './component-pick';
import { matchTask, readState, stateMatches } from './task-rules';
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
  /** 선택(mindlens-pick) 때만: 상태 기준 후보. 앵커·경로·표시 이름과 현재 속성 값들 */
  stateTarget?: { anchor?: string; anchorIndex?: number; path: string; label: string; props: { text: string; value?: string; checked?: string; attrs: Record<string, string> } };
};

/**
 * iframe 안에서 실행된다. toString() 으로 주입되므로 함수 밖 값을 참조하지 않고,
 * 컴포넌트 판정 함수는 인자로 받는다(같은 로직이 두 벌 생기지 않게).
 */
export function clickTracker(pick: typeof pickComponent, match: typeof matchTask, read: typeof readState, stateOk: typeof stateMatches): void {
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

  // 폼 요소의 라이브 상태(속성이 아니라 프로퍼티)를 복제본의 속성으로 옮긴다 — 직렬화 결과가 참가자가 본 화면과 같아진다.
  function mirror(live: Element, clone: Element): void {
    const SEL = 'input,select,textarea';
    const a: Element[] = live.matches(SEL) ? [live] : [];
    const b: Element[] = clone.matches(SEL) ? [clone] : [];
    const la = live.querySelectorAll(SEL);
    const lb = clone.querySelectorAll(SEL);
    for (let i = 0; i < la.length; i++) a.push(la[i]);
    for (let i = 0; i < lb.length; i++) b.push(lb[i]);
    for (let i = 0; i < a.length && i < b.length; i++) {
      const l = a[i] as HTMLInputElement;
      const c = b[i];
      if (l.localName !== c.localName) continue;
      if (l.localName === 'textarea') c.textContent = l.value;
      else if (l.localName === 'select') {
        const lo = (l as unknown as HTMLSelectElement).options;
        const co = (c as HTMLSelectElement).options;
        for (let j = 0; j < lo.length && j < co.length; j++) { if (lo[j].selected) co[j].setAttribute('selected', ''); else co[j].removeAttribute('selected'); }
      } else if (l.type === 'checkbox' || l.type === 'radio') {
        if (l.checked) c.setAttribute('checked', ''); else c.removeAttribute('checked');
      } else if (l.type !== 'password' && l.type !== 'file') c.setAttribute('value', l.value);
    }
  }

  function snapshot(): string {
    const clone = document.documentElement.cloneNode(true) as HTMLElement;
    mirror(document.documentElement, clone);
    const ours = clone.querySelectorAll('[data-mindlens]');
    for (let i = 0; i < ours.length; i++) ours[i].remove();
    return '<!DOCTYPE html>' + clone.outerHTML;
  }

  // 상태 기준 후보: 가장 가까운 안정 앵커(id 또는 data-*-id 류)와 그 아래 nth-of-type 경로.
  const ANCHOR_ATTR = /^data-(project-id|task-id|member-id|notification-id|setting|id|key)$|^data-.+-id$/;
  function anchorSelector(node: Element): string | null {
    if (node.id && document.querySelectorAll('#' + CSS.escape(node.id)).length === 1) return '#' + CSS.escape(node.id);
    for (let i = 0; i < node.attributes.length; i++) {
      const at = node.attributes[i];
      if (ANCHOR_ATTR.test(at.name) && at.value) return '[' + at.name + '="' + at.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]';
    }
    return null;
  }
  function chainFrom(el: Element, stop: Element): string {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== stop) {
      const tag = node.localName;
      let n = 1;
      let sib = node.previousElementSibling;
      while (sib) { if (sib.localName === tag) n++; sib = sib.previousElementSibling; }
      parts.unshift(CSS.escape(tag) + ':nth-of-type(' + n + ')');
      node = node.parentElement;
    }
    return parts.join('>');
  }
  function clip(v: string): string { return v.replace(/\s+/g, ' ').trim().slice(0, 200); }
  function stateTargetOf(raw: Element): PrototypeClick['stateTarget'] {
    // data-field / data-setting 이 붙은 가까운 조상이 있으면 그걸 대상으로 본다(글자만 감싼 <b> 같은 걸 피한다).
    let el: Element = raw;
    let up: Element | null = raw;
    while (up && up !== document.body && up !== document.documentElement) {
      if (up.hasAttribute('data-field') || up.hasAttribute('data-setting')) { el = up; break; }
      up = up.parentElement;
    }
    // 같은 선택자가 여러 요소와 맞을 수 있다(보드 카드·목록 행·상세 패널) → 보이는 앵커를 우선하고, 고른 요소의 순번을 함께 저장한다.
    let anchorEl: Element | null = null;
    let anchor: string | undefined;
    let node: Element | null = el;
    while (node && node !== document.body && node !== document.documentElement) {
      const sel = anchorSelector(node);
      if (sel) {
        if (!anchorEl) { anchorEl = node; anchor = sel; }
        if (node.getClientRects().length > 0) { anchorEl = node; anchor = sel; break; }
      }
      node = node.parentElement;
    }
    let anchorIndex = 0;
    if (anchorEl && anchor) anchorIndex = Math.max(0, Array.prototype.indexOf.call(document.querySelectorAll(anchor), anchorEl));
    const path = anchorEl ? (anchorEl === el ? '' : chainFrom(el, anchorEl)) : chainFrom(el, document.body);
    const field = el.getAttribute('data-field') || el.getAttribute('data-setting') || '';
    let name = '';
    if (anchorEl) {
      const nameEl = anchorEl.querySelector('[data-field="name"]') || anchorEl.querySelector('h1,h2,h3,h4,h5,h6');
      if (nameEl && nameEl !== el) name = clip((nameEl as HTMLElement).innerText || nameEl.textContent || '').slice(0, 60);
      else if (anchorEl.getAttribute('aria-label')) name = clip(anchorEl.getAttribute('aria-label') as string).slice(0, 60);
    }
    const label = [name, field].filter(Boolean).join(' · ').slice(0, 100);
    const live = el as HTMLInputElement;
    const attrs: Record<string, string> = {};
    for (let i = 0; i < el.attributes.length; i++) {
      const at = el.attributes[i];
      if (/^data-|^aria-/.test(at.name) || at.name === 'value' || at.name === 'checked' || at.name === 'selected' || at.name === 'class') attrs[at.name] = at.value.slice(0, 200);
    }
    const props: { text: string; value?: string; checked?: string; attrs: Record<string, string> } = { text: clip((el as HTMLElement).innerText || el.textContent || ''), attrs };
    if (typeof live.value === 'string' && /^(input|select|textarea)$/.test(el.localName)) { props.value = live.value.slice(0, 200); attrs.value = props.value; }
    if (el.localName === 'input' && (live.type === 'checkbox' || live.type === 'radio')) props.checked = String(!!live.checked);
    return { anchor, anchorIndex: anchorIndex || undefined, path, label, props };
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
  function checkState(): void {
    const st = criteria && criteria.state;
    if (!st || !stateOk(st, read(st, document))) return;
    let proof = '';
    try {
      const root: Element | null = st.anchor ? document.querySelectorAll(st.anchor)[st.anchorIndex || 0] || null : document.body;
      const el = root && st.path ? root.querySelector(':scope > ' + st.path) : root;
      if (el) {
        const copy = el.cloneNode(true) as Element;
        mirror(el, copy);
        proof = copy.outerHTML.slice(0, 20000);
      }
    } catch (e) { proof = ''; }
    clearTask();
    parent.postMessage({ type: 'mindlens-task-hit', by: 'state', html: snapshot(), proof }, '*');
  }
  function armTask(next: TaskCriteria | null): void {
    clearTask();
    if (!next) return;
    criteria = next;
    // 설정 순간에는 확인하지 않는다 — 이후의 클릭·입력·DOM 변화에서만 본다.
    if (next.state && document.body) {
      observer = new MutationObserver(function () { clearTimeout(debounce); debounce = setTimeout(checkState, 150) as unknown as number; });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    }
  }
  function onFormEvent(): void {
    if (criteria && criteria.state) timers.push(setTimeout(checkState, 50) as unknown as number);
  }
  original.call(window, 'input', onFormEvent, true);
  original.call(window, 'change', onFormEvent, true);
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
    const message: PrototypeClick = { type: commentMode ? 'mindlens-pick' : 'mindlens-click', html: snapshot(), componentPath: pathOf(el), kind: picked.kind, component, tag: el.localName, text, selector, x: mouse.clientX, y: mouse.clientY, viewportWidth: innerWidth, viewportHeight: innerHeight };
    if (commentMode) message.stateTarget = stateTargetOf(raw);
    parent.postMessage(message, '*');
    if (!commentMode && criteria) {
      const componentPath = pathOf(el);
      if (match(criteria, { componentPath, label: component }) === 'component') {
        clearTask();
        parent.postMessage({ type: 'mindlens-task-hit', by: 'component' }, '*');
      } else if (criteria.state) {
        timers.push(setTimeout(checkState, 150) as unknown as number, setTimeout(checkState, 600) as unknown as number);
      }
    }
  }, true);
}

export function instrument(html: string): string {
  const meta = `<meta data-mindlens http-equiv="Content-Security-Policy" content="${PROTOTYPE_CSP}">`;
  const script = `<script data-mindlens>(${clickTracker.toString()})(${pickComponent.toString()},${matchTask.toString()},${readState.toString()},${stateMatches.toString()})</script>`;
  const headRe = /<head(?:\s[^>]*)?>/i;
  return headRe.test(html) ? html.replace(headRe, (head) => head + meta + script) : meta + script + html;
}

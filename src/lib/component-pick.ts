/**
 * 클릭 대상에서 위로 올라간 조상 목록 중 어느 요소를 "컴포넌트"로 셀지 고른다.
 *
 * ⚠️ 이 함수는 instrument.ts 가 toString() 으로 참가자 iframe 에 그대로 주입한다.
 *    함수 밖의 값(상수·헬퍼)을 참조하지 말고, 스프레드·클래스·async 를 쓰지 말 것.
 *
 * 규칙(설계 3-4): 상호작용 후보 중 가장 바깥쪽. 단 아래는 후보에서 뺀다.
 *   - 뷰포트 면적 60% 이상 (이벤트 위임용 앱 래퍼)
 *   - 안에 상호작용 요소가 2개 이상 (리스너를 단 묶음 컨테이너)
 *   data-component 로 명시된 요소는 위 두 규칙과 무관하게 후보다.
 */
export type ChainItem = {
  /** 태그·role·리스너·cursor:pointer 등으로 판정한 상호작용 여부 */
  interactive: boolean;
  /** 의뢰자가 data-component 로 경계를 명시했는가 */
  explicit: boolean;
  /** 화면상 면적(px²) */
  area: number;
  /** 자기 아래에 있는 상호작용 요소 수 */
  descendants: number;
};

export type ComponentPick = { index: number; kind: 'interactive' | 'static' };

export function pickComponent(chain: ChainItem[], viewportArea: number): ComponentPick {
  let best = -1;
  for (let i = 0; i < chain.length; i++) {
    const item = chain[i];
    if (item.explicit) { best = i; continue; }
    if (!item.interactive) continue;
    if (item.area >= viewportArea * 0.6) continue;
    if (item.descendants >= 2) continue;
    best = i;
  }
  if (best >= 0) return { index: best, kind: 'interactive' };
  return { index: chain.length ? 0 : -1, kind: 'static' };
}

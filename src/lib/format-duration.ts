/** 체험 시간 표시: 300 → '5분', 90 → '1분 30초', 45 → '45초'. 값 import 없음(Node 테스트 가능). */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60), r = s % 60;
  if (!m) return `${r}초`;
  return r ? `${m}분 ${r}초` : `${m}분`;
}

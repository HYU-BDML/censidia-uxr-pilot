// 화면 HTML 은 화면 id 당 한 번만 받는다. 호출자는 언마운트 시 결과를 무시하고(alive 플래그) 공유 promise 는 취소하지 않는다.
const htmlCache = new Map<string, Promise<string>>();
export function loadScreen(id: string): Promise<string> {
  let p = htmlCache.get(id);
  if (!p) {
    p = fetch(`/api/screens/${id}`).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    });
    p.catch(() => htmlCache.delete(id)); // 실패는 캐시하지 않는다(다음 호출에서 재시도)
    htmlCache.set(id, p);
  }
  return p;
}

/**
 * 화면 스냅샷 해시 — 참가자 브라우저와 서버가 **같은 함수**를 쓴다.
 *
 * crypto.subtle(SHA-256)을 쓰지 않는 이유: 앱이 0.0.0.0 으로 떠서 다른 기기가
 * http://192.168.x.x 로 참여하면 보안 컨텍스트가 아니라 crypto.subtle 이 없다.
 * 위조 방지는 서버가 이 함수로 다시 계산해 대조하는 것으로 충분하다.
 *
 * Node 테스트가 직접 import 하므로 값 import 를 하지 않는다.
 */
export const SCREEN_HASH_PATTERN = /^[0-9a-f]{28}$/;

/** 이보다 큰 스냅샷은 저장하지 않는다(클라이언트가 보내지 않고, 서버는 400). */
export const MAX_SCREEN_CHARS = 2_000_000;

function cyrb53(str: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export function screenHash(html: string): string {
  return cyrb53(html, 0x9e3779b9) + cyrb53(html, 0x85ebca6b);
}

export function screenId(studyId: string, variant: 'A' | 'B', hash: string): string {
  return `${studyId}_${variant}_${hash}`;
}

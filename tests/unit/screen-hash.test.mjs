import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenHash, screenId, SCREEN_HASH_PATTERN, MAX_SCREEN_CHARS } from '../../src/lib/screen-hash.ts';

test('같은 HTML 은 같은 해시, 28자리 16진수', () => {
  const html = '<!DOCTYPE html><html><body><button>저장</button></body></html>';
  assert.equal(screenHash(html), screenHash(html));
  assert.match(screenHash(html), SCREEN_HASH_PATTERN);
});

test('한 글자만 달라도 해시가 다르다', () => {
  assert.notEqual(screenHash('<p>a</p>'), screenHash('<p>b</p>'));
  assert.notEqual(screenHash(''), screenHash(' '));
});

test('화면 ID 는 연구_시안_해시', () => {
  const h = screenHash('x');
  assert.equal(screenId('study-1', 'B', h), `study-1_B_${h}`);
});

test('상한은 200만 자', () => {
  assert.equal(MAX_SCREEN_CHARS, 2_000_000);
});

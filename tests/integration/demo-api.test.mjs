import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3100';
const post = (path, body) => fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('같은 의뢰자가 샘플 연구를 다시 누르면 기존 샘플 연구를 돌려준다', async () => {
  const owner = `demo-reuse-${Date.now()}`;
  const first = await post('/api/demo', { owner, durationSeconds: 60 });
  assert.equal(first.status, 201);
  const a = (await first.json()).study;
  const again = await post('/api/demo', { owner, durationSeconds: 60 });
  assert.equal(again.status, 200);
  const b = (await again.json()).study;
  assert.equal(b.id, a.id);
  const list = (await (await fetch(`${BASE}/api/studies?owner=${encodeURIComponent(owner)}`)).json()).studies;
  assert.equal(list.filter((s) => s.isDemo).length, 1);
});

test('다른 의뢰자는 각자 자기 샘플 연구를 받는다', async () => {
  const stamp = Date.now();
  const a = (await (await post('/api/demo', { owner: `demo-a-${stamp}`, durationSeconds: 60 })).json()).study;
  const b = (await (await post('/api/demo', { owner: `demo-b-${stamp}`, durationSeconds: 60 })).json()).study;
  assert.notEqual(a.id, b.id);
});

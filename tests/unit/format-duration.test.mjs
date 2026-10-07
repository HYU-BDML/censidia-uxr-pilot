import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration } from '../../src/lib/format-duration.ts';

test('체험 시간을 분·초로 표시한다', () => {
  assert.equal(formatDuration(300), '5분');
  assert.equal(formatDuration(60), '1분');
  assert.equal(formatDuration(90), '1분 30초');
  assert.equal(formatDuration(45), '45초');
  assert.equal(formatDuration(0), '0초');
});

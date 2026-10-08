import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell } from '../../src/lib/csv-cell.ts';
test('quotes and escapes', () => {
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(1.5), '"1.5"');
});
test('neutralizes formula prefixes', () => {
  for (const c of ['=', '+', '-', '@']) assert.equal(csvCell(c + 'SUM(1)'), `"'${c}SUM(1)"`);
  assert.equal(csvCell('a=b'), '"a=b"');
});

import test from 'node:test';
import assert from 'node:assert/strict';

function reviewFlags(extraction, threshold = 0.82) {
  const flags = [];
  for (const [field, confidence] of Object.entries(extraction.confidence.fields)) {
    if (confidence < threshold) flags.push({ field, confidence });
  }
  if (extraction.confidence.overall < threshold) flags.unshift({ field: '_overall', confidence: extraction.confidence.overall });
  return flags;
}

test('low-confidence expiry date requires review', () => {
  const flags = reviewFlags({ confidence: { overall: 0.91, fields: { merchantName: 0.98, validUntil: 0.61 } } });
  assert.deepEqual(flags.map(x => x.field), ['validUntil']);
});

test('high-confidence extraction passes without review', () => {
  const flags = reviewFlags({ confidence: { overall: 0.93, fields: { merchantName: 0.97, validUntil: 0.90 } } });
  assert.equal(flags.length, 0);
});

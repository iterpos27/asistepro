const test = require('node:test');
const assert = require('node:assert/strict');
const { ecuadorDate: backendDate } = require('../src/utils/ecuador-date.util');

test('frontend y servidor conservan el dia de Ecuador despues de las 19h y hasta medianoche', async () => {
  const { ecuadorDate, ecuadorDateTime } = await import('../../frontend/src/utils/ecuador-date.js');
  const cases = [
    ['2026-09-03T02:21:00Z', '2026-09-02'],
    ['2026-09-03T04:59:59Z', '2026-09-02'],
    ['2026-09-03T05:00:00Z', '2026-09-03'],
    ['2026-10-01T03:00:00Z', '2026-09-30'],
    ['2027-01-01T02:00:00Z', '2026-12-31'],
    ['2024-03-01T02:00:00Z', '2024-02-29'],
  ];
  for (const [instant, expected] of cases) {
    assert.equal(ecuadorDate(new Date(instant)), expected);
    assert.equal(backendDate(new Date(instant)), expected);
  }
  assert.match(ecuadorDateTime('2026-09-03T02:21:00Z'), /2\/9\/2026/);
  assert.equal(ecuadorDateTime(null), '-');
});

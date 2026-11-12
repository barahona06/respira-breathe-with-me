// Tests for the mock (simulated) signal source.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMockSource } = require('../src/mock');

test('mock emits normalized samples in the shared shape, flagged simulated', async () => {
  const samples = [];
  const src = createMockSource({ onSample: (s) => samples.push(s), tickMs: 20 });
  assert.equal(src.simulated, true);
  src.start();
  await new Promise((r) => setTimeout(r, 160));
  src.stop();
  assert.ok(samples.length >= 3, `expected several samples, got ${samples.length}`);
  for (const s of samples) {
    assert.equal(s.simulated, true);
    assert.equal(typeof s.t, 'number');
    assert.ok(s.pulseRate > 40 && s.pulseRate < 110, `pulse ${s.pulseRate}`);
    assert.ok(s.breathingRate >= 5 && s.breathingRate <= 40, `breathing ${s.breathingRate}`);
    assert.equal(typeof s.chestTrace, 'number');
    assert.equal(s.hrvRmssd, null); // HRV needs a 60s window, like the real SDK
  }
});

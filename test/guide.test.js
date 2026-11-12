// Tests for the pure breathing-guide logic (no Electron, no SDK).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BreathingGuide, median } = require('../src/guide');

function sample(t, br, conf = 0.9, pr = 72) {
  return {
    t,
    breathingRate: br,
    breathingConfidence: conf,
    pulseRate: pr,
    pulseConfidence: 0.9,
  };
}

test('median basics', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('guide does not calibrate before the window fills', () => {
  const g = new BreathingGuide({ calibrationMs: 30000 });
  for (let t = 0; t < 10000; t += 1000) g.observe(sample(t, 14));
  assert.equal(g.calibrated, false);
  assert.equal(g.adherence(), null);
});

test('guide calibrates to the observed median baseline', () => {
  const g = new BreathingGuide({ calibrationMs: 5000 });
  for (let t = 0; t <= 6000; t += 1000) g.observe(sample(t, 14));
  assert.equal(g.calibrated, true);
  assert.equal(g.baseline, 14);
  assert.equal(g.targetRate(), 14);
});

test('noisy low-confidence samples are ignored', () => {
  const g = new BreathingGuide({ calibrationMs: 1000 });
  for (let t = 0; t <= 4000; t += 500) g.observe(sample(t, 30, 0.1));
  assert.equal(g.calibrated, false);
});

test('target eases down toward the floor but never below it', () => {
  const g = new BreathingGuide({ calibrationMs: 1000, rampStepMs: 1000, rampStep: 1 });
  for (let t = 0; t <= 2000; t += 500) g.observe(sample(t, 10));
  assert.equal(g.calibrated, true);
  for (let t = 2500; t <= 60000; t += 1000) g.observe(sample(t, 8));
  assert.ok(g.targetRate() >= 5.5, `target ${g.targetRate()} below floor`);
  assert.equal(g.targetRate(), 5.5);
});

test('phaseAt cycles between inhale and exhale', () => {
  const g = new BreathingGuide();
  const cycleMs = 60000 / g.targetRate();
  const p0 = g.phaseAt(0);
  assert.equal(p0.phase, 'inhale');
  const p1 = g.phaseAt(cycleMs * 0.9);
  assert.equal(p1.phase, 'exhale');
  const s0 = g.circleScaleAt(0);
  const sMid = g.circleScaleAt(cycleMs * 0.4); // end of inhale
  assert.ok(sMid > s0, 'circle should grow during inhale');
});

test('adherence counts samples near the target', () => {
  const g = new BreathingGuide({ calibrationMs: 1000, rampStepMs: 999999 });
  for (let t = 0; t <= 2000; t += 500) g.observe(sample(t, 12));
  assert.equal(g.calibrated, true);
  for (let t = 2500; t <= 6000; t += 500) g.observe(sample(t, 12.4));
  assert.equal(g.adherence(), 100);
});

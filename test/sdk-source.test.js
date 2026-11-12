// sdk-source.test.js — regression tests for the REAL metrics path.
//
// The failure these tests guard against (first live test, 11 Nov 2026):
// the session streamed and billed credits, but the summary came out
// "Not enough data" with duration 00:00. Root cause: the 'metrics'
// handler in src/sdkSource.js referenced the Node.js byte-buffer
// global in a guard. That global exists under Node (so unit tests
// passed) but NOT in the shipped renderer bundle, which esbuild builds
// with --platform=browser and which runs in a nodeIntegration:false
// page. The reference threw on every metrics packet; the SDK's event
// emitter swallowed the throw into a console line; zero samples were
// ever recorded. See nota-diagnostico-real.md in the project root.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { mergeMetricsIntoLatest } = require('../src/sdkSource');
const { Metrics, decodeMetrics } = require('@smartspectra/node-sdk/messages');

const BUNDLED_SOURCES = ['sdkSource.js', 'renderer.js', 'mock.js', 'guide.js', 'i18n.js'];

test('browser-bundled sources never use the Node byte-buffer global', () => {
  // Any `Buffer.` property access in these files is a runtime crash in
  // the packaged renderer, where the global is undefined. (Mentions of
  // the word in comments are fine; this matches actual member access.)
  const memberAccess = /(^|[^\w$.])Buffer\s*\./m;
  for (const name of BUNDLED_SOURCES) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');
    assert.ok(
      !memberAccess.test(src),
      `${name} must not reference the Node byte-buffer global (absent in the renderer bundle)`,
    );
  }
});

function freshLatest() {
  return {
    pulseRate: null,
    pulseConfidence: null,
    breathingRate: null,
    breathingConfidence: null,
    chestTrace: null,
    pulseTrace: null,
    hrvRmssd: null,
  };
}

function encodeMetrics(obj) {
  return Metrics.encode(Metrics.create(obj)).finish();
}

test('a decoded Metrics packet with rates fills the latest channels', () => {
  const buf = encodeMetrics({
    breathing: {
      rate: [{ value: 12.5, confidence: 80, stable: true, timestamp: 1000000 }],
      upperTrace: [{ value: 0.25, timestamp: 1000000 }],
    },
    cardio: {
      pulseRate: [{ value: 62, confidence: 90, stable: true, timestamp: 1000000 }],
      arterialPressureTrace: [
        { value: 0.5, confidence: 90, timestamp: 1000000 },
      ],
      hrv: [{ rmssd: 42 }],
    },
  });

  const metrics = decodeMetrics(buf);
  const latest = freshLatest();
  const hasSample = mergeMetricsIntoLatest(metrics, latest);

  assert.equal(hasSample, true);
  assert.equal(latest.breathingRate, 12.5);
  assert.equal(latest.breathingConfidence, 80);
  assert.equal(latest.chestTrace, 0.25);
  assert.equal(latest.pulseRate, 62);
  assert.equal(latest.pulseConfidence, 90);
  assert.equal(latest.pulseTrace, 0.5);
  assert.equal(latest.hrvRmssd, 42);
});

test('windowed slices keep previous channel values when a channel is absent', () => {
  const latest = freshLatest();
  const first = decodeMetrics(
    encodeMetrics({
      breathing: { rate: [{ value: 11, confidence: 70, timestamp: 1 }] },
    }),
  );
  assert.equal(mergeMetricsIntoLatest(first, latest), true);
  assert.equal(latest.breathingRate, 11);
  assert.equal(latest.pulseRate, null);

  const second = decodeMetrics(
    encodeMetrics({
      cardio: { pulseRate: [{ value: 58, confidence: 88, timestamp: 2 }] },
    }),
  );
  assert.equal(mergeMetricsIntoLatest(second, latest), true);
  assert.equal(latest.breathingRate, 11); // kept from the previous slice
  assert.equal(latest.pulseRate, 58);
});

test('an empty Metrics packet produces no sample', () => {
  const metrics = decodeMetrics(encodeMetrics({}));
  const latest = freshLatest();
  assert.equal(mergeMetricsIntoLatest(metrics, latest), false);
  assert.deepEqual(latest, freshLatest());
});

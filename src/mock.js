// mock.js — Simulated signal source for Respira's DEMO MODE.
//
// =====================================================================
//  THIS MODULE IS ONLY FOR DEVELOPMENT AND FOR TRYING THE APP WITHOUT
//  AN API KEY OR CAMERA. It fabricates plausible-looking numbers. The
//  demo-mode banner is always visible in the UI when this source is in
//  use, the session summary is labeled simulated, and the challenge
//  submission will be recorded with the REAL SDK source. Simulated
//  data must never be presented as a real measurement.
// =====================================================================
//
// It emits samples in exactly the same normalized shape as the real
// SmartSpectra source (sdkSource.js):
//   { t, pulseRate, pulseConfidence, breathingRate,
//     breathingConfidence, chestTrace, pulseTrace, hrvRmssd }

'use strict';

function createMockSource({ onSample, tickMs = 100 } = {}) {
  let timer = null;
  let t0 = 0;
  // Scripted "person": starts a bit alert and settles over ~3 minutes.
  let pulse = 76;
  let breathing = 14.2;
  let phase = 0; // breathing phase accumulator (radians)
  let pulsePhase = 0;
  let noise = 0;

  // Cheap deterministic wander so tests are stable.
  function wander(seed) {
    noise = (noise * 1103515245 + 12345 + seed) % 2147483648;
    return noise / 2147483648 - 0.5;
  }

  function tick() {
    const now = Date.now();
    const elapsed = now - t0;
    const settle = Math.min(1, elapsed / 180000); // 0 → 1 over 3 minutes

    const targetBreathing = 14.2 + (6.4 - 14.2) * settle;
    breathing += (targetBreathing - breathing) * 0.01 + wander(7) * 0.06;
    const targetPulse = 76 + (64 - 76) * settle;
    pulse += (targetPulse - pulse) * 0.008 + wander(13) * 0.25;

    // Breathing waveform: near-sine at the current rate.
    phase += (2 * Math.PI * (breathing / 60)) * (tickMs / 1000);
    const chest = Math.sin(phase) * 0.8 + Math.sin(phase * 2) * 0.12;

    // Pulse waveform: sharper beat at the current pulse rate.
    pulsePhase += (2 * Math.PI * (pulse / 60)) * (tickMs / 1000);
    const beat = Math.pow(Math.max(0, Math.sin(pulsePhase)), 6);

    onSample({
      t: now,
      pulseRate: Math.round(pulse * 10) / 10,
      pulseConfidence: 0.9,
      breathingRate: Math.round(breathing * 10) / 10,
      breathingConfidence: 0.92,
      chestTrace: Math.round(chest * 1000) / 1000,
      pulseTrace: Math.round(beat * 1000) / 1000,
      // The real SDK needs a 60 s window before HRV exists; mirror that.
      hrvRmssd: elapsed > 60000 ? Math.round(36 + Math.sin(elapsed / 30000) * 5) : null,
      simulated: true,
    });
  }

  return {
    simulated: true,
    start() {
      if (timer) return;
      t0 = Date.now();
      timer = setInterval(tick, tickMs);
      tick();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

module.exports = { createMockSource };

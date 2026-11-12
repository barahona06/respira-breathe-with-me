// guide.js — Adaptive breathing-guide logic for Respira (pure, testable).
//
// The guide NEVER imposes a pace from nothing. It works in two stages:
//  1. Calibration: it observes the user's real breathing rate (only
//     samples with decent confidence) and establishes a personal
//     baseline — the median of the observed rates.
//  2. Guidance: the target pace starts at that baseline and eases down
//     slowly (a gentle ramp) toward a floor of 5.5 breaths/min, a widely
//     used calm pace. If the user's pulse climbs notably above its own
//     session baseline, the guide eases off slightly instead of pushing.
//
// This module makes no medical claims; it only schedules a visual pacer.

'use strict';

const DEFAULTS = {
  calibrationMs: 30000, // observing before the ramp starts
  minConfidence: 0.5, // ignore noisier samples
  rampStepMs: 20000, // how often the target eases down
  rampStep: 0.5, // breaths/min per step
  floorRate: 5.5, // never guide slower than this
  maxBaseline: 20, // clamp a noisy baseline
  minBaseline: 7, // clamp a noisy baseline
  inhaleFraction: 0.4, // 40% of the cycle in, 60% out
  pulseEaseThreshold: 12, // bpm above pulse baseline => ease off
  pulseEaseStep: 0.5,
};

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

class BreathingGuide {
  constructor(options = {}) {
    this.cfg = { ...DEFAULTS, ...options };
    this.reset();
  }

  reset() {
    this.startedAt = null;
    this.breathSamples = []; // {t, rate} accepted during calibration
    this.baseline = null; // personal breathing baseline (breaths/min)
    this.pulseSamples = [];
    this.pulseBaseline = null;
    this.target = null; // current target rate (breaths/min)
    this.lastRampAt = null;
    this.guidedSamples = []; // {t, measured, target} for adherence
  }

  // Feed one normalized sample: { t (ms, monotonic-ish), breathingRate,
  // breathingConfidence, pulseRate, pulseConfidence }.
  observe(sample) {
    if (!sample || typeof sample.t !== 'number') return;
    if (this.startedAt === null) this.startedAt = sample.t;
    const elapsed = sample.t - this.startedAt;

    const br = sample.breathingRate;
    if (typeof br === 'number' && br > 0 && (sample.breathingConfidence ?? 1) >= this.cfg.minConfidence) {
      if (this.baseline === null) {
        this.breathSamples.push({ t: sample.t, rate: br });
        if (
          elapsed >= this.cfg.calibrationMs &&
          this.breathSamples.length >= 3
        ) {
          this.baseline = clamp(
            median(this.breathSamples.map((s) => s.rate)),
            this.cfg.minBaseline,
            this.cfg.maxBaseline,
          );
          this.target = this.baseline;
          this.lastRampAt = sample.t;
        }
      } else {
        this.guidedSamples.push({ t: sample.t, measured: br, target: this.target });
      }
    }

    const pr = sample.pulseRate;
    if (typeof pr === 'number' && pr > 0) {
      if (this.pulseBaseline === null) {
        this.pulseSamples.push(pr);
        if (this.pulseSamples.length >= 5) {
          this.pulseBaseline = median(this.pulseSamples);
        }
      }
    }

    // Gentle ramp down, and ease off if the pulse says "too much".
    if (this.baseline !== null && sample.t - this.lastRampAt >= this.cfg.rampStepMs) {
      this.lastRampAt = sample.t;
      let next = Math.max(this.cfg.floorRate, this.target - this.cfg.rampStep);
      if (
        this.pulseBaseline !== null &&
        typeof pr === 'number' &&
        pr > this.pulseBaseline + this.cfg.pulseEaseThreshold
      ) {
        next = Math.min(this.baseline, next + this.cfg.pulseEaseStep);
      }
      this.target = next;
    }
  }

  get calibrated() {
    return this.baseline !== null;
  }

  // Current target breathing rate (breaths/min). Before calibration the
  // guide breathes at a neutral 6/min display pace but does not count
  // adherence yet.
  targetRate() {
    return this.target !== null ? this.target : 6;
  }

  // Phase of the breathing cycle at absolute time t (ms, same clock as
  // the samples). Returns { phase: 'inhale'|'exhale', progress: 0..1,
  // cycleMs }.
  phaseAt(t) {
    const cycleMs = 60000 / this.targetRate();
    const inCycle = ((t % cycleMs) + cycleMs) % cycleMs;
    const inhaleMs = cycleMs * this.cfg.inhaleFraction;
    if (inCycle < inhaleMs) {
      return { phase: 'inhale', progress: inCycle / inhaleMs, cycleMs };
    }
    return {
      phase: 'exhale',
      progress: (inCycle - inhaleMs) / (cycleMs - inhaleMs),
      cycleMs,
    };
  }

  // Smooth scale of the guide circle (0..1 across a full cycle):
  // eases in during inhale, eases out during exhale.
  circleScaleAt(t) {
    const { phase, progress } = this.phaseAt(t);
    const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
    return phase === 'inhale' ? ease(progress) : 1 - ease(progress);
  }

  // Percentage of guided samples whose measured rate stayed within
  // ±tolerance breaths/min of the target at that moment. Null when
  // there is not enough guided data yet.
  adherence(tolerance = 1.5) {
    if (this.guidedSamples.length < 3) return null;
    const ok = this.guidedSamples.filter(
      (s) => Math.abs(s.measured - s.target) <= tolerance,
    ).length;
    return Math.round((ok / this.guidedSamples.length) * 100);
  }
}

module.exports = { BreathingGuide, median, clamp, DEFAULTS };

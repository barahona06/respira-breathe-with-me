// sdkSource.js — REAL SmartSpectra integration for Respira.
//
// =====================================================================
//  INTEGRATION POINT — Presage SmartSpectra SDK (Electron renderer)
//  Package: @smartspectra/node-sdk  (docs:
//  https://smartspectra.presagetech.com/docs/nodejs)
//
//  * The renderer SDK acquires the camera itself and emits the preview
//    stream through 'streamAvailable'.
//  * Metrics arrive through the 'metrics' event as an encoded protobuf
//    buffer; decodeMetrics() (from '@smartspectra/node-sdk/messages')
//    turns it into { breathing: { rate: [{value, confidence, ...}],
//    upperTrace: [...] }, cardio: { pulseRate: [...],
//    arterialPressureTrace: [...], hrv: [{ rmssd, ... }] } }.
//  * Each event carries a WINDOWED slice — we keep the latest value of
//    each channel and emit one normalized sample per event, in the
//    same shape the mock source uses.
//  * requestedMetrics is fixed at construction: breathing + cardio.
//    If the API key is not provisioned for cardio (the quickstart's
//    "Failed to load device keys" case), start() fails; we then retry
//    once with the breathing bundle only and flag it so the UI can
//    tell the user the session is breathing-only.
// =====================================================================

'use strict';

const {
  SmartSpectraSDK,
  ProcessingStatus,
  ValidationCode,
  breathingMetrics,
  cardioMetrics,
} = require('@smartspectra/node-sdk/renderer');
const { decodeMetrics } = require('@smartspectra/node-sdk/messages');

const STATUS_NAMES = ProcessingStatus
  ? Object.fromEntries(
      Object.entries(ProcessingStatus).map(([k, v]) => [v, k.replace(/^k/, '')]),
    )
  : {};
const VALIDATION_NAMES = ValidationCode
  ? Object.fromEntries(
      Object.entries(ValidationCode).map(([k, v]) => [v, k.replace(/^k/, '')]),
    )
  : {};

function lastOf(arr) {
  return arr && arr.length ? arr[arr.length - 1] : null;
}

// Merge one decoded Metrics packet into the running "latest" channel
// values. Metrics events are windowed slices: a channel may be absent
// from a given slice, so absent channels keep their previous value.
// Returns true when at least one rate (breathing or pulse) is known
// afterwards, i.e. when a sample is worth emitting. Pure and exported
// for tests — this is the exact code path every live sample takes.
function mergeMetricsIntoLatest(metrics, latest) {
  const br = lastOf(metrics.breathing?.rate);
  if (br && typeof br.value === 'number') {
    latest.breathingRate = br.value;
    latest.breathingConfidence =
      typeof br.confidence === 'number' ? br.confidence : null;
  }
  const chest = lastOf(metrics.breathing?.upperTrace);
  if (chest && typeof chest.value === 'number') latest.chestTrace = chest.value;

  const pr = lastOf(metrics.cardio?.pulseRate);
  if (pr && typeof pr.value === 'number') {
    latest.pulseRate = pr.value;
    latest.pulseConfidence =
      typeof pr.confidence === 'number' ? pr.confidence : null;
  }
  const ap = lastOf(metrics.cardio?.arterialPressureTrace);
  if (ap && typeof ap.value === 'number') latest.pulseTrace = ap.value;

  const hrv = lastOf(metrics.cardio?.hrv);
  if (hrv && typeof hrv.rmssd === 'number' && hrv.rmssd > 0) {
    latest.hrvRmssd = hrv.rmssd;
  }

  return latest.breathingRate !== null || latest.pulseRate !== null;
}

function looksLikeMetricConfigError(err) {
  const msg = String((err && err.message) || err || '').toLowerCase();
  return (
    msg.includes('device keys') ||
    msg.includes('configuration') ||
    msg.includes('not enabled') ||
    msg.includes('unavailable')
  );
}

function looksLikeAuthError(err) {
  const msg = String((err && err.message) || err || '').toLowerCase();
  return msg.includes('auth') || msg.includes('api key') || msg.includes('unauthorized');
}

function createSdkSource({
  apiKey,
  telemetry = false,
  onSample,
  onStatus,
  onValidation,
  onError,
  onStream,
  onFallback,
} = {}) {
  let sdk = null;
  let breathingOnly = false;
  let destroyed = false;

  // Latest known channel values (metrics events are windowed slices;
  // a channel may be absent from a given slice).
  const latest = {
    pulseRate: null,
    pulseConfidence: null,
    breathingRate: null,
    breathingConfidence: null,
    chestTrace: null,
    pulseTrace: null,
    hrvRmssd: null,
  };

  function build(withCardio) {
    const requestedMetrics = withCardio
      ? [...breathingMetrics, ...cardioMetrics]
      : [...breathingMetrics];
    const instance = new SmartSpectraSDK({
      apiKey,
      requestedMetrics,
      enableAccumulatedOutput: false,
      // Telemetry is opt-IN in Respira (consent screen). Presage's own
      // default is on; we pass the user's choice explicitly either way.
      enableTelemetry: !!telemetry,
    });

    instance.on('streamAvailable', (stream) => {
      if (onStream) onStream(stream);
    });

    instance.on('processingStatus', (status) => {
      if (onStatus) onStatus(STATUS_NAMES[status] || `Status(${status})`);
    });

    instance.on('validationStatus', (code, _ts, hint) => {
      if (onValidation) {
        onValidation({ code, name: VALIDATION_NAMES[code] || `Code(${code})`, hint });
      }
    });

    instance.on('error', (code, message, retryable) => {
      if (onError) onError({ code, message, retryable });
    });

    instance.on('metrics', (buf) => {
      let metrics;
      try {
        metrics = decodeMetrics(buf);
      } catch {
        return;
      }
      // decodeMetrics here is the one from '@smartspectra/node-sdk/messages':
      // it ALWAYS returns a decoded Metrics object (or throws above). It
      // never hands back the raw bytes — that pass-through behavior belongs
      // to the main-entry decodeMetrics when no Metrics class is registered,
      // which this module does not use. So a plain object check is the whole
      // guard. Do NOT reintroduce a check against the Node.js byte-buffer
      // global here: this file is bundled for the browser platform and runs
      // in a nodeIntegration:false page where that global does not exist —
      // referencing it throws on EVERY metrics packet, the SDK's event
      // emitter swallows the throw into a console line, and the session
      // silently records zero samples while streaming (and billing) fine.
      // That was the "Not enough data / duration 00:00" failure of the
      // first live test (11 Nov 2026). See nota-diagnostico-real.md.
      if (!metrics || typeof metrics !== 'object') return;

      if (mergeMetricsIntoLatest(metrics, latest)) {
        onSample({ t: Date.now(), ...latest, simulated: false });
      }
    });

    return instance;
  }

  return {
    simulated: false,
    get breathingOnly() {
      return breathingOnly;
    },

    async start() {
      destroyed = false;
      sdk = build(true);
      try {
        await sdk.start();
        return;
      } catch (err) {
        if (looksLikeAuthError(err)) throw err;
        if (!looksLikeMetricConfigError(err)) throw err;
        // One retry, breathing bundle only (see header note).
        try {
          sdk.destroy();
        } catch {
          /* ignore */
        }
        breathingOnly = true;
        if (onFallback) onFallback();
        sdk = build(false);
        await sdk.start();
      }
    },

    async stop() {
      if (!sdk) return;
      try {
        await sdk.stop();
      } catch {
        /* already stopped */
      }
    },

    destroy() {
      destroyed = true;
      if (sdk) {
        try {
          sdk.destroy();
        } catch {
          /* ignore */
        }
        sdk = null;
      }
    },

    get destroyed() {
      return destroyed;
    },
  };
}

module.exports = { createSdkSource, mergeMetricsIntoLatest };

// renderer.js — Respira UI controller (bundled with esbuild).
//
// Screens: consent -> setup -> live -> summary.
// The camera and the SDK are never touched before the user has pressed
// "Begin" on the consent screen. Nothing about a session is stored:
// the only persistent value is the language choice (localStorage).

'use strict';

const { BreathingGuide } = require('./guide');
const { createMockSource } = require('./mock');
const { createSdkSource } = require('./sdkSource');
const { t, normalizeLang, SUPPORTED } = require('./i18n');

const $ = (id) => document.getElementById(id);

let lang = 'es';
let config = { mode: 'mock', hasRealKey: false, apiKey: null };
let source = null;
let guide = null;
let session = null; // { samples: [], startedAt, durationMs, fallback }
let rafId = null;
let countdownTimer = null;
let pulseTraceMax = 0;
const WAVE_MAX = 600;
let wave = []; // { chest, pulse }

function tr(key) {
  return t(lang, key);
}

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = tr(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-list]').forEach((el) => {
    const items = tr(el.dataset.i18nList);
    el.innerHTML = '';
    if (Array.isArray(items)) {
      for (const item of items) {
        const li = document.createElement('li');
        li.textContent = item;
        el.appendChild(li);
      }
    }
  });
  document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.langBtn === lang);
  });
  // Re-render dynamic labels that depend on the current screen.
  if (session) updateStatusLine();
}

function showScreen(name) {
  for (const s of ['consent', 'setup', 'live', 'summary']) {
    $(`screen-${s}`).classList.toggle('hidden', s !== name);
  }
}

// --- Consent screen ------------------------------------------------------

function setupConsent() {
  const check = $('consent-check');
  const begin = $('btn-begin');
  check.addEventListener('change', () => {
    begin.disabled = !check.checked;
  });
  begin.addEventListener('click', () => {
    if (!check.checked) {
      $('consent-hint').textContent = tr('consentNeedCheck');
      return;
    }
    session = null;
    showScreen('setup');
  });
}

// --- Setup screen --------------------------------------------------------

let durationMin = 3;

function setupSetup() {
  document.querySelectorAll('[data-duration]').forEach((btn) => {
    btn.addEventListener('click', () => {
      durationMin = parseInt(btn.dataset.duration, 10) || 3;
      document
        .querySelectorAll('[data-duration]')
        .forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
  $('btn-back-setup').addEventListener('click', () => showScreen('consent'));
  $('btn-start-session').addEventListener('click', startSession);
}

// --- Session -------------------------------------------------------------

function resetWave() {
  wave = [];
  pulseTraceMax = 0;
}

function drawWave() {
  const canvas = $('wave-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  if (wave.length < 2) return;
  const draw = (get, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    wave.forEach((p, i) => {
      const x = (i / (WAVE_MAX - 1)) * w;
      const v = get(p);
      if (v === null || v === undefined) return;
      const y = h / 2 - v * (h / 2 - 8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  draw((p) => p.chest, '#7fd1c0'); // breathing (chest trace)
  draw((p) => p.pulse, '#f2a65a'); // pulse trace
}

function onSample(sample) {
  if (!session) return;
  session.samples.push(sample);
  if (session.samples.length > 20000) session.samples.shift();

  if (guide) guide.observe(sample);

  wave.push({ chest: sample.chestTrace ?? null, pulse: sample.pulseTrace ?? null });
  if (wave.length > WAVE_MAX) wave.shift();
  if (typeof sample.pulseTrace === 'number') {
    pulseTraceMax = Math.max(pulseTraceMax, Math.abs(sample.pulseTrace));
  }
  drawWave();

  const pr = sample.pulseRate;
  $('live-pulse').textContent =
    typeof pr === 'number' ? Math.round(pr) : '—';
  const br = sample.breathingRate;
  $('live-breathing').textContent =
    typeof br === 'number' ? br.toFixed(1) : '—';
  const hrv = sample.hrvRmssd;
  $('live-hrv').textContent =
    typeof hrv === 'number' ? Math.round(hrv) : '—';

  updateStatusLine();
}

function updateStatusLine() {
  if (!session) return;
  const el = $('live-status');
  const hasAny = session.samples.length > 0;
  const hasBr = session.samples.some((s) => typeof s.breathingRate === 'number');
  if (!hasAny || !hasBr) el.textContent = tr('measuring');
  else if (!guide || !guide.calibrated) el.textContent = tr('calibrating');
  else el.textContent = tr('guiding');
}

function onValidation(info) {
  const hint = (info.hint || '').trim();
  const el = $('live-hint');
  if (hint) {
    el.textContent = hint;
    el.classList.remove('hidden');
  } else if (info.name && !/^(Valid|Ok|Good|None)$/i.test(info.name)) {
    el.textContent = info.name;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

// Map raw SDK errors to a friendly, localized message. Judges and
// first-time users should never see a stack of codes without context.
function friendlyErrorText(err) {
  const msg = String((err && (err.message || err.code)) || err || '');
  const low = msg.toLowerCase();
  if (/auth|unauthorized|forbidden/.test(low)) return tr('authError');
  if (/api[- ]?key|apikey|missing.*key|no key/.test(low)) return tr('keyMissingError');
  if (
    /camera|webcam|notfound|not found|no device|device.*not|video.*track|getusermedia|media.*device/.test(
      low,
    )
  ) {
    return tr('noCameraError');
  }
  return msg ? `${tr('cameraError')} (${msg})` : tr('cameraError');
}

function onSdkError(err) {
  console.error('[respira] sdk error', err);
  $('live-error').textContent = friendlyErrorText(err);
  $('live-error').classList.remove('hidden');
  $('btn-retry').classList.remove('hidden');
}

function animateGuide() {
  if (!session) return;
  const now = performance.now();
  const circle = $('guide-circle');
  const phaseEl = $('guide-phase');
  if (guide) {
    const scale = 0.62 + 0.38 * guide.circleScaleAt(Date.now());
    circle.style.transform = `scale(${scale})`;
    const { phase } = guide.phaseAt(Date.now());
    phaseEl.textContent = phase === 'inhale' ? tr('inhale') : tr('exhale');
  }
  // Pulse ring: beats with the arterial-pressure trace when available.
  const ring = $('pulse-ring');
  const latest = session.samples[session.samples.length - 1];
  if (latest && typeof latest.pulseTrace === 'number' && pulseTraceMax > 0) {
    const n = Math.max(0, latest.pulseTrace) / pulseTraceMax;
    ring.style.transform = `scale(${1 + 0.12 * n})`;
    ring.style.opacity = String(0.35 + 0.55 * n);
  }
  void now;
  rafId = requestAnimationFrame(animateGuide);
}

function fmtClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
    total % 60,
  ).padStart(2, '0')}`;
}

async function startSession() {
  $('setup-error').classList.add('hidden');
  // Defensive: live mode without a key should never reach the SDK —
  // explain it here, in plain language, and stay on the setup screen.
  // (Normally the main process already falls back to demo mode.)
  if (config.mode === 'real' && !config.hasRealKey) {
    $('setup-error').textContent = tr('keyMissingError');
    $('setup-error').classList.remove('hidden');
    return;
  }
  guide = new BreathingGuide();
  session = {
    samples: [],
    startedAt: Date.now(),
    // Hard cap in LIVE mode: never measure longer than 5 minutes per
    // session — each live minute costs 2 trial credits.
    durationMs:
      (config.mode === 'real' ? Math.min(durationMin, 5) : durationMin) *
      60 *
      1000,
    fallback: false,
    mock: config.mode === 'mock',
  };
  resetWave();
  $('live-pulse').textContent = '—';
  $('live-breathing').textContent = '—';
  $('live-hrv').textContent = '—';
  $('live-error').classList.add('hidden');
  $('btn-retry').classList.add('hidden');
  $('live-fallback').classList.add('hidden');
  $('live-mock').classList.toggle('hidden', config.mode !== 'mock');
  $('live-mock').textContent = tr('mockBanner');
  $('live-status').textContent = tr('measuring');
  showScreen('live');

  const telemetry = $('consent-telemetry').checked;

  if (config.mode === 'mock') {
    source = createMockSource({ onSample });
    source.start();
  } else {
    source = createSdkSource({
      apiKey: config.apiKey,
      telemetry,
      onSample,
      onStatus: (s) => console.log('[respira] status', s),
      onValidation,
      onError: onSdkError,
      onStream: (stream) => {
        $('preview').srcObject = stream;
      },
      onFallback: () => {
        session.fallback = true;
        $('live-fallback').textContent = tr('fallbackNote');
        $('live-fallback').classList.remove('hidden');
      },
    });
    try {
      await source.start();
    } catch (err) {
      $('live-error').textContent = friendlyErrorText(err);
      $('live-error').classList.remove('hidden');
      $('btn-retry').classList.remove('hidden');
      session = null;
      return;
    }
  }

  // Countdown
  const endAt = Date.now() + session.durationMs;
  $('live-countdown').textContent = fmtClock(session.durationMs);
  countdownTimer = setInterval(() => {
    const left = endAt - Date.now();
    $('live-countdown').textContent = fmtClock(left);
    if (left <= 0) endSession();
  }, 500);
  rafId = requestAnimationFrame(animateGuide);
}

function endSession() {
  if (!session) return;
  if (countdownTimer) clearInterval(countdownTimer);
  if (rafId) cancelAnimationFrame(rafId);
  countdownTimer = null;
  rafId = null;

  const finish = () => {
    const samples = session.samples;
    const summary = buildSummary(samples);
    renderSummary(summary, session);
    if (source) {
      try {
        source.stop();
      } catch {
        /* ignore */
      }
      if (source.destroy) source.destroy();
      source = null;
    }
    const video = $('preview');
    if (video.srcObject) {
      video.srcObject.getTracks().forEach((tr2) => tr2.stop());
      video.srcObject = null;
    }
    showScreen('summary');
    session = null;
  };

  if (source && source.stop) {
    Promise.resolve(source.stop()).then(finish, finish);
  } else {
    finish();
  }
}

function buildSummary(samples) {
  const withPulse = samples.filter((s) => typeof s.pulseRate === 'number');
  const withBreath = samples.filter((s) => typeof s.breathingRate === 'number');
  const withHrv = samples.filter((s) => typeof s.hrvRmssd === 'number');
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const durationMs =
    samples.length > 1
      ? samples[samples.length - 1].t - samples[0].t
      : 0;

  const startWindow = withBreath.filter(
    (s) => s.t - samples[0].t <= 30000,
  );
  const endWindow = withBreath.filter(
    (s) => samples[samples.length - 1].t - s.t <= 30000,
  );

  return {
    durationMs,
    pulseAvg: withPulse.length ? avg(withPulse.map((s) => s.pulseRate)) : null,
    pulseMin: withPulse.length
      ? Math.min(...withPulse.map((s) => s.pulseRate))
      : null,
    pulseMax: withPulse.length
      ? Math.max(...withPulse.map((s) => s.pulseRate))
      : null,
    breathStart: startWindow.length
      ? avg(startWindow.map((s) => s.breathingRate))
      : null,
    breathEnd: endWindow.length
      ? avg(endWindow.map((s) => s.breathingRate))
      : null,
    hrvAvg: withHrv.length ? avg(withHrv.map((s) => s.hrvRmssd)) : null,
    adherence: guide ? guide.adherence() : null,
    count: samples.length,
  };
}

function renderSummary(summary, sess) {
  $('sum-duration').textContent = fmtClock(summary.durationMs);
  $('sum-pulse-avg').textContent =
    summary.pulseAvg !== null ? `${Math.round(summary.pulseAvg)} ${tr('bpm')}` : '—';
  $('sum-pulse-range').textContent =
    summary.pulseMin !== null
      ? `${Math.round(summary.pulseMin)} – ${Math.round(summary.pulseMax)} ${tr('bpm')}`
      : '—';
  $('sum-breath-start').textContent =
    summary.breathStart !== null ? `${summary.breathStart.toFixed(1)} ${tr('brpm')}` : '—';
  $('sum-breath-end').textContent =
    summary.breathEnd !== null ? `${summary.breathEnd.toFixed(1)} ${tr('brpm')}` : '—';
  $('sum-hrv').textContent =
    summary.hrvAvg !== null ? `${Math.round(summary.hrvAvg)} ${tr('ms')}` : '—';
  $('sum-adherence').textContent =
    summary.adherence !== null ? `${summary.adherence}%` : '—';
  $('sum-mock').classList.toggle('hidden', !sess.mock);
  $('sum-mock').textContent = sess.mock ? tr('mockBanner') : '';
  $('sum-empty').classList.toggle('hidden', summary.count >= 5);
  $('sum-empty').textContent = tr('noData');
}

function setupLive() {
  $('btn-end-session').addEventListener('click', endSession);
  $('btn-retry').addEventListener('click', () => {
    showScreen('setup');
    session = null;
  });
}

function setupSummary() {
  $('btn-new-session').addEventListener('click', () => {
    guide = null;
    showScreen('setup');
  });
  $('btn-close').addEventListener('click', () => window.close());
}

async function boot() {
  // Language: remembered choice, Spanish default.
  try {
    lang = normalizeLang(localStorage.getItem('respira-lang') || 'es');
  } catch {
    lang = 'es';
  }
  document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      lang = normalizeLang(btn.dataset.langBtn);
      try {
        localStorage.setItem('respira-lang', lang);
      } catch {
        /* storage unavailable */
      }
      applyLang();
    });
  });

  // Config from the main process (API key from env / .env, mode).
  try {
    if (window.respiraConfig && window.respiraConfig.get) {
      config = await window.respiraConfig.get();
    }
  } catch (err) {
    console.warn('[respira] config unavailable, demo mode', err);
    config = { mode: 'mock', hasRealKey: false, apiKey: null };
  }

  applyLang();
  const mockNote = $('mock-note');
  if (mockNote) {
    mockNote.classList.toggle('hidden', config.mode !== 'mock');
    mockNote.textContent =
      config.mode === 'mock'
        ? `${tr('mockBanner')} ${config.hasRealKey ? tr('mockForced') : tr('mockNoKey')}`
        : '';
  }
  setupConsent();
  setupSetup();
  setupLive();
  setupSummary();
  showScreen('consent');
}

document.addEventListener('DOMContentLoaded', boot);

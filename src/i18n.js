// i18n.js — Respira UI strings (Spanish default, English optional).
//
// The owner's standing rule for all his apps: bilingual ES/EN with
// Spanish as the official default language and a visible language
// selector; the choice is remembered on the device (localStorage in the
// renderer — the ONLY thing this app persists; never any health data).
//
// Pure module: no DOM access, so it can be unit-tested in plain Node.

'use strict';

const STRINGS = {
  es: {
    appName: 'Respira',
    tagline: 'Respira a tu ritmo. Tu cuerpo marca el paso.',
    langName: 'Español',

    // Consent screen
    consentTitle: 'Antes de encender la cámara',
    consentIntro:
      'Respira es una experiencia de bienestar: una guía de respiración que se adapta a tu pulso y a tu respiración reales, medidos sin contacto a través de la cámara de tu computadora con el SDK SmartSpectra de Presage.',
    consentWhatTitle: 'Qué pasa cuando aceptas',
    consentBullets: [
      'La cámara se enciende solo después de que pulses «Comenzar». Nunca antes, nunca en segundo plano.',
      'El video se procesa en tu propio equipo con el motor del SDK para estimar tu pulso y tu ritmo de respiración. La app no graba, no guarda y no envía tu video a ningún servidor.',
      'Tus valores se muestran solo en esta pantalla, durante la sesión. Al terminar verás un resumen y después se descarta: la app no guarda ningún dato de salud, ni en el disco ni en la nube.',
      'El SDK se autentica con los servidores de Presage usando tu clave de API. Esa comunicación no incluye tu video ni tus valores medidos.',
      'Sin cuentas, sin registro, sin publicidad y sin servicios de inteligencia artificial.',
    ],
    consentTelemetryTitle: 'Telemetría del SDK (opcional)',
    consentTelemetryBody:
      'El SDK de Presage puede enviar a Presage resúmenes técnicos de la sesión (versión del SDK, modelo del equipo, duración y conteos de rendimiento). Nunca incluyen video ni tus valores de pulso o respiración, pero van autenticados con tu clave, así que pueden asociarse a tu cuenta de desarrollador. En Respira viene APAGADA por defecto; actívala solo si quieres ayudar a mejorar el SDK.',
    consentTelemetryLabel: 'Permitir la telemetría del SDK de Presage',
    consentCreditsTitle: 'Presupuesto de créditos de la cuenta gratuita',
    consentCreditsBody:
      'La cuenta de desarrollador de Presage incluye 100 créditos en total: 1 crédito equivale a 30 segundos de medición en vivo (unos 50 minutos en total). Por eso esta app trabaja por defecto en modo demostración, que no gasta créditos, y la medición real se reserva para la verificación final y la grabación del demo. Las sesiones en vivo duran como máximo 5 minutos para cuidar ese presupuesto.',
    consentMedical:
      'Respira no es un dispositivo médico. No diagnostica, no trata ni previene ninguna condición, y sus números son estimaciones de bienestar, no mediciones clínicas. Si te sientes mal, detén la sesión y busca ayuda profesional.',
    consentCheckbox: 'He leído y entiendo cómo se usa la cámara y cómo se tratan los datos.',
    consentBegin: 'Comenzar',
    consentNeedCheck: 'Marca la casilla para poder comenzar.',
    mockBanner:
      'MODO DEMOSTRACIÓN — datos simulados. No hay ninguna medición real: este modo sirve para probar la app sin clave de API ni cámara.',
    mockNoKey:
      'No se encontró una clave de API válida, así que la app arrancó en modo demostración con datos simulados.',
    mockForced:
      'Modo demostración activo: es el modo por defecto para no gastar los créditos de la cuenta. La medición real se activa solo poniendo RESPIRA_MODE=real en el archivo .env.',

    // Session setup
    setupTitle: 'Tu sesión de calma',
    setupDuration: 'Duración',
    setupCreditsNote:
      'Las sesiones duran como máximo 5 minutos: cada sesión en vivo consume créditos de la cuenta gratuita (1 crédito = 30 segundos). En modo demostración no se gasta ningún crédito.',
    minutes: 'min',
    setupTipsTitle: 'Para una buena medición',
    setupTips: [
      'Siéntate de frente a la cámara, con la cara y el pecho visibles y buena luz de frente.',
      'Apoya la computadora en una superficie firme; evita sostenerla en la mano.',
      'Quédate en silencio y lo más quieto posible durante la sesión.',
    ],
    startSession: 'Iniciar sesión',
    back: 'Volver',

    // Live session
    liveTitle: 'Sesión en curso',
    pulse: 'Pulso',
    breathing: 'Respiración',
    bpm: 'lat/min',
    brpm: 'resp/min',
    hrv: 'Variabilidad (RMSSD)',
    ms: 'ms',
    measuring: 'Midiendo… espera a que la señal se estabilice.',
    calibrating: 'Conociendo tu ritmo natural…',
    guiding: 'La guía ya sigue tu ritmo',
    inhale: 'Inhala',
    exhale: 'Exhala',
    followGuide: 'Sigue el círculo: crece al inhalar, se recoge al exhalar.',
    endSession: 'Terminar sesión',
    remaining: 'restantes',
    signalLost: 'Se perdió la señal. Revisa la luz y tu posición frente a la cámara.',
    fallbackNote:
      'Tu clave de API no tiene habilitadas las métricas de pulso; esta sesión usa solo la respiración.',
    cameraError: 'No se pudo iniciar la medición.',
    noCameraError:
      'No se encontró una cámara disponible. Conecta una cámara web o habilítala en tu sistema y vuelve a intentarlo.',
    keyMissingError:
      'Falta la clave de API. Añádela en el archivo .env (SMARTSPECTRA_API_KEY=…) y reinicia la app. Mientras tanto, el modo demostración funciona sin clave.',
    authError:
      'La clave de API no fue aceptada. Revisa el archivo .env y vuelve a intentarlo.',
    retry: 'Reintentar',

    // Summary
    summaryTitle: 'Resumen de tu sesión',
    summaryDuration: 'Duración',
    summaryPulseAvg: 'Pulso promedio',
    summaryPulseRange: 'Pulso (mín – máx)',
    summaryBreathStart: 'Respiración al inicio',
    summaryBreathEnd: 'Respiración al final',
    summaryAdherence: 'Tiempo siguiendo la guía',
    summaryHrv: 'Variabilidad promedio (RMSSD)',
    summaryNotSaved:
      'Este resumen vive solo en esta pantalla. No se guardó en ningún lugar: al cerrar la app, desaparece.',
    newSession: 'Nueva sesión',
    close: 'Cerrar',
    noData: 'Sin datos suficientes en esta sesión.',
  },

  en: {
    appName: 'Breathe with Me',
    tagline: 'Breathe at your pace. Your body sets the rhythm.',
    langName: 'English',

    consentTitle: 'Before the camera turns on',
    consentIntro:
      'Breathe with Me (Respira) is a wellness experience: a breathing guide that adapts to your real pulse and breathing, measured contactlessly through your computer camera with Presage’s SmartSpectra SDK.',
    consentWhatTitle: 'What happens when you agree',
    consentBullets: [
      'The camera turns on only after you press “Begin”. Never before, never in the background.',
      'Video is processed on your own computer by the SDK engine to estimate your pulse and breathing rate. The app never records, stores, or sends your video to any server.',
      'Your values are shown only on this screen, during the session. At the end you will see a summary, and then it is discarded: the app stores no health data, on disk or in the cloud.',
      'The SDK authenticates with Presage’s servers using your API key. That communication does not include your video or your measured values.',
      'No accounts, no sign-up, no ads, and no AI services.',
    ],
    consentTelemetryTitle: 'SDK telemetry (optional)',
    consentTelemetryBody:
      'Presage’s SDK can send Presage technical session summaries (SDK version, device model, duration, and performance counts). They never include video or your pulse and breathing values, but they are authenticated with your key, so they can be associated with your developer account. In this app it is OFF by default; turn it on only if you want to help improve the SDK.',
    consentTelemetryLabel: 'Allow Presage SDK telemetry',
    consentCreditsTitle: 'Free-account credit budget',
    consentCreditsBody:
      'The Presage developer account includes 100 credits in total: 1 credit equals 30 seconds of live measurement (about 50 minutes overall). That is why this app works in demo mode by default, which spends no credits, and real measurement is reserved for final verification and recording the demo. Live sessions are capped at 5 minutes to protect that budget.',
    consentMedical:
      'Breathe with Me is not a medical device. It does not diagnose, treat, or prevent any condition, and its numbers are wellness estimates, not clinical measurements. If you feel unwell, stop the session and seek professional help.',
    consentCheckbox: 'I have read and I understand how the camera is used and how data is handled.',
    consentBegin: 'Begin',
    consentNeedCheck: 'Check the box to be able to begin.',
    mockBanner:
      'DEMO MODE — simulated data. There is no real measurement: this mode lets you try the app without an API key or camera.',
    mockNoKey:
      'No valid API key was found, so the app started in demo mode with simulated data.',
    mockForced:
      'Demo mode is on: it is the default mode so the account’s credits are not spent. Real measurement turns on only by setting RESPIRA_MODE=real in the .env file.',

    setupTitle: 'Your calm session',
    setupDuration: 'Duration',
    setupCreditsNote:
      'Sessions are capped at 5 minutes: every live session consumes free-account credits (1 credit = 30 seconds). Demo mode spends no credits at all.',
    minutes: 'min',
    setupTipsTitle: 'For a good measurement',
    setupTips: [
      'Sit facing the camera, with your face and chest visible and good light in front of you.',
      'Rest the computer on a firm surface; avoid holding it in your hand.',
      'Stay silent and as still as you comfortably can during the session.',
    ],
    startSession: 'Start session',
    back: 'Back',

    liveTitle: 'Session in progress',
    pulse: 'Pulse',
    breathing: 'Breathing',
    bpm: 'bpm',
    brpm: 'breaths/min',
    hrv: 'Variability (RMSSD)',
    ms: 'ms',
    measuring: 'Measuring… wait for the signal to settle.',
    calibrating: 'Learning your natural rhythm…',
    guiding: 'The guide is now following your rhythm',
    inhale: 'Breathe in',
    exhale: 'Breathe out',
    followGuide: 'Follow the circle: it grows as you inhale and settles as you exhale.',
    endSession: 'End session',
    remaining: 'remaining',
    signalLost: 'Signal lost. Check the light and your position in front of the camera.',
    fallbackNote:
      'Your API key is not enabled for pulse metrics; this session uses breathing only.',
    cameraError: 'Measurement could not be started.',
    noCameraError:
      'No camera was found. Connect a webcam or enable it in your system and try again.',
    keyMissingError:
      'The API key is missing. Add it to the .env file (SMARTSPECTRA_API_KEY=…) and restart the app. In the meantime, demo mode works without a key.',
    authError: 'The API key was not accepted. Check the .env file and try again.',
    retry: 'Try again',

    summaryTitle: 'Your session summary',
    summaryDuration: 'Duration',
    summaryPulseAvg: 'Average pulse',
    summaryPulseRange: 'Pulse (min – max)',
    summaryBreathStart: 'Breathing at the start',
    summaryBreathEnd: 'Breathing at the end',
    summaryAdherence: 'Time following the guide',
    summaryHrv: 'Average variability (RMSSD)',
    summaryNotSaved:
      'This summary lives only on this screen. It was not saved anywhere: when you close the app, it is gone.',
    newSession: 'New session',
    close: 'Close',
    noData: 'Not enough data in this session.',
  },
};

const SUPPORTED = Object.keys(STRINGS);

function normalizeLang(lang) {
  if (!lang) return 'es';
  const base = String(lang).toLowerCase().split('-')[0];
  return SUPPORTED.includes(base) ? base : 'es';
}

function t(lang, key) {
  const dict = STRINGS[normalizeLang(lang)];
  const value = dict[key] !== undefined ? dict[key] : STRINGS.es[key];
  return value !== undefined ? value : key;
}

module.exports = { STRINGS, SUPPORTED, normalizeLang, t };

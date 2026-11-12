# Respira / Breathe with Me — breathe at your own pace

**Respira** (in English: **Breathe with Me**) is a bilingual
(Spanish-first) guided-breathing companion for desktop. It listens to your **real pulse and breathing** — measured
contactlessly through your webcam with the
[Presage SmartSpectra SDK](https://smartspectra.presagetech.com) — and
its breathing guide **adapts to you**: it first learns your natural
breathing rhythm, then eases the pace down gently, and softens if your
pulse says the pace is too much. At the end you get a short on-screen
session summary — which is then discarded. **Nothing is stored.**

> **Wellness only.** Respira is *not* a medical device. It does not
> diagnose, treat, or prevent any condition, and its numbers are
> wellness estimates, not clinical measurements. The SmartSpectra SDK
> metrics are offered for general wellness and informational purposes
> only and have not been cleared by the FDA for medical diagnosis or
> treatment.

Built for the **Presage SmartSpectra SDK Challenge** on DEV
(categories: *Best Thoughtful Real-World Use* + overall).

---

## ⚠ Read this first: the credit budget

The Presage free trial includes **100 credits in total**, and
**1 credit = 30 seconds of live measurement** — roughly 50 live minutes,
ever. Respira is designed around that budget:

- **Demo mode (simulated data) is the DEFAULT.** It never touches the
  SDK and spends **zero credits**. Use it for development and for
  trying the interface.
- **Live mode is opt-in**: set `RESPIRA_MODE=real` in `.env`. Reserve
  it for final verification and for recording the demo video.
- Live sessions are capped at **5 minutes** in the app.

## Two modes

| Mode | Data | Credits | How to enable |
| --- | --- | --- | --- |
| `mock` (default) | Simulated, clearly labeled on screen at all times | 0 | Nothing — just run it |
| `real` | Live pulse + breathing from your camera via the SDK | 2 per minute | `RESPIRA_MODE=real` in `.env` + a valid API key |

If your API key is not provisioned for cardio (pulse) metrics, the app
detects the SDK's start-up failure and retries with the breathing
bundle only, telling you on screen that the session is breathing-only.

## Requirements

- **Node.js 20+** (Node 24 LTS recommended) — <https://nodejs.org>
- Windows 10/11 x64, macOS (Apple Silicon), or Linux x64/ARM64
  (glibc ≥ 2.35, e.g. Ubuntu 22.04+)
- A webcam, good front lighting, and a firm surface for the computer
  (breathing measurement needs a **stable** camera)
- A free Presage API key — only for live mode

## Install and run (Windows, step by step)

1. Install **Node.js LTS** from <https://nodejs.org> (default options
   are fine). Open a **new** PowerShell or Command Prompt and check:
   `node --version`
2. Download or clone this repository and open a terminal in its folder:
   ```bat
   cd ruta\a\respira
   ```
3. Install dependencies (this downloads the SmartSpectra native
   runtime for all platforms — a few hundred MB — plus Electron):
   ```bat
   npm install
   ```
4. Create your configuration file:
   ```bat
   copy .env.example .env
   ```
5. **Demo mode:** just run it — no key needed:
   ```bat
   npm start
   ```
6. **Live mode (spend credits carefully):**
   - Get your free API key at <https://physiology.presagetech.com>
     (register, confirm your email, then create an API key in the
     developer portal). No credit card is required.
   - Open `.env`, paste your key after `SMARTSPECTRA_API_KEY=`, and set
     `RESPIRA_MODE=real`.
   - Run `npm start`. The camera turns on **only after** you read the
     consent screen and press **Begin**.

> **Never commit your `.env` file.** It is already listed in
> `.gitignore`. The key is read by the Electron main process from the
> environment or `.env` and is never baked into the app bundle.

On macOS/Linux the same steps work with `cp .env.example .env`.

## How it works

1. **Consent first.** The app opens on a plain-language consent screen
   (Spanish by default, English via the ES/EN selector). The camera
   cannot start until you explicitly agree.
2. **Calibration (~30 s).** The guide quietly observes your natural
   breathing rate (median of confident samples) and your pulse baseline.
3. **Adaptive guide.** The animated circle starts at *your* pace and
   eases down by 0.5 breaths/min every 20 s toward a floor of
   5.5 breaths/min. A soft ring around it beats with your arterial
   pressure waveform. If your pulse climbs notably above your own
   baseline, the guide eases off instead of pushing.
4. **Live readouts.** Pulse (12 s average, BPM), breathing rate
   (30 s average, breaths/min) and — after a 60 s window — heart-rate
   variability (RMSSD), plus the live chest/pulse waveforms and the
   SDK's own positioning/lighting hints.
5. **Summary, then gone.** Duration, average/min/max pulse, breathing
   at the start vs. the end, average RMSSD, and the % of the guided
   time you spent near the target pace. It exists only on that screen.

Sessions can be 2, 3, or 5 minutes (default 3).

## Consent and data handling

*(This is the exact disclosure the app shows and the project stands
behind; it also fills the challenge template's required section.)*

- **Camera consent.** The camera turns on only after an explicit
  in-app consent, given on a dedicated screen *before* any capture,
  and only for the session you start. There is no background capture
  and no monitoring of anyone else.
- **Video.** Processed **on your own computer** by the SmartSpectra
  native engine to estimate pulse and breathing. The app never
  records, saves, screenshots, or uploads your video.
- **Measured values.** Shown live on your screen and kept **only in
  memory** to draw the charts and compute the end-of-session summary.
  When the session ends or the app closes, they are gone. The app
  writes **no** health data to disk, has no database, no accounts,
  and no cloud sync.
- **What leaves the device.** Two things, both to Presage only:
  1. **Authentication.** The SDK validates your API key with Presage's
     servers over its authenticated, TLS-pinned channel. It carries
     no video and no measured values.
  2. **SDK telemetry — OFF by default in Respira.** Presage's SDK can
     send *session summaries* (SDK version, device model/OS,
     session shape, performance and quality counts, a timestamp) and,
     when a device-readiness check runs, a fuller diagnostic report
     (device details and free-text diagnostics). Per Presage's
     [Telemetry & Privacy](https://smartspectra.presagetech.com/docs/telemetry-and-privacy)
     page, telemetry **never includes raw video frames or measured
     physiological values**; it *is* authenticated, so Presage can
     associate it with the developer account, and Presage currently
     configures **no automatic expiration** for those reports.
     Respira sets `enableTelemetry: false` unless you opt in on the
     consent screen.
- **AI services.** None. The app does not use the SDK's optional LLM
  Insights or any other AI service.
- **The only thing the app remembers** between runs is your language
  choice (ES/EN), stored locally by Electron. No health data, ever.

## Project structure

```
main.js            Electron main process: config (.env), window, SDK IPC
preload.js         SDK bridge + config bridge (context-isolated)
index.html         Screens: consent / setup / live / summary
styles.css
src/
  renderer.js      UI controller (bundled by esbuild → dist/)
  sdkSource.js     ★ SmartSpectra integration (renderer SDK, metrics)
  mock.js          Simulated signal source (demo mode — dev only)
  guide.js         Adaptive breathing-guide logic (pure, tested)
  i18n.js          All UI strings, Spanish default + English
test/              node:test suites for the pure modules
```

## Development

```bash
npm test         # unit tests (guide, mock source, i18n) — no SDK, no credits
npm run build    # bundle the renderer with esbuild
npm start        # build + launch (demo mode unless .env says otherwise)
```

## Packaging a Windows installer

Build **on a Windows machine** (native build, no cross-compile
tooling needed):

```bat
npm install
npm run dist:win   # → dist\Respira Setup *.exe (NSIS)
```

The SmartSpectra native runtime is bundled as an extra resource
(`resources/smartspectra/`), following the official quickstart.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| App opens in demo mode although you have a key | Set `RESPIRA_MODE=real` in `.env` (demo is the default on purpose). |
| “The API key was not accepted” | Paste the key again in `.env` (no spaces/quotes); confirm the key is active in the developer portal. |
| Session works but pulse never appears | Your key may not be provisioned for cardio metrics; the app falls back to breathing-only and says so on screen. Ask Presage on their Discord if you need cardio enabled. |
| App exits instantly from VS Code's terminal | VS Code sets `ELECTRON_RUN_AS_NODE=1`; use a normal terminal, or clear it before `npm start`. |
| Breathing reads poorly or drops out | Stable camera (not handheld), face + chest visible, good front light, stay silent and still, avoid dark or tightly striped clothing. |
| `LoadLibrary failed` / native runtime missing (packaged build) | Reinstall dependencies; confirm `resources/smartspectra/` contains the DLLs in packaged builds. |

## Credits & license

Built with the [Presage SmartSpectra SDK](https://smartspectra.presagetech.com)
(`@smartspectra/node-sdk`), Electron, and esbuild, following the
structure of Presage's official `electron-quickstart` sample.

The app code in this repository is released under the **MIT License** —
see [LICENSE](LICENSE). The SmartSpectra SDK and its native runtime
remain the property of Presage and are governed by Presage's own terms.

---

## Resumen en español

**Respira** es una guía de respiración bilingüe para escritorio que se
adapta a tu pulso y a tu respiración reales, medidos sin contacto con
la cámara mediante el SDK SmartSpectra de Presage. Primero aprende tu
ritmo natural, luego lo va bajando con suavidad, y al final muestra un
resumen que **no se guarda en ningún lugar**. No es un dispositivo
médico ni hace afirmaciones de diagnóstico. La app arranca en modo
demostración (datos simulados, 0 créditos); la medición real se activa
con `RESPIRA_MODE=real` en el archivo `.env`, porque la cuenta gratuita
incluye solo 100 créditos (≈50 minutos de medición en vivo). Pasos:
instala Node.js, `npm install`, `copy .env.example .env`, pega tu
clave y `npm start`. La cámara solo se enciende después de tu
consentimiento explícito en pantalla.

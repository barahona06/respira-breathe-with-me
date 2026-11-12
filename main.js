// main.js — Respira (Electron main process)
//
// Responsibilities:
// 1. Load configuration (API key, mode, telemetry default) from the
//    environment or a local .env file and expose it to the renderer
//    through a tightly scoped IPC channel. The API key is NEVER baked
//    into the renderer bundle.
// 2. Create the BrowserWindow wired to the SmartSpectra IPC bridge
//    (@smartspectra/node-sdk/main + our preload, which composes the
//    SDK preload bridge with our config bridge).
// 3. Grant camera permission ONLY to the bundled local page and ONLY
//    for video (the app never uses the microphone).
//
// Modeled on Presage's official electron-quickstart (MIT-style sample
// structure; this file is our own code written for Respira).

'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, session, ipcMain } = require('electron');

// --- .env loading (tiny parser; environment variables win) ----------------

function loadDotEnv() {
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(process.cwd(), '.env'),
  ];
  for (const file of candidates) {
    try {
      const text = fs.readFileSync(file, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const key = m[1];
        let value = m[2];
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
      }
      return file;
    } catch {
      // No .env at this path — try the next candidate.
    }
  }
  return null;
}

const envFile = loadDotEnv();
if (envFile) console.log(`[respira] loaded config from ${envFile}`);

function resolveConfig() {
  const apiKey = (process.env.SMARTSPECTRA_API_KEY || '').trim();
  const hasRealKey =
    apiKey.length > 0 && apiKey !== 'pon-tu-clave-aqui' && apiKey !== 'YOUR_API_KEY_HERE';
  const requested = (process.env.RESPIRA_MODE || 'mock').trim().toLowerCase();
  // CREDIT BUDGET (hard design constraint): the free trial holds 100
  // credits ≈ 50 live-measurement minutes (1 credit = 30 s). Demo mode
  // is therefore the DEFAULT even when a key exists: live measurement
  // must be opted into deliberately with RESPIRA_MODE=real, and is
  // reserved for final verification and the demo recording.
  let mode = 'mock';
  if (requested === 'real') mode = hasRealKey ? 'real' : 'mock';
  else if (requested === 'auto') mode = hasRealKey ? 'real' : 'mock';
  else mode = 'mock';
  return {
    mode,
    hasRealKey,
    // The key itself is only handed to the renderer when a session is
    // about to start (it is needed by the renderer-side SDK). It never
    // leaves this machine: the renderer uses it to authenticate with
    // Presage, exactly like the official quickstart does.
    apiKey: hasRealKey ? apiKey : null,
  };
}

ipcMain.handle('respira:get-config', () => resolveConfig());

// --- SmartSpectra native runtime location (packaged builds) ----------------
// In a packaged build the native runtime ships as an extra resource at
// resources/smartspectra/ because a .dll/.dylib/.so cannot be loaded from
// inside app.asar. Point the binding's resolver there BEFORE requiring it.

if (app.isPackaged && !process.env.SMARTSPECTRA_CAPI_PATH) {
  const LIB = {
    darwin: 'libsmartspectra_capi.dylib',
    win32: 'smartspectra_capi.dll',
    linux: 'libsmartspectra_capi.so',
  }[process.platform];
  if (LIB) {
    process.env.SMARTSPECTRA_CAPI_PATH = path.join(
      process.resourcesPath,
      'smartspectra',
      LIB,
    );
  } else {
    console.error(
      `[respira] packaged build on unsupported platform "${process.platform}"`,
    );
  }
}

const { bindSmartSpectraIpc } = require('@smartspectra/node-sdk/main');

const DIAGNOSTICS = process.env.SMARTSPECTRA_DIAGNOSTICS === '1';

function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#0d1b1e',
    title: 'Respira',
    webPreferences: {
      // Our preload composes the SDK bridge (require of
      // '@smartspectra/node-sdk/preload') with our config bridge, so it
      // needs the full preload require() — hence sandbox: false. Context
      // isolation stays ON and Node integration stays OFF; the window
      // only ever loads the bundled local page.
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  bindSmartSpectraIpc(win);

  // The app only renders its own bundled page. Block popups and any
  // remote content that would inherit this window's camera grant.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  if (DIAGNOSTICS) win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  // Allow getUserMedia({ video: true }) from the bundled page without an
  // extra in-page prompt. The OS-level camera indicator still fires.
  // Grant ONLY video-only requests from file:// pages; deny everything
  // else (including anything that also asks for the microphone).
  session.defaultSession.setPermissionRequestHandler(
    (wc, permission, callback, details) => {
      const url = (details && details.requestingUrl) || (wc && wc.getURL()) || '';
      const mediaTypes = (details && details.mediaTypes) || [];
      const cameraOnly = mediaTypes.length === 1 && mediaTypes[0] === 'video';
      callback(permission === 'media' && cameraOnly && url.startsWith('file://'));
    },
  );
  // Same scoping for permission *checks* (some Electron versions consult
  // this handler separately).
  session.defaultSession.setPermissionCheckHandler(
    (wc, permission, requestingOrigin) =>
      permission === 'media' && requestingOrigin.startsWith('file://'),
  );

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

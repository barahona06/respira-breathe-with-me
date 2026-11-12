// preload.js — Respira
//
// Composes two tightly scoped bridges for the renderer:
// 1. The SmartSpectra SDK bridge (window.__smartspectraBridge), required
//    by @smartspectra/node-sdk/renderer. The SDK docs explicitly support
//    requiring their preload module from your own preload script.
// 2. window.respiraConfig — a single get() that returns the app config
//    resolved by the main process from the environment / .env file.
//    No other IPC surface is exposed.

'use strict';

require('@smartspectra/node-sdk/preload');

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('respiraConfig', {
  get: () => ipcRenderer.invoke('respira:get-config'),
});

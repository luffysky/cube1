'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Narrow, named operations only. No ipcRenderer, filesystem, process, shell,
// arbitrary channel names, URL opener or user-provided path crosses this bridge.
contextBridge.exposeInMainWorld('snowrealmDesktop', Object.freeze({
  isDesktop: true,
  getRuntimeInfo: () => ipcRenderer.invoke('snowrealm:runtime-info'),
  toggleFullscreen: () => ipcRenderer.invoke('snowrealm:toggle-fullscreen'),
  exitFullscreen: () => ipcRenderer.invoke('snowrealm:exit-fullscreen')
}));

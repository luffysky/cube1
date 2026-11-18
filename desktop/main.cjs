'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell, screen } = require('electron');
const { startLocalServer } = require('./lib/local-server.cjs');
const { ENTRY_PATH, resolveConfig, isLocalURL, isAllowedExternalURL, isAllowedNetworkRequest, isAllowedDocumentPermission } = require('./lib/policy.cjs');

// Never disable Chromium's sandbox, certificate validation or web security.
app.enableSandbox();
let mainWindow;
let local;
let runtime;
let closing = false;

async function openOfficialLink(url) {
  if (!isAllowedExternalURL(url)) return;
  await shell.openExternal(url, { activate: true }).catch(() => {});
}

function trustedSender(event) {
  return mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents &&
    event.senderFrame === mainWindow.webContents.mainFrame && isLocalURL(event.senderFrame.url, local.origin);
}

function registerIPC() {
  ipcMain.handle('snowrealm:runtime-info', event => {
    if (!trustedSender(event)) throw new Error('Untrusted sender');
    return runtime;
  });
  ipcMain.handle('snowrealm:toggle-fullscreen', event => {
    if (!trustedSender(event)) throw new Error('Untrusted sender');
    const enabled = !mainWindow.isFullScreen(); mainWindow.setFullScreen(enabled); return enabled;
  });
  ipcMain.handle('snowrealm:exit-fullscreen', event => {
    if (!trustedSender(event)) throw new Error('Untrusted sender');
    mainWindow.setFullScreen(false); return false;
  });
}

function setMenu() {
  const template = [
    { label: '游戏', submenu: [
      { label: '返回自由练习', click: () => mainWindow?.loadURL(local.origin + ENTRY_PATH) },
      { label: 'SnowRealm Games', click: () => mainWindow?.loadURL(local.origin + '/') },
      { type: 'separator' }, { role: 'quit', label: '退出' }
    ] },
    { label: '视图', submenu: [
      { label: '全屏 / 窗口', accelerator: 'F11', click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
      { role: 'resetZoom', label: '恢复缩放' }, { role: 'zoomIn', label: '放大界面' }, { role: 'zoomOut', label: '缩小界面' },
      ...(!app.isPackaged ? [{ type: 'separator' }, { role: 'toggleDevTools', label: '开发者工具（开发环境）' }] : [])
    ] },
    { label: '帮助', submenu: [
      { label: '项目与问题反馈', click: () => openOfficialLink('https://github.com/luffysky/cube1') },
      { label: '关于本次预览', click: () => dialog.showMessageBox(mainWindow, {
        type: 'info', title: 'Spinrealm / SnowRealm Games', message: `Spinrealm ${app.getVersion()}`,
        detail: '此桌面预览从本机资源启动。F11 切换全屏，Esc 退出全屏。\nSteam SDK、云存档、成就、Steam 好友与钱包尚未接入。线上能力以游戏界面和实际服务状态为准。'
      }) }
    ] }
  ];
  if (process.platform === 'darwin') template.unshift({ role: 'appMenu' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const gameSession = session.fromPartition('persist:snowrealm-spinrealm-desktop');
  // Keep the player's settings / localStorage, but not website service workers.
  await gameSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] });
  const focusedGameDocument = (contents, permission, details) => Boolean(
    mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused() &&
    contents === mainWindow.webContents && isAllowedDocumentPermission(permission, details, local.origin)
  );
  gameSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(focusedGameDocument(contents, permission, details));
  });
  gameSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) =>
    isLocalURL(requestingOrigin, local.origin) && focusedGameDocument(contents, permission, details)
  );
  gameSession.on('will-download', event => event.preventDefault());
  gameSession.webRequest.onBeforeRequest((details, callback) => callback({
    cancel: !isAllowedNetworkRequest(details.url, details.resourceType, local.origin, runtime)
  }));

  mainWindow = new BrowserWindow({
    width: Math.min(1440, width), height: Math.min(960, height), minWidth: 880, minHeight: 640,
    show: false, backgroundColor: '#0b1115', title: 'Spinrealm · SnowRealm Games',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), session: gameSession,
      sandbox: true, contextIsolation: true, nodeIntegration: false,
      nodeIntegrationInWorker: false, nodeIntegrationInSubFrames: false,
      webviewTag: false, webSecurity: true, allowRunningInsecureContent: false,
      navigateOnDragDrop: false, devTools: !app.isPackaged, spellcheck: false
    }
  });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isLocalURL(url, local.origin)) return;
    event.preventDefault();
    void openOfficialLink(url);
  });
  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!isLocalURL(url, local.origin)) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isLocalURL(url, local.origin)) void mainWindow.loadURL(url);
    else void openOfficialLink(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return;
    if (input.key === 'F11') { event.preventDefault(); mainWindow.setFullScreen(!mainWindow.isFullScreen()); }
    if (input.key === 'Escape' && mainWindow.isFullScreen()) { event.preventDefault(); mainWindow.setFullScreen(false); }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  setMenu();
  await mainWindow.loadURL(local.origin + ENTRY_PATH);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show(); mainWindow.focus();
  });
  app.whenReady().then(async () => {
    runtime = resolveConfig(JSON.parse(await fs.readFile(path.join(__dirname, 'desktop.config.json'), 'utf8')), app.getVersion());
    const rootDir = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.resolve(__dirname, '..', 'dist');
    // If another process owns this port, fail closed. Never load that process's page.
    local = await startLocalServer({ rootDir, config: runtime });
    registerIPC();
    await createWindow();
  }).catch(error => {
    dialog.showErrorBox('Spinrealm 无法启动', error.code === 'EADDRINUSE'
      ? '本机端口 127.0.0.1:43671 已被占用。请关闭占用程序后重试。游戏没有连接到该端口上的其他程序。'
      : `无法读取或启动随附游戏资源。请重新安装完整发行包。\n${error.message}`);
    app.quit();
  });
  app.on('activate', () => {
    if (!mainWindow && local) void createWindow().catch(() => app.quit());
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', event => {
    if (!local || closing) return;
    event.preventDefault(); closing = true;
    local.server.closeAllConnections();
    void local.close().finally(() => app.quit());
  });
}

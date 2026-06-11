const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');

const DEFAULT_PRODUCTION_URL = 'https://aps-edu.vercel.app/gestao';
const DEFAULT_LOCAL_URL = 'http://localhost:3001/gestao';

let mainWindow = null;
let triedUrls = [];

function getCandidateUrls() {
  const envUrls = [
    process.env.APS_EDU_WEB_URL,
    process.env.APS_EDU_DESKTOP_URL,
    process.env.NEXT_PUBLIC_WEB_URL,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);

  const candidates = [];
  const pushUnique = (value) => {
    if (!value) return;
    if (!candidates.includes(value)) candidates.push(value);
  };

  envUrls.forEach(pushUnique);
  pushUnique(DEFAULT_PRODUCTION_URL);
  pushUnique(DEFAULT_LOCAL_URL);
  return candidates;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: '#0b0d12',
    title: 'APS-EDU Desktop',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      partition: 'persist:aps-edu'
    }
  });

  mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL() || '';
    const allowed = getCandidateUrls().some((base) => url.startsWith(base));
    if (!allowed && current && !url.startsWith(current)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const tryLoad = (index = 0) => {
    const urls = getCandidateUrls();
    const nextUrl = urls[index];
    if (!nextUrl) {
      mainWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(`
          <html>
            <body style="margin:0;font-family:Segoe UI,Arial,sans-serif;background:#0b0d12;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;">
              <div style="max-width:720px;padding:32px;text-align:center;">
                <h1 style="margin:0 0 12px;font-size:28px;">APS-EDU Desktop</h1>
                <p style="margin:0;color:#c9d1d9;line-height:1.6;">
                  NÃ£o consegui abrir o painel web agora. Verifique se o site estÃ¡ online.
                </p>
              </div>
            </body>
          </html>
        `)}`
      );
      return;
    }

    triedUrls = urls.slice(0, index + 1);
    mainWindow.loadURL(nextUrl);
  };

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    const currentIndex = triedUrls.findIndex((url) => url === validatedURL);
    const nextIndex = currentIndex >= 0 ? currentIndex + 1 : triedUrls.length;
    if (nextIndex < getCandidateUrls().length) {
      tryLoad(nextIndex);
      return;
    }

    dialog.showErrorBox(
      'APS-EDU Desktop',
      `NÃ£o foi possÃ­vel abrir o painel web.\n\nÃšltimo erro: ${errorDescription} (${errorCode})`
    );
  });

  tryLoad(0);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.whenReady().then(() => {
    app.setAppUserModelId('com.apsedu.desktop');
    createWindow();
  });

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

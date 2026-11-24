const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');

function loadSharedConfig() {
  const exeDir = app.isPackaged ? path.dirname(process.execPath) : __dirname;
  const externalConfigPath = path.join(exeDir, 'caja-config.json');
  const fallbackConfigPath = path.join(__dirname, 'caja-config.json');

  const configPath = fs.existsSync(externalConfigPath) ? externalConfigPath : fallbackConfigPath;
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {
      serverUrl: 'http://192.168.1.50:3000',
      salesPath: '/?modo=ventas',
      terminalName: 'CAJA-RED',
      windowTitle: 'Génesis POS — Terminal de Ventas en Red',
      kioskMode: false,
      maximizeOnStart: true,
      connectionTimeoutMs: 5000
    };
  }
}

function checkServerReachable(targetUrl, timeoutMs = 4500) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(targetUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(targetUrl, { timeout: timeoutMs }, (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      });
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.on('error', () => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

async function createTerminalWindow() {
  const cfg = loadSharedConfig();
  const baseUrl = (cfg.serverUrl || 'http://192.168.1.50:3000').replace(/\/$/, '');
  const salesPath = cfg.salesPath || '/?modo=ventas';
  const pcName = encodeURIComponent(os.hostname());
  const separator = salesPath.includes('?') ? '&' : '?';
  const fullUrl = `${baseUrl}${salesPath}${separator}terminal=${pcName}`;

  const win = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 1024,
    minHeight: 680,
    title: `${cfg.windowTitle || 'Génesis POS'} (${os.hostname()})`,
    autoHideMenuBar: true,
    kiosk: Boolean(cfg.kioskMode),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (cfg.maximizeOnStart !== false) {
    win.maximize();
  }

  win.webContents.on('did-fail-load', (_event, _code, _desc, validatedURL) => {
    if (!validatedURL.startsWith('file://')) {
      win.loadFile(path.join(__dirname, 'offline.html'), {
        query: { target: fullUrl }
      });
    }
  });

  const online = await checkServerReachable(baseUrl, cfg.connectionTimeoutMs || 4500);
  if (online) {
    await win.loadURL(fullUrl);
  } else {
    await win.loadFile(path.join(__dirname, 'offline.html'), {
      query: { target: fullUrl }
    });
  }
}

app.whenReady().then(createTerminalWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

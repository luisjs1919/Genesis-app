const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const zlib = require('zlib');
const { spawn } = require('child_process');

let mainWindow = null;
let serverUrl = null;
let nextServerProc = null;
let fallbackHttpServer = null;

function findFreePort(startPort = 3415) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      resolve(findFreePort(startPort + 1));
    });
    server.listen(startPort, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function checkHttpReady(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.setTimeout(600, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

function resolveRuntimeDir() {
  const candidates = [
    path.join(process.resourcesPath || '', 'desktop-runtime'),
    path.join(__dirname, '..', 'desktop-runtime'),
  ];
  for (const base of candidates) {
    if (!base || !fs.existsSync(base)) continue;
    if (fs.existsSync(path.join(base, 'server.js'))) return base;
    for (const entry of fs.readdirSync(base)) {
      const nested = path.join(base, entry);
      if (fs.statSync(nested).isDirectory() && fs.existsSync(path.join(nested, 'server.js'))) {
        return nested;
      }
    }
  }
  return null;
}

function ensureUserDataWorkbook(runtimeDir) {
  const userDataDir = app.getPath('userData');
  const userDataExcelDir = path.join(userDataDir, 'data');
  fs.mkdirSync(userDataExcelDir, { recursive: true });
  const targetExcel = path.join(userDataExcelDir, 'genesis_libro_general.xlsx');

  if (!fs.existsSync(targetExcel) && runtimeDir) {
    const seedExcel = path.join(runtimeDir, 'data', 'genesis_libro_general.xlsx');
    if (fs.existsSync(seedExcel)) {
      fs.copyFileSync(seedExcel, targetExcel);
    }
  }
  return userDataDir;
}

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const dataBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const crc = crc32(dataBuf);
    const size = dataBuf.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, dataBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const localBuf = Buffer.concat(localParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localBuf, centralBuf, eocd]);
}

function xmlEscape(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colLetter(idx) {
  let n = idx + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildXlsxBuffer(sheets) {
  const safeSheets = Array.isArray(sheets) && sheets.length > 0 ? sheets : [];
  const sheetEntries = [];
  const wbXmlSheets = [];
  const wbRels = [];

  safeSheets.forEach((sh, i) => {
    const idx = i + 1;
    const sheetTitle = String(sh.name || `Hoja${idx}`).replace(/[\/*?:\[\]]/g, '').slice(0, 31) || `Hoja${idx}`;
    const rId = `rId${idx}`;
    wbXmlSheets.push(`<sheet name="${xmlEscape(sheetTitle)}" sheetId="${idx}" r:id="${rId}"/>`);
    wbRels.push(`<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx}.xml"/>`);

    const rows = [];
    if (Array.isArray(sh.headers) && sh.headers.length > 0) {
      rows.push(sh.headers);
    }
    if (Array.isArray(sh.rows)) {
      sh.rows.forEach((r) => rows.push(Array.isArray(r) ? r : []));
    }

    const rowXml = rows
      .map((cells, rIdx) => {
        const cellXml = cells
          .map((val, cIdx) => {
            const ref = `${colLetter(cIdx)}${rIdx + 1}`;
            if (typeof val === 'number' && Number.isFinite(val)) {
              return `<c r="${ref}"><v>${val}</v></c>`;
            }
            if (typeof val === 'boolean') {
              return `<c r="${ref}" t="b"><v>${val ? 1 : 0}</v></c>`;
            }
            return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(val ?? '')}</t></is></c>`;
          })
          .join('');
        return `<row r="${rIdx + 1}">${cellXml}</row>`;
      })
      .join('');

    sheetEntries.push({
      name: `xl/worksheets/sheet${idx}.xml`,
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`,
    });
  });

  const contentTypes = [
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    ...safeSheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`),
  ].join('');

  return zipStore([
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${contentTypes}</Types>`,
    },
    {
      name: '_rels/.rels',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${wbXmlSheets.join('')}</sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels.join('')}</Relationships>`,
    },
    ...sheetEntries,
  ]);
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext] || 'application/octet-stream';
}

function startFallbackServer(runtimeDir, userDataDir, port) {
  return new Promise((resolve, reject) => {
    const excelPath = path.join(userDataDir, 'data', 'genesis_libro_general.xlsx');

    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      const pathname = decodeURIComponent(reqUrl.pathname);

      if (pathname === '/api/excel-book') {
        if (req.method === 'POST') {
          let raw = '';
          req.on('data', (c) => {
            raw += c.toString();
          });
          req.on('end', () => {
            try {
              const parsed = raw ? JSON.parse(raw) : {};
              const buf = buildXlsxBuffer(Array.isArray(parsed.sheets) ? parsed.sheets : []);
              fs.mkdirSync(path.dirname(excelPath), { recursive: true });
              fs.writeFileSync(excelPath, buf);
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: true, file: 'data/genesis_libro_general.xlsx', updatedAt: new Date().toISOString() }));
            } catch (e) {
              res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: String(e) }));
            }
          });
          return;
        }

        if (req.method === 'GET') {
          let buf;
          if (fs.existsSync(excelPath)) {
            buf = fs.readFileSync(excelPath);
          } else {
            buf = buildXlsxBuffer([
              {
                name: 'Movimientos',
                headers: ['ID', 'Fecha', 'Comercio / Concepto', 'Categoría', 'Cuenta', 'Monto'],
                rows: [],
              },
            ]);
          }
          res.writeHead(200, {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="genesis_libro_general.xlsx"',
            'Cache-Control': 'no-store',
          });
          res.end(buf);
          return;
        }
      }

      if (pathname.startsWith('/_next/static/')) {
        const rel = pathname.replace(/^\/_next\/static\//, '');
        const filePath = path.join(runtimeDir, '.next', 'static', rel);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }

      const publicCandidate = path.join(runtimeDir, 'public', pathname.replace(/^\//, ''));
      if (pathname !== '/' && fs.existsSync(publicCandidate) && fs.statSync(publicCandidate).isFile()) {
        res.writeHead(200, { 'Content-Type': getMimeType(publicCandidate) });
        fs.createReadStream(publicCandidate).pipe(res);
        return;
      }

      const cleanRoute = pathname === '/' ? 'index' : pathname.replace(/^\/+|\/+$/g, '');
      const htmlCandidates = [
        path.join(runtimeDir, '.next', 'server', 'app', `${cleanRoute}.html`),
        path.join(runtimeDir, '.next', 'server', 'app', cleanRoute, 'index.html'),
        path.join(runtimeDir, '.next', 'server', 'app', 'index.html'),
      ];
      for (const hPath of htmlCandidates) {
        if (fs.existsSync(hPath) && fs.statSync(hPath).isFile()) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          fs.createReadStream(hPath).pipe(res);
          return;
        }
      }

      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      fallbackHttpServer = server;
      resolve();
    });
  });
}

async function startLocalAppServer() {
  if (!app.isPackaged && process.env.GENESIS_DEV_URL) {
    return process.env.GENESIS_DEV_URL;
  }

  const runtimeDir = resolveRuntimeDir();
  if (!runtimeDir) {
    throw new Error('No se encontró el paquete interno de ejecución (desktop-runtime/server.js).');
  }

  const userDataDir = ensureUserDataWorkbook(runtimeDir);
  const port = await findFreePort(3415);
  const url = `http://127.0.0.1:${port}`;
  const serverScript = path.join(runtimeDir, 'server.js');
  let logs = '';
  let childExited = false;

  const childEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    GENESIS_USER_DATA_DIR: userDataDir,
  };

  nextServerProc = spawn(process.execPath, [serverScript], {
    cwd: runtimeDir,
    env: childEnv,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (nextServerProc.stdout) nextServerProc.stdout.on('data', (c) => (logs += c.toString()));
  if (nextServerProc.stderr) nextServerProc.stderr.on('data', (c) => (logs += c.toString()));
  nextServerProc.on('exit', () => {
    childExited = true;
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    if (await checkHttpReady(url)) return url;
    if (childExited) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  // Fallback to self-contained local static + Excel API server if standalone Next server could not start
  stopLocalAppServer();
  await startFallbackServer(runtimeDir, userDataDir, port);
  return url;
}

function stopLocalAppServer() {
  if (nextServerProc && !nextServerProc.killed) {
    try {
      nextServerProc.kill();
    } catch {}
    nextServerProc = null;
  }
  if (fallbackHttpServer) {
    try {
      fallbackHttpServer.close();
    } catch {}
    fallbackHttpServer = null;
  }
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    title: 'Génesis — Sistema Administrativo y Punto de Venta',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    backgroundColor: '#111622',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const openVentasShortcut = process.argv.some((a) => a === '--ventas' || a === '/ventas' || a.includes('ventas'));
  const targetUrl = openVentasShortcut ? `${url.replace(/\/+$/, '')}/ventas` : url;
  mainWindow.loadURL(targetUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith(url) || targetUrl === 'about:blank') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1180,
          height: 780,
          autoHideMenuBar: true,
          backgroundColor: '#111622',
          icon: path.join(__dirname, 'icon.png'),
        },
      };
    }
    shell.openExternal(targetUrl);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (serverUrl) {
      const args = Array.isArray(argv) ? argv : [];
      const wantsVentas = args.some((a) => a === '--ventas' || a === '/ventas' || String(a).includes('ventas'));
      const win = new BrowserWindow({
        width: wantsVentas ? 1180 : 1360,
        height: wantsVentas ? 780 : 840,
        minWidth: 1024,
        minHeight: 680,
        title: wantsVentas ? 'Génesis — Ventana de Ventas' : 'Génesis — Sistema Administrativo y Punto de Venta',
        icon: path.join(__dirname, 'icon.png'),
        autoHideMenuBar: true,
        backgroundColor: '#111622',
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      win.loadURL(wantsVentas ? `${serverUrl.replace(/\/+$/, '')}/ventas` : serverUrl);
      win.focus();
    } else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      serverUrl = await startLocalAppServer();
      createWindow(serverUrl);
    } catch (err) {
      stopLocalAppServer();
      dialog.showErrorBox(
        'Error al iniciar Génesis',
        err instanceof Error ? err.message : String(err)
      );
      app.quit();
    }
  });

  app.on('before-quit', () => {
    stopLocalAppServer();
  });

  app.on('window-all-closed', () => {
    stopLocalAppServer();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverUrl) {
      createWindow(serverUrl);
    }
  });
}

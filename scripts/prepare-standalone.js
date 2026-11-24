const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const nextDir = path.join(rootDir, '.next');
const standaloneDir = path.join(nextDir, 'standalone');
const staticDir = path.join(nextDir, 'static');
const serverAppDir = path.join(nextDir, 'server', 'app');
const publicDir = path.join(rootDir, 'public');
const dataDir = path.join(rootDir, 'data');
const runtimeDir = path.join(rootDir, 'desktop-runtime');
const rootNodeModules = path.join(rootDir, 'node_modules');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  let lst;
  try {
    lst = fs.lstatSync(src);
  } catch {
    return;
  }
  if (lst.isSymbolicLink()) {
    try {
      const target = fs.realpathSync(src);
      copyRecursive(target, dest);
    } catch {
      // Skip broken symlink
    }
    return;
  }
  if (lst.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === 'desktop-runtime' || entry === 'dist' || entry === 'electron') continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else if (lst.isFile()) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      fs.copyFileSync(src, dest);
    } catch {
      // Skip locked/unreadable file
    }
  }
}

if (!fs.existsSync(standaloneDir)) {
  console.error('No se encontró .next/standalone. Ejecuta primero: npm run build');
  process.exit(1);
}

fs.rmSync(runtimeDir, { recursive: true, force: true });
copyRecursive(standaloneDir, runtimeDir);

let targetAppRoot = runtimeDir;
if (!fs.existsSync(path.join(runtimeDir, 'server.js'))) {
  for (const entry of fs.readdirSync(runtimeDir)) {
    const candidate = path.join(runtimeDir, entry);
    if (fs.statSync(candidate).isDirectory() && fs.existsSync(path.join(candidate, 'server.js'))) {
      targetAppRoot = candidate;
      break;
    }
  }
}

copyRecursive(staticDir, path.join(targetAppRoot, '.next', 'static'));
copyRecursive(serverAppDir, path.join(targetAppRoot, '.next', 'server', 'app'));
copyRecursive(publicDir, path.join(targetAppRoot, 'public'));
copyRecursive(dataDir, path.join(targetAppRoot, 'data'));

for (const pkgName of ['next', 'styled-jsx']) {
  const srcPkg = path.join(rootNodeModules, pkgName);
  const dstPkg = path.join(targetAppRoot, 'node_modules', pkgName);
  if (fs.existsSync(srcPkg)) {
    fs.rmSync(dstPkg, { recursive: true, force: true });
    copyRecursive(srcPkg, dstPkg);
  }
}

console.log('Runtime de escritorio preparado en:', targetAppRoot);

const { contextBridge } = require('electron');
const os = require('os');

contextBridge.exposeInMainWorld('genesisTerminal', {
  isNetworkLauncher: true,
  hostname: os.hostname(),
  platform: process.platform
});

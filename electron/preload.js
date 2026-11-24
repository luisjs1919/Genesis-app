const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('genesisDesktop', {
  isDesktop: true,
  platform: process.platform,
});

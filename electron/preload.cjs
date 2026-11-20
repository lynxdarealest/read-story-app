const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  isElectron: true,
  translate: (joinedPayload) => ipcRenderer.invoke('desktop:translate', joinedPayload),
  inspectUrl: (url, cookie) => ipcRenderer.invoke('desktop:inspectUrl', { url, cookie }),
  fetchChapter: (params) => ipcRenderer.invoke('desktop:fetchChapter', params),
  getAllCookies: () => ipcRenderer.invoke('desktop:getAllCookies'),
  syncCookieJars: (jars) => ipcRenderer.invoke('desktop:syncCookieJars', jars),
  setManualCookie: (domainOrUrl, cookieString) =>
    ipcRenderer.invoke('desktop:setManualCookie', { domainOrUrl, cookieString }),
  clearDomainCookies: (domain) => ipcRenderer.invoke('desktop:clearDomainCookies', domain),
  getPreferredLang: () => ipcRenderer.invoke('desktop:getPreferredLang'),
  setPreferredLang: (lang) => ipcRenderer.invoke('desktop:setPreferredLang', lang),
});

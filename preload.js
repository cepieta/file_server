const { contextBridge, ipcRenderer } = require('electron');

// 렌더러 프로세스에서 사용할 수 있는 안전한 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 서버 정보 가져오기
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  
  // 서버 제어
  startServer: () => ipcRenderer.invoke('start-server'),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  
  // 설정 관리
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (config) => ipcRenderer.invoke('update-config', config),
  
  // 폴더 관리
  selectUploadFolder: () => ipcRenderer.invoke('select-upload-folder'),
  openUploadFolder: () => ipcRenderer.invoke('open-upload-folder'),
  
  // 브라우저 열기
  openInBrowser: () => ipcRenderer.invoke('open-in-browser'),
  
  // 플랫폼 정보
  platform: process.platform,
  
  // 버전 정보
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },

  isElectron: true,

  // 이벤트 리스너
  onServerReady: (callback) => ipcRenderer.on('server-ready', callback),
  onServerStatusChanged: (callback) => ipcRenderer.on('server-status-changed', callback),
  onConfigUpdated: (callback) => ipcRenderer.on('config-updated', (event, config) => callback(config)),
});

// 전역 변수로 일렉트론 환경임을 알림
contextBridge.exposeInMainWorld('isElectron', true);
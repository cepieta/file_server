// main.js 파일

const { app, BrowserWindow, Menu, shell, dialog, ipcMain, Tray, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { networkInterfaces } = require('os');
const fs = require('fs');
const { pathToFileURL } = require('url');
const os = require('os');
const cacheDir = path.join(os.tmpdir(), 'electron_cache_test1');
app.setPath('userData', cacheDir);

let mainWindow;
let serverProcess;
let tray;
let isServerRunning = false;
const DEFAULT_PORT = 3000;
const isDev = process.argv.includes('--dev');
const isPackaged = app.isPackaged;
const baseDir = isPackaged ? process.resourcesPath : __dirname;
const uploadsDir = path.join(baseDir, 'uploads');
const publicDir = path.join(baseDir, 'public');
const configPath = path.join(baseDir, 'config.json');

console.log('main.js baseDir:', baseDir);
console.log('main.js uploadsDir:', uploadsDir);
console.log('main.js configPath:', configPath);

// 기본 설정
const defaultConfig = {
  serverPort: DEFAULT_PORT,
  uploadDir: uploadsDir,
  allowDownload: true,
  allowUpload: true,
  allowDelete: true,
  programTitle: '로컬 파일 공유',
  programSubtitle: '드래그 앤 드롭으로 파일을 쉽게 공유하세요',
  maxFileSize: 100 // MB 단위
};

// 설정 로드
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ...defaultConfig, ...savedConfig };
    }
  } catch (error) {
    console.error('설정 파일 로드 오류:', error);
  }
  return { ...defaultConfig };
}

// 설정 저장
function saveConfig(config) {
  try {
    const configToSave = { ...config };
    delete configToSave.uploadDir; // 경로는 저장하지 않음
    fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('설정 파일 저장 오류:', error);
    return false;
  }
}

let config = loadConfig();
let currentPort = config.serverPort || DEFAULT_PORT;
let currentUploadDir = config.uploadDir || uploadsDir;

// 업로드 디렉토리 생성
if (!fs.existsSync(currentUploadDir)) {
  fs.mkdirSync(currentUploadDir, { recursive: true });
}

// 서버 시작 함수
function startServer() {
  if (isServerRunning) {
    console.log('서버가 이미 실행 중입니다.');
    return false;
  }

  const serverPath = path.join(baseDir, 'server.js');
  console.log('serverPath:', serverPath);
  console.log('process.execPath:', process.execPath);
  console.log('cwd:', baseDir);
  console.log('server.js exists:', fs.existsSync(serverPath));
  serverProcess = spawn(process.execPath, [serverPath], {
    stdio: isDev ? 'inherit' : 'pipe',
    cwd: baseDir,
    env: {
      ...process.env,
      UPLOADS_DIR: uploadsDir,
      SERVER_PORT: currentPort.toString(),
      MAX_FILE_SIZE: (config.maxFileSize || 100).toString()
    }
  });

  if (!isDev) {
    serverProcess.stdout.on('data', (data) => {
      console.log(`서버: ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`서버 오류: ${data}`);
    });
  }

  serverProcess.on('close', (code) => {
    console.log(`서버 프로세스 종료. 코드: ${code}`);
    isServerRunning = false;
    if (mainWindow && !app.isQuiting && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-status-changed', { running: false });
    }
  });

  serverProcess.on('error', (err) => {
    console.error('서버 프로세스 실행 오류:', err);
    isServerRunning = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-status-changed', { running: false, error: err.message });
    }
  });

  isServerRunning = true;
  return true;
}

// 서버 정지 함수
function stopServer() {
  if (!isServerRunning || !serverProcess) {
    console.log('서버가 실행 중이 아닙니다.');
    return false;
  }

  serverProcess.kill('SIGTERM');
  isServerRunning = false;
  return true;
}

// 서버 상태 확인
async function checkServerStatus() {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`http://127.0.0.1:${currentPort}/api/config`, { signal: controller.signal });
    clearTimeout(id);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// 로컬 IP 주소 가져오기
function getLocalIPs() {
  const nets = networkInterfaces();
  const results = ['localhost'];
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  
  return results;
}

// 트레이 생성
function createTray() {
  let iconPath;
  if (app.isPackaged) {
    iconPath = path.join(process.resourcesPath, 'icon.ico');
  } else {
    iconPath = path.join(__dirname, 'icon.ico');
  }
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon);
  updateTrayMenu();
  tray.setToolTip('로컬 파일 공유 서버');
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 트레이 메뉴 업데이트
function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '창 보이기',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '제어 패널',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.loadFile(path.join(baseDir, 'public', 'control-panel.html'));
        }
      }
    },
    {
      label: '브라우저에서 열기',
      click: () => {
        shell.openExternal(`http://localhost:${currentPort}`);
      }
    },
    { type: 'separator' },
    {
      label: '빠른 설정',
      submenu: [
        {
          label: '업로드 허용',
          type: 'checkbox',
          checked: config.allowUpload,
          click: (menuItem) => {
            updateServerConfig('allowUpload', menuItem.checked);
          }
        },
        {
          label: '파일 다운로드 허용 (본인 IP만)',
          type: 'checkbox',
          checked: config.allowDownload,
          click: (menuItem) => {
            updateServerConfig('allowDownload', menuItem.checked);
          }
        },
        {
          label: '파일 삭제 허용 (본인 IP만)',
          type: 'checkbox',
          checked: config.allowDelete,
          click: (menuItem) => {
            updateServerConfig('allowDelete', menuItem.checked);
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: '업로드 폴더 열기',
      click: () => {
        shell.openPath(currentUploadDir);
      }
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  if (tray) {
    tray.setContextMenu(contextMenu);
  }
}

// 서버 준비 상태 확인
async function waitForServer(maxAttempts = 30) { // 재시도 횟수 증가 (예: 10초 -> 30초 대기)
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000); // 각 요청의 타임아웃 2초
      const response = await fetch(`http://127.0.0.1:${currentPort}/api/config`, { signal: controller.signal });
      clearTimeout(id);
      if (response.ok) {
        console.log('서버 준비 완료');
        return true;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
          console.log(`서버 대기 중 (요청 타임아웃). 재시도... (${i + 1}/${maxAttempts})`);
      } else {
          console.log(`서버 대기 중 (연결 오류: ${error.message}). 재시도... (${i + 1}/${maxAttempts})`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 간격으로 재시도
  }
  console.error('서버 시작 실패: 지정된 시간 내에 응답 없음');
  return false;
}

async function createWindow() {
  // 메인 윈도우 생성
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '로컬 파일 공유',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(baseDir, 'preload.js')
    },
    show: false,
    icon: path.join(baseDir, 'icon.ico')
  });

  // 제어 패널 페이지 로드
  const controlPanelPath = path.join(baseDir, 'public', 'control-panel.html');
  console.log('제어 패널 경로:', controlPanelPath, '존재:', fs.existsSync(controlPanelPath));
  
  try {
    await mainWindow.loadFile(controlPanelPath);
  } catch (e) {
    console.error('제어 패널 로드 실패:', e);
    // 폴백: 기본 index.html 로드
    const indexPath = path.join(baseDir, 'public', 'index.html');
    await mainWindow.loadFile(indexPath);
  }
  
  mainWindow.show();

  // 윈도우 이벤트
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// 메뉴 생성
function createMenu() {
  const template = [
    {
      label: '파일',
      submenu: [
        {
          label: '업로드 폴더 열기',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            shell.openPath(currentUploadDir);
          }
        },
        { type: 'separator' },
        {
          label: '창 숨기기',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            if (mainWindow) mainWindow.hide();
          }
        },
        {
          label: '종료',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.isQuiting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: '보기',
      submenu: [
        {
          label: '새로고침',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          }
        },
        {
          label: '실제 크기',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (mainWindow) mainWindow.webContents.setZoomLevel(0);
          }
        },
        {
          label: '확대',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomLevel();
              mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
            }
          }
        },
        {
          label: '축소',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomLevel();
              mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
            }
          }
        },
        { type: 'separator' },
        {
          label: '개발자 도구',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: '설정',
      submenu: [
        {
          label: '파일 업로드 허용',
          type: 'checkbox',
          checked: config.allowUpload,
          click: (menuItem) => {
            updateServerConfig('allowUpload', menuItem.checked);
          }
        },
        {
          label: '파일 다운로드 허용 (본인 IP만)',
          type: 'checkbox',
          checked: config.allowDownload,
          click: (menuItem) => {
            updateServerConfig('allowDownload', menuItem.checked);
          }
        },
        {
          label: '파일 삭제 허용 (본인 IP만)',
          type: 'checkbox',
          checked: config.allowDelete,
          click: (menuItem) => {
            updateServerConfig('allowDelete', menuItem.checked);
          }
        }
      ]
    },
    {
      label: '서버',
      submenu: [
        {
          label: '제어 패널',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow) {
              mainWindow.loadFile(path.join(baseDir, 'public', 'control-panel.html'));
            }
          }
        },
        {
          label: '서버 정보',
          click: () => {
            const ips = getLocalIPs();
            const networkIPs = ips.filter(ip => ip !== 'localhost');
            
            let message = `서버 상태: ${isServerRunning ? '🟢 실행 중' : '🔴 중지됨'}\n포트: ${currentPort}\n\n접속 주소:\n`;
            message += `• http://localhost:${currentPort} (로컬)\n`;
            
            if (networkIPs.length > 0) {
              message += `• http://${networkIPs[0]}:${currentPort} (네트워크)\n\n`;
              message += `다른 기기에서 접속하려면 네트워크 주소를 사용하세요.`;
            }
            
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '서버 정보',
              message: '로컬 파일 공유 서버',
              detail: message,
              buttons: ['확인', '주소 복사', '브라우저에서 열기']
            }).then((result) => {
              if (result.response === 1) {
                const { clipboard } = require('electron');
                clipboard.writeText(`http://${networkIPs[0] || 'localhost'}:${currentPort}`);
              } else if (result.response === 2) {
                shell.openExternal(`http://localhost:${currentPort}`);
              }
            });
          }
        },
        {
          label: '브라우저에서 열기',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            shell.openExternal(`http://localhost:${currentPort}`);
          }
        }
      ]
    },
    {
      label: '도움말',
      submenu: [
        {
          label: '사용법',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '사용법',
              message: '로컬 파일 공유 사용법',
              detail: `1. 파일 업로드: 드래그 앤 드롭 또는 클릭하여 파일 선택
2. 설정 변경: 메뉴 → 설정에서 기능 활성화/비활성화
3. 다른 기기 접속: 서버 정보에서 네트워크 주소 확인
4. 트레이 아이콘: 우하단 트레이에서 빠른 액세스

• 업로드 폴더: ${currentUploadDir}
• 최대 파일 크기: 100MB
• 지원 기능: 업로드, 다운로드, 파일 목록, 삭제

⚠️ 주의: 설정은 관리자(이 앱)에서만 변경 가능하며,
웹 접속자들에게는 실시간으로 적용됩니다.`
            });
          }
        },
        { type: 'separator' },
        {
          label: '정보',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '정보',
              message: '로컬 파일 공유 v1.0.0',
              detail: `로컬 네트워크에서 파일을 쉽게 공유할 수 있는 데스크톱 애플리케이션입니다.

개발: Electron + Node.js + Express
기능: 파일 업로드/다운로드, 드래그 앤 드롭, 실시간 설정 변경

© 2024 Local File Share`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

// 서버 설정 업데이트 함수
async function updateServerConfig(setting, value) {
  try {
    const response = await fetch(`http://127.0.0.1:${currentPort}/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ [setting]: value })
    });
    
    if (response.ok) {
      // 트레이 툴팁 업데이트
      updateTrayTooltip();
      
      // 메뉴와 트레이 체크박스 상태 업데이트
      setTimeout(() => {
        updateMenuCheckboxes();
      }, 100);
      
      console.log(`설정 변경됨: ${setting} = ${value}`);
      
      // 설정 변경 알림 및 페이지 새로고침
      if (mainWindow && !mainWindow.isDestroyed()) {
        const settingNames = {
          'allowUpload': '업로드',
          'allowDownload': '다운로드', 
          'allowDelete': '파일 삭제'
        };
        
        const statusText = value ? '활성화' : '비활성화';
        mainWindow.webContents.executeJavaScript(`
          if (typeof showStatus === 'function') {
            showStatus('⚙️ ${settingNames[setting]}가 ${statusText}되었습니다.', 'success');
          }
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        `).catch(() => {
          // 페이지가 로드되지 않은 경우 무시
        });
      }
    }
  } catch (error) {
    console.error('설정 업데이트 실패:', error);
  }
}

// 메뉴 체크박스 상태 업데이트
function updateMenuCheckboxes() {
  fetch(`http://127.0.0.1:${currentPort}/api/config`)
    .then(response => response.json())
    .then(config => {
      // 메인 메뉴 업데이트
      const menu = Menu.getApplicationMenu();
      if (menu) {
        const settingsMenu = menu.items.find(item => item.label === '설정');
        if (settingsMenu) {
          settingsMenu.submenu.items[0].checked = config.allowUpload;
          settingsMenu.submenu.items[1].checked = config.allowDownload;
          settingsMenu.submenu.items[2].checked = config.allowDelete;
        }
      }
      
      // 트레이 메뉴 업데이트
      if (tray) {
        // 트레이 메뉴의 체크박스 상태 업데이트 (기존 updateTrayMenu 함수를 호출하여 재구축)
        updateTrayMenuWithConfig(config); // 새로운 헬퍼 함수 호출
      }
    })
    .catch(error => {
      console.error('설정 조회 실패:', error);
    });
}

// 트레이 메뉴를 현재 설정으로 업데이트하는 헬퍼 함수 (추가)
function updateTrayMenuWithConfig(config) {
  const trayContextMenu = Menu.buildFromTemplate([
    {
      label: '창 보이기',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '제어 패널',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.loadFile(path.join(baseDir, 'public', 'control-panel.html'));
        }
      }
    },
    {
      label: '브라우저에서 열기',
      click: () => {
        shell.openExternal(`http://localhost:${currentPort}`);
      }
    },
    { type: 'separator' },
    {
      label: '빠른 설정',
      submenu: [
        {
          label: '업로드 허용',
          type: 'checkbox',
          checked: config.allowUpload,
          click: (menuItem) => {
            updateServerConfig('allowUpload', menuItem.checked);
          }
        },
        {
          label: '파일 다운로드 허용 (본인 IP만)',
          type: 'checkbox',
          checked: config.allowDownload,
          click: (menuItem) => {
            updateServerConfig('allowDownload', menuItem.checked);
          }
        },
        {
          label: '파일 삭제 허용 (본인 IP만)',
          type: 'checkbox',
          checked: config.allowDelete,
          click: (menuItem) => {
            updateServerConfig('allowDelete', menuItem.checked);
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: '업로드 폴더 열기',
      click: () => {
        shell.openPath(currentUploadDir);
      }
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(trayContextMenu);
}


// 트레이 툴팁 업데이트
function updateTrayTooltip() {
  if (tray) {
    const status = isServerRunning ? '🟢 실행 중' : '🔴 중지됨';
    const tooltip = `로컬 파일 공유 서버\n상태: ${status}\n포트: ${currentPort}`;
    tray.setToolTip(tooltip);
  }
}

// 앱 이벤트
app.whenReady().then(async () => {
  // createLoadingHTML(); // 설치형 빌드에서는 파일 생성하지 않음
  createTray();
  updateTrayTooltip(); // 트레이 툴팁 초기화
  const menu = createMenu();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // 윈도우가 모두 닫혀도 앱은 실행 상태 유지 (트레이에서 동작)
  // 완전 종료는 트레이 메뉴나 메인 메뉴에서만 가능
});

app.on('before-quit', () => {
  app.isQuiting = true;
  
  // 서버 프로세스 종료
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
});

// IPC 핸들러
ipcMain.handle('get-server-info', () => {
  return {
    port: currentPort,
    ips: getLocalIPs(),
    uploadsDir: currentUploadDir
  };
});

// 서버 제어 핸들러
ipcMain.handle('start-server', async () => {
  if (startServer()) {
    // 서버 상태 확인 대기
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (await checkServerStatus()) {
        updateTrayTooltip(); // 트레이 툴팁 업데이트
        return { success: true, message: '서버가 성공적으로 시작되었습니다.' };
      }
    }
    return { success: false, message: '서버 시작 시간 초과' };
  }
  return { success: false, message: '서버 시작 실패' };
});

ipcMain.handle('stop-server', () => {
  if (stopServer()) {
    updateTrayTooltip(); // 트레이 툴팁 업데이트
    return { success: true, message: '서버가 정지되었습니다.' };
  }
  return { success: false, message: '서버 정지 실패' };
});

ipcMain.handle('get-server-status', async () => {
  const running = await checkServerStatus();
  return { running, port: currentPort };
});

// 설정 관리 핸들러
ipcMain.handle('get-config', () => {
  return config;
});

ipcMain.handle('update-config', async (event, newConfig) => {
  try {
    // 포트 변경 시 서버 재시작 필요 여부 확인
    const portChanged = newConfig.serverPort !== currentPort;
    const uploadDirChanged = newConfig.uploadDir !== currentUploadDir;
    
    // 설정 업데이트
    config = { ...config, ...newConfig };
    currentPort = config.serverPort || DEFAULT_PORT;
    currentUploadDir = config.uploadDir || uploadsDir;
    
    // 설정 저장
    if (saveConfig(config)) {
      // 포트나 업로드 디렉토리가 변경된 경우 서버 재시작
      if (isServerRunning && (portChanged || uploadDirChanged)) {
        stopServer();
        await new Promise(resolve => setTimeout(resolve, 1000));
        startServer();
      }
      // 모든 윈도우에 설정 변경 알림 브로드캐스트
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('config-updated', config);
      });
      return { success: true, message: '설정이 저장되었습니다.' };
    } else {
      return { success: false, message: '설정 저장 실패' };
    }
  } catch (error) {
    return { success: false, message: `설정 업데이트 오류: ${error.message}` };
  }
});

// 폴더 선택 핸들러
ipcMain.handle('select-upload-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '공유 폴더 선택'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    config.uploadDir = selectedPath;
    currentUploadDir = selectedPath;
    
    if (saveConfig(config)) {
      // 서버가 실행 중이면 재시작
      if (isServerRunning) {
        stopServer();
        await new Promise(resolve => setTimeout(resolve, 1000));
        startServer();
      }
      
      return { success: true, path: selectedPath };
    }
  }
  
  return { success: false };
});

// 폴더 열기 핸들러
ipcMain.handle('open-upload-folder', () => {
  shell.openPath(currentUploadDir);
  return { success: true };
});

// 브라우저에서 열기 핸들러
ipcMain.handle('open-in-browser', () => {
  shell.openExternal(`http://localhost:${currentPort}`);
  return { success: true };
});

// 싱글 인스턴스 보장
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

ipcMain.handle('save-config', async (event, config) => {
  // config 저장 로직
});
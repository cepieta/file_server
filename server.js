const fs = require('fs');
const logStream = fs.createWriteStream('server-log.txt', { flags: 'a' });

// 콘솔 인코딩 설정 (Windows에서 한글 깨짐 방지)
if (process.platform === 'win32') {
  try {
    require('child_process').execSync('chcp 65001', { stdio: 'ignore' });
  } catch (error) {
    // chcp 명령어가 실패해도 무시
  }
}

const origLog = console.log;
console.log = function(...args) {
  origLog.apply(console, args);
  logStream.write(args.map(String).join(' ') + '\n');
};

console.log('현재 작업 디렉토리:', process.cwd());
console.log('실행 파일 위치:', __filename);
console.log('uploads 폴더 존재:', require('fs').existsSync('./uploads'));
console.log('config.json 존재:', require('fs').existsSync('./config.json'));

const express = require('express');
const multer = require('multer');
const path = require('path');
const { networkInterfaces } = require('os');
const WebSocket = require('ws');
const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

const isPackaged = process.env.NODE_ENV === 'production' || (process.mainModule && process.mainModule.filename.indexOf('app.asar') > -1);
const baseDir = isPackaged ? (process.resourcesPath || path.dirname(process.execPath)) : __dirname;
const logPath = path.join(baseDir, 'uploads', 'server-log.txt');
function log(msg) {
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}
log('=== 서버 시작 ===');
log('baseDir: ' + baseDir);
log('process.resourcesPath: ' + process.resourcesPath);
log('process.execPath: ' + process.execPath);
log('process.cwd(): ' + process.cwd());

const logMsg = [
  'server.js baseDir: ' + baseDir,
  'server.js uploadsDir: ' + path.join(baseDir, 'uploads'),
  'server.js configPath: ' + path.join(baseDir, 'config.json')
].join('\n') + '\n';
console.log(logMsg);
try { fs.appendFileSync(path.join(baseDir, 'server-log.txt'), logMsg); } catch (e) {}
const CONFIG_FILE = path.join(baseDir, 'config.json');

// 기본 설정
const defaultConfig = {
  uploadDir: path.join(baseDir, 'uploads'),
  allowDownload: true,
  allowUpload: true,
  allowDelete: true,
  programTitle: '로컬 파일 공유',
  programSubtitle: '드래그 앤 드롭으로 파일을 쉽게 공유하세요',
  serverPort: 3000
};

// 설정 로드 함수
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...defaultConfig, ...savedConfig };
    } else {
      return { ...defaultConfig };
    }
  } catch (error) {
    return { ...defaultConfig };
  }
}

// 설정 저장 함수
function saveConfig(config) {
  try {
    const configToSave = { ...config };
    delete configToSave.uploadDir;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configToSave, null, 2), 'utf8');
    return true;
  } catch (error) {
    return false;
  }
}

let config = loadConfig();

let PORT = process.env.SERVER_PORT || config.serverPort || 3000;

// 업로드 경로를 환경변수에서 우선 읽기
const uploadDir = process.env.UPLOADS_DIR || config.uploadDir;
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE, 10) || 100; // MB 단위

// 업로드 디렉토리 생성
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  log('uploadsDir 생성: ' + uploadDir);
} else {
  log('uploadsDir 존재: ' + uploadDir);
}

// 파일 메타데이터 저장 디렉토리 생성
const METADATA_DIR = path.join(uploadDir, '.metadata');
if (!fs.existsSync(METADATA_DIR)) {
  fs.mkdirSync(METADATA_DIR, { recursive: true });
}

function saveFileMetadata(filename, metadata) {
  try {
    const metadataFile = path.join(METADATA_DIR, filename + '.json');
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    return true;
  } catch (error) {
    return false;
  }
}

function getFileMetadata(filename) {
  try {
    const metadataFile = path.join(METADATA_DIR, filename + '.json');
    if (fs.existsSync(metadataFile)) {
      return JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    }
    return null;
  } catch (error) {
    return null;
  }
}

function deleteFileMetadata(filename) {
  try {
    const metadataFile = path.join(METADATA_DIR, filename + '.json');
    if (fs.existsSync(metadataFile)) {
      fs.unlinkSync(metadataFile);
    }
    return true;
  } catch (error) {
    return false;
  }
}

function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         '알 수 없음';
}

function getServerIPs() {
  const nets = networkInterfaces();
  const results = ['127.0.0.1', '::1']; // 로컬호스트 주소 추가
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // IPv4 주소만 사용
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

// Multer 설정 (한글 파일명 지원)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 한글 파일명 처리
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    
    // 파일 이름과 확장자 분리
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    
    // 중복 파일 처리
    let counter = 1;
    let finalName = originalName;
    
    while (fs.existsSync(path.join(uploadDir, finalName))) {
      finalName = `${baseName} (${counter})${ext}`;
      counter++;
    }

    if (!req.uploadedFiles) req.uploadedFiles = [];
    req.uploadedFiles.push({ filename: finalName, originalName });
    cb(null, finalName);
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: maxFileSize * 1024 * 1024 } // MB를 바이트로 변환
});

app.use(express.static('public'));
app.use(express.static(baseDir));
app.use(express.json());

// 관리자 접근 제한 (Electron User-Agent)
function isElectron(req) {
  return req.headers['user-agent'] && req.headers['user-agent'].toLowerCase().includes('electron');
}

// 설정 API
app.get('/api/config', (req, res) => {
  const clientIP = getClientIP(req).replace('::ffff:', '');
  const serverIPs = getServerIPs();
  const isOwner = serverIPs.includes(clientIP);

  res.json({ ...config, isOwner });
});

app.post('/api/config', (req, res) => {
  try {
    const { programTitle, programSubtitle, allowDownload, allowUpload, allowDelete, serverPort, maxFileSize } = req.body;
    
    // 설정 파일 읽기
    let savedConfig = {};
    try {
      const configPath = path.join(baseDir, 'config.json');
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        savedConfig = JSON.parse(configData);
      }
    } catch (error) {
      console.error('설정 파일 읽기 오류:', error);
    }
    
    // 새로운 설정값 적용
    if (programTitle !== undefined) savedConfig.programTitle = programTitle;
    if (programSubtitle !== undefined) savedConfig.programSubtitle = programSubtitle;
    if (allowDownload !== undefined) savedConfig.allowDownload = allowDownload;
    if (allowUpload !== undefined) savedConfig.allowUpload = allowUpload;
    if (allowDelete !== undefined) savedConfig.allowDelete = allowDelete;
    if (serverPort !== undefined) savedConfig.serverPort = serverPort;
    if (maxFileSize !== undefined) savedConfig.maxFileSize = maxFileSize;
    
    // 설정 파일 저장
    const configPath = path.join(baseDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(savedConfig, null, 2), 'utf8');
    
    // 서버의 config 객체 업데이트
    config = { ...defaultConfig, ...savedConfig };
    
    res.json({ success: true, config });
  } catch (error) {
    console.error('설정 저장 중 오류:', error);
    res.status(500).json({ error: '설정 저장 중 오류가 발생했습니다.' });
  }
});

// 서버 제어 API (더미)
app.post('/api/server/stop', (req, res) => {
  if (!isElectron(req)) return res.status(403).json({ error: '관리자 권한 필요' });
  res.json({ success: true, message: '서버 정지(더미)' });
});
app.post('/api/server/start', (req, res) => {
  if (!isElectron(req)) return res.status(403).json({ error: '관리자 권한 필요' });
  res.json({ success: true, message: '서버 시작(더미)', port: config.serverPort });
});
app.post('/api/server/restart', (req, res) => {
  if (!isElectron(req)) return res.status(403).json({ error: '관리자 권한 필요' });
  res.json({ success: true, message: '서버 재시작(더미)' });
});
app.get('/api/server/status', (req, res) => {
  res.json({ running: true, port: config.serverPort });
});

// 웹소켓 연결 관리
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    
    ws.on('close', () => {
        clients.delete(ws);
    });
});

// 파일 변경 알림 함수
function notifyFileChange(type, filename) {
    const message = JSON.stringify({
        type: type, // 'upload' 또는 'delete'
        filename: filename
    });
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// 파일 업로드
app.post('/api/upload', upload.array('files'), (req, res) => {
  if (!config.allowUpload) {
    return res.status(403).json({ error: '파일 업로드가 비활성화되어 있습니다.' });
  }

  try {
    const clientIP = getClientIP(req);
    const uploadedFiles = req.files.map(file => {
      // 한글 파일명 처리
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const metadata = {
        filename: file.filename,
        originalname: originalName,
        size: file.size,
        mimetype: file.mimetype,
        uploadDate: new Date(),
        uploaderIP: clientIP
      };
      
      // 메타데이터 저장 시 인코딩 처리
      const metadataToSave = {
        ...metadata,
        originalname: Buffer.from(originalName).toString('base64') // base64로 인코딩하여 저장
      };
      saveFileMetadata(file.filename, metadataToSave);
      
      // 파일 변경 알림
      notifyFileChange('upload', file.filename);
      
      return metadata;
    });

    res.json({ 
      success: true, 
      message: '파일이 성공적으로 업로드되었습니다.',
      files: uploadedFiles
    });
  } catch (error) {
    console.error('파일 업로드 오류:', error);
    res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다.' });
  }
});

// 파일 목록
app.get('/api/files', (req, res) => {
  try {
    const clientIP = getClientIP(req);
    const files = fs.readdirSync(uploadDir)
      .filter(file => !fs.statSync(path.join(uploadDir, file)).isDirectory()) // 디렉토리 제외
      .filter(file => file !== 'server-log.txt') // 로그 파일 제외
      .map(file => {
        const stats = fs.statSync(path.join(uploadDir, file));
        // 메타데이터에서 uploaderIP 읽기
        let uploaderIP = undefined;
        try {
          const metaPath = path.join(uploadDir, '.metadata', file + '.json');
          if (fs.existsSync(metaPath)) {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            uploaderIP = meta.uploaderIP;
          }
        } catch (e) {}
        return {
          name: file,
          size: formatBytes(stats.size),
          birthtime: stats.birthtime,
          uploaderIP
        };
      })
      .sort((a, b) => b.birthtime - a.birthtime); // 최신 파일 순으로 정렬
    res.json({ files, clientIP });
  } catch (error) {
    console.error('파일 목록 조회 오류:', error);
    res.status(500).json({ error: '파일 목록을 가져올 수 없습니다.' });
  }
});

// 파일 크기 포맷 함수
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// 파일 다운로드
app.get('/download/:filename', (req, res) => {
  if (!config.allowDownload) {
    return res.status(403).send('다운로드가 허용되지 않았습니다.');
  }
  const filename = req.params.filename;
  if (filename === 'server-log.txt') {
    // 로그 파일은 다운로드 불가
    return res.status(403).send('이 파일은 다운로드할 수 없습니다.');
  }
  const filePath = path.join(uploadDir, filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
      if (err) {
        console.error('다운로드 오류:', err);
      }
    });
  } else {
    res.status(404).send('파일을 찾을 수 없습니다.');
  }
});

// 파일 삭제
app.delete('/api/files/:filename', (req, res) => {
  if (!config.allowDelete) {
    return res.status(403).json({ error: '파일 삭제가 비활성화되어 있습니다.' });
  }

  const filename = req.params.filename;
  const filePath = path.join(uploadDir, filename);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      if (deleteFileMetadata(filename)) {
        // 파일 변경 알림
        notifyFileChange('delete', filename);
        res.json({ success: true, message: '파일이 삭제되었습니다.' });
      } else {
        res.status(500).json({ error: '메타데이터 삭제 중 오류가 발생했습니다.' });
      }
    } else {
      res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('파일 삭제 오류:', error);
    res.status(500).json({ error: '파일 삭제 중 오류가 발생했습니다.' });
  }
});

// 404 핸들링
app.use((req, res) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.' });
});

// 서버 시작
try {
  log('서버 코드 진입');
  server.listen(PORT, '0.0.0.0', () => {
    log('서버 리스닝 시작: ' + PORT);
  });
} catch (e) {
  log('서버 시작 실패: ' + e.message);
}

function updateServerStatus(isRunning, port) {
            var statusElement = document.getElementById('serverStatus');
            var stopBtn = document.getElementById('stopServerBtn');
            var startBtn = document.getElementById('startServerBtn');
            var restartBtn = document.getElementById('restartServerBtn');
            
            console.log('서버 상태 업데이트:', isRunning, '포트:', port);
            
            if (statusElement) {
                if (isRunning) {
                    statusElement.textContent = '🟢 서버 실행 중 (포트: ' + (port || currentConfig.serverPort || 3000) + ')';
                    statusElement.className = 'status-indicator running';
                } else {
                    statusElement.textContent = '🔴 서버 정지됨';
                    statusElement.className = 'status-indicator stopped';
                }
            }
            
            if (stopBtn && startBtn && restartBtn) {
                if (isRunning) {
                    stopBtn.style.display = '';
                    startBtn.style.display = 'none';
                    restartBtn.style.display = '';
                    
                    // 버튼 활성화
                    stopBtn.disabled = false;
                    restartBtn.disabled = false;
                } else {
                    stopBtn.style.display = 'none';
                    startBtn.style.display = '';
                    restartBtn.style.display = 'none';
                    
                    // 버튼 활성화
                    startBtn.disabled = false;
                }
            }
        } 


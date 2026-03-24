const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let backendProcess;

function startBackend() {
  const serverPath = path.join(__dirname, '..', 'backend', 'server.js');
  backendProcess = spawn(process.execPath, [serverPath], {
    stdio: 'inherit',
    env: { ...process.env, PORT: process.env.PORT || '3001' }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  if (process.env.START_BACKEND !== 'false') {
    startBackend();
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
});

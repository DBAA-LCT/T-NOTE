import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 保存笔记到指定路径
ipcMain.handle('save-note-to-path', async (_, filePath: string, noteData: string) => {
  await fs.writeFile(filePath, noteData, 'utf-8');
  return true;
});

// 保存笔记（另存为）
ipcMain.handle('save-note', async (_, noteData: string) => {
  const { filePath } = await dialog.showSaveDialog({
    filters: [{ name: 'Note Files', extensions: ['note'] }]
  });
  
  if (filePath) {
    await fs.writeFile(filePath, noteData, 'utf-8');
    return filePath;
  }
  return null;
});

// 打开笔记
ipcMain.handle('open-note', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Note Files', extensions: ['note'] }],
    properties: ['openFile']
  });
  
  if (filePaths.length > 0) {
    const content = await fs.readFile(filePaths[0], 'utf-8');
    return { filePath: filePaths[0], content };
  }
  return null;
});

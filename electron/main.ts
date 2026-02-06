import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
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

  // 创建自定义菜单栏
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu-open');
          }
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow?.webContents.send('menu-save');
          }
        },
        {
          label: '另存为',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow?.webContents.send('menu-save-as');
          }
        },
        {
          type: 'separator'
        },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        {
          label: '撤销',
          accelerator: 'CmdOrCtrl+Z',
          role: 'undo'
        },
        {
          label: '重做',
          accelerator: 'CmdOrCtrl+Y',
          role: 'redo'
        },
        {
          type: 'separator'
        },
        {
          label: '剪切',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut'
        },
        {
          label: '复制',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy'
        },
        {
          label: '粘贴',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste'
        },
        {
          type: 'separator'
        },
        {
          label: '全选',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectAll'
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '刷新',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow?.webContents.reload();
          }
        },
        {
          type: 'separator'
        },
        {
          label: '开发者工具',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            mainWindow?.webContents.openDevTools();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

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

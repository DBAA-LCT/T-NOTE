import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { registerSyncHandlers } from './ipc/handlers';
import { logger } from './utils/logger';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'T-Note',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
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
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Register OneDrive sync IPC handlers
  registerSyncHandlers(mainWindow);
  logger.info('general', 'OneDrive sync handlers registered');
}

app.whenReady().then(async () => {
  // Initialize settings manager first
  const { ensureSettingsManagerInitialized } = require('./services/settings-manager');
  await ensureSettingsManagerInitialized();
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 处理打开文件事件（双击.note文件）
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow) {
    // 如果窗口已经打开，发送文件路径到渲染进程
    mainWindow.webContents.send('open-file-from-system', filePath);
  } else {
    // 如果窗口还没打开，等待窗口准备好后再发送
    app.whenReady().then(() => {
      if (mainWindow) {
        mainWindow.webContents.send('open-file-from-system', filePath);
      }
    });
  }
});

// Windows 和 Linux 下处理命令行参数（双击文件）
if (process.platform === 'win32' || process.platform === 'linux') {
  // 获取命令行参数中的文件路径
  const filePath = process.argv.find(arg => arg.endsWith('.note'));
  if (filePath) {
    app.whenReady().then(() => {
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.webContents.send('open-file-from-system', filePath);
        }
      }, 1000); // 延迟1秒确保窗口已完全加载
    });
  }
}

// 保存笔记到指定路径
ipcMain.handle('save-note-to-path', async (_, filePath: string, noteData: string) => {
  await fs.writeFile(filePath, noteData, 'utf-8');
  return true;
});

// 保存笔记（另存为）
ipcMain.handle('save-note', async (_, noteData: string, defaultName?: string) => {
  // 先确定一个不重复的默认文件名
  let baseName = defaultName || '新建笔记';
  let defaultPath = `${baseName}.note`;
  
  // 如果用户没有指定目录，使用文档目录
  const documentsPath = app.getPath('documents');
  let fullPath = path.join(documentsPath, defaultPath);
  
  // 检查文件是否存在，如果存在则添加序号
  let counter = 1;
  try {
    await fs.access(fullPath);
    // 文件已存在，查找可用的序号
    while (true) {
      defaultPath = `${baseName}(${counter}).note`;
      fullPath = path.join(documentsPath, defaultPath);
      try {
        await fs.access(fullPath);
        counter++;
      } catch {
        // 文件不存在，可以使用这个名字
        break;
      }
    }
  } catch {
    // 文件不存在，使用原始名称
  }
  
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'Note Files', extensions: ['note'] }],
    defaultPath: fullPath
  });
  
  if (result.canceled || !result.filePath) {
    return null;
  }
  
  // 用户可能修改了文件名，再次检查是否存在
  let finalPath = result.filePath;
  try {
    await fs.access(finalPath);
    // 文件已存在，自动添加序号
    const dir = path.dirname(finalPath);
    const ext = path.extname(finalPath);
    const fileName = path.basename(finalPath, ext);
    
    counter = 1;
    while (true) {
      finalPath = path.join(dir, `${fileName}(${counter})${ext}`);
      try {
        await fs.access(finalPath);
        counter++;
      } catch {
        break;
      }
    }
  } catch {
    // 文件不存在，直接使用
  }
  
  await fs.writeFile(finalPath, noteData, 'utf-8');
  return finalPath;
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

// 重命名文件
ipcMain.handle('rename-file', async (_, oldPath: string, newName: string) => {
  try {
    const dir = path.dirname(oldPath);
    const ext = path.extname(oldPath);
    const newPath = path.join(dir, `${newName}${ext}`);
    
    // 如果新旧路径相同，不需要重命名
    if (oldPath === newPath) {
      return oldPath;
    }
    
    // 检查新文件名是否已存在
    try {
      await fs.access(newPath);
      // 文件已存在，返回 null 表示失败
      return null;
    } catch {
      // 文件不存在，可以重命名
      await fs.rename(oldPath, newPath);
      return newPath;
    }
  } catch (error) {
    console.error('重命名文件失败:', error);
    return null;
  }
});

// 设置窗口标题
ipcMain.handle('set-window-title', async (_, title: string) => {
  if (mainWindow) {
    mainWindow.setTitle(title);
  }
});

// 读取文件内容
ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    console.error('读取文件失败:', error);
    return { success: false, error: String(error) };
  }
});

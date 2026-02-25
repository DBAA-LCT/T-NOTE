import { autoUpdater } from 'electron-updater';
import { BrowserWindow, dialog, app } from 'electron';
import log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * 应用更新管理器
 * 
 * 功能：
 * - 自动检查更新
 * - 下载更新
 * - 安装更新
 * - 通知用户
 * - 自定义下载路径
 */
export class UpdateManager {
  private mainWindow: BrowserWindow | null = null;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private updateDownloaded: boolean = false;
  private downloadPath: string;
  private settingsPath: string;
  
  // 保存当前更新状态，供渲染进程查询
  private currentUpdateState: {
    checking: boolean;
    downloading: boolean;
    downloadProgress: number;
    downloadSpeed: number; // 字节/秒
    updateAvailable: boolean;
    updateInfo: any | null;
  } = {
    checking: false,
    downloading: false,
    downloadProgress: 0,
    downloadSpeed: 0,
    updateAvailable: false,
    updateInfo: null,
  };

  constructor() {
    // 配置日志
    log.transports.file.level = 'info';
    autoUpdater.logger = log;

    // 初始化设置路径
    const userDataPath = app.getPath('userData');
    this.settingsPath = path.join(userDataPath, 'update-settings.json');
    
    // 默认下载路径为系统下载文件夹
    this.downloadPath = app.getPath('downloads');
    
    // 加载保存的下载路径
    this.loadDownloadPath();

    // 配置更新服务器（使用 package.json 中的 publish 配置）
    // autoUpdater 会自动读取 package.json 中的 publish 配置
    
    // 允许使用预发布版本（pre-release）
    autoUpdater.allowPrerelease = false;
    
    // 允许降级（如果需要的话）
    autoUpdater.allowDowngrade = false;
    
    // 自动下载更新
    autoUpdater.autoDownload = true;
    
    // 自动安装更新（在应用退出时）
    autoUpdater.autoInstallOnAppQuit = false;

    this.setupEventHandlers();
  }

  /**
   * 设置主窗口引用
   */
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  /**
   * 加载保存的下载路径
   */
  private async loadDownloadPath() {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf-8');
      const settings = JSON.parse(data);
      if (settings.downloadPath) {
        this.downloadPath = settings.downloadPath;
        log.info('已加载自定义下载路径:', this.downloadPath);
      }
    } catch (error) {
      // 文件不存在或读取失败，使用默认路径
      log.info('使用默认下载路径:', this.downloadPath);
    }
  }

  /**
   * 保存下载路径
   */
  private async saveDownloadPath() {
    try {
      const settings = { downloadPath: this.downloadPath };
      await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      log.info('下载路径已保存:', this.downloadPath);
    } catch (error) {
      log.error('保存下载路径失败:', error);
    }
  }

  /**
   * 获取当前下载路径
   */
  getDownloadPath(): string {
    return this.downloadPath;
  }

  /**
   * 设置下载路径
   */
  async setDownloadPath(newPath: string): Promise<void> {
    try {
      // 验证路径是否存在
      await fs.access(newPath);
      this.downloadPath = newPath;
      await this.saveDownloadPath();
      log.info('下载路径已更新:', newPath);
    } catch (error) {
      log.error('设置下载路径失败:', error);
      throw new Error('无效的路径或路径不存在');
    }
  }

  /**
   * 选择下载路径（打开文件夹选择对话框）
   */
  async selectDownloadPath(): Promise<string | null> {
    if (!this.mainWindow) {
      throw new Error('主窗口未设置');
    }

    const result = await dialog.showOpenDialog(this.mainWindow, {
      title: '选择更新下载位置',
      defaultPath: this.downloadPath,
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: '选择此文件夹'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const selectedPath = result.filePaths[0];
    await this.setDownloadPath(selectedPath);
    return selectedPath;
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers() {
    // 检查更新出错
    autoUpdater.on('error', (error) => {
      log.error('更新检查失败:', error);
      this.updateDownloaded = false;
      this.currentUpdateState = {
        checking: false,
        downloading: false,
        downloadProgress: 0,
        downloadSpeed: 0,
        updateAvailable: false,
        updateInfo: null,
      };
      this.sendStatusToWindow('update-error', error.message);
    });

    // 检查更新中
    autoUpdater.on('checking-for-update', () => {
      log.info('正在检查更新...');
      this.currentUpdateState.checking = true;
      this.currentUpdateState.downloading = false;
      this.currentUpdateState.updateAvailable = false;
      this.currentUpdateState.updateInfo = null;
      this.currentUpdateState.downloadSpeed = 0;
      this.sendStatusToWindow('checking-for-update');
    });

    // 发现新版本
    autoUpdater.on('update-available', (info) => {
      log.info('发现新版本:', info.version);
      this.currentUpdateState.checking = false;
      this.currentUpdateState.downloading = true;
      this.currentUpdateState.updateInfo = info;
      this.currentUpdateState.downloadProgress = 0;
      this.currentUpdateState.downloadSpeed = 0;
      this.sendStatusToWindow('update-available', info);
      // electron-updater 会自动开始下载，不需要手动调用 downloadUpdate
      // 不再弹出对话框，只发送事件到渲染进程显示红点提示
    });

    // 当前已是最新版本
    autoUpdater.on('update-not-available', (info) => {
      log.info('当前已是最新版本:', info.version);
      this.currentUpdateState.checking = false;
      this.currentUpdateState.downloading = false;
      this.currentUpdateState.updateAvailable = false;
      this.currentUpdateState.downloadSpeed = 0;
      this.sendStatusToWindow('update-not-available', info);
    });

    // 下载进度
    autoUpdater.on('download-progress', (progressObj) => {
      const speedMB = (progressObj.bytesPerSecond / 1024 / 1024).toFixed(2);
      const message = `下载速度: ${speedMB} MB/s - 已下载 ${progressObj.percent.toFixed(1)}%`;
      log.info(message);
      this.currentUpdateState.downloading = true;
      this.currentUpdateState.downloadProgress = progressObj.percent;
      this.currentUpdateState.downloadSpeed = progressObj.bytesPerSecond;
      this.sendStatusToWindow('download-progress', progressObj);
    });

    // 下载完成
    autoUpdater.on('update-downloaded', (info) => {
      log.info('更新下载完成:', info.version);
      this.updateDownloaded = true;
      this.currentUpdateState.downloading = false;
      this.currentUpdateState.updateAvailable = true;
      this.currentUpdateState.updateInfo = info;
      this.currentUpdateState.downloadProgress = 100;
      this.currentUpdateState.downloadSpeed = 0;
      this.sendStatusToWindow('update-downloaded', info);
      // 不弹出对话框，只发送事件到渲染进程，用户可以在关于页面手动安装
    });
  }

  /**
   * 发送状态到渲染进程
   */
  private sendStatusToWindow(event: string, data?: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update-status', { event, data });
    }
  }

  /**
   * 手动检查更新
   */
  async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      log.error('检查更新失败:', error);
      throw error;
    }
  }

  /**
   * 启动自动检查更新（每小时检查一次）
   */
  startAutoCheck(intervalHours: number = 1) {
    // 立即检查一次
    this.checkForUpdates();

    // 定时检查
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, intervalHours * 60 * 60 * 1000);
  }

  /**
   * 停止自动检查
   */
  stopAutoCheck() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  /**
   * 下载更新
   */
  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('下载更新失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前更新状态
   */
  getCurrentUpdateState() {
    return {
      ...this.currentUpdateState,
      updateDownloaded: this.updateDownloaded,
    };
  }

  /**
   * 安装更新并重启
   */
  quitAndInstall() {
    if (!this.updateDownloaded) {
      const errorMsg = '更新文件尚未下载完成，请稍后再试';
      log.error(errorMsg);
      this.sendStatusToWindow('update-error', errorMsg);
      throw new Error(errorMsg);
    }

    try {
      log.info('准备安装更新并重启应用...');
      // 使用 setImmediate 确保在下一个事件循环中执行
      // 参数说明：
      // - isSilent: false - 不静默安装，显示安装进度
      // - isForceRunAfter: true - 安装后强制运行新版本
      setImmediate(() => {
        try {
          autoUpdater.quitAndInstall(false, true);
        } catch (error) {
          log.error('quitAndInstall 调用失败:', error);
          // 如果第一次失败，尝试另一种参数组合
          try {
            log.info('尝试备用安装方式...');
            autoUpdater.quitAndInstall(true, false);
          } catch (retryError) {
            log.error('备用安装方式也失败:', retryError);
            this.sendStatusToWindow('update-error', '安装更新失败，请手动重启应用');
          }
        }
      });
    } catch (error) {
      log.error('安装更新失败:', error);
      this.sendStatusToWindow('update-error', '安装更新失败');
      throw error;
    }
  }
}

// 导出单例
export const updateManager = new UpdateManager();

import { autoUpdater } from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';
import log from 'electron-log';

/**
 * 应用更新管理器
 * 
 * 功能：
 * - 自动检查更新
 * - 下载更新
 * - 安装更新
 * - 通知用户
 */
export class UpdateManager {
  private mainWindow: BrowserWindow | null = null;
  private updateCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 配置日志
    log.transports.file.level = 'info';
    autoUpdater.logger = log;

    // 配置更新服务器（使用 package.json 中的 publish 配置）
    // autoUpdater 会自动读取 package.json 中的 publish 配置
    
    // 允许使用预发布版本（pre-release）
    autoUpdater.allowPrerelease = true;
    
    // 允许降级（如果需要的话）
    autoUpdater.allowDowngrade = false;

    this.setupEventHandlers();
  }

  /**
   * 设置主窗口引用
   */
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers() {
    // 检查更新出错
    autoUpdater.on('error', (error) => {
      log.error('更新检查失败:', error);
      this.sendStatusToWindow('update-error', error.message);
    });

    // 检查更新中
    autoUpdater.on('checking-for-update', () => {
      log.info('正在检查更新...');
      this.sendStatusToWindow('checking-for-update');
    });

    // 发现新版本
    autoUpdater.on('update-available', (info) => {
      log.info('发现新版本:', info.version);
      this.sendStatusToWindow('update-available', info);
      // 不再弹出对话框，只发送事件到渲染进程显示红点提示
    });

    // 当前已是最新版本
    autoUpdater.on('update-not-available', (info) => {
      log.info('当前已是最新版本:', info.version);
      this.sendStatusToWindow('update-not-available', info);
    });

    // 下载进度
    autoUpdater.on('download-progress', (progressObj) => {
      const message = `下载速度: ${progressObj.bytesPerSecond} - 已下载 ${progressObj.percent}%`;
      log.info(message);
      this.sendStatusToWindow('download-progress', progressObj);
    });

    // 下载完成
    autoUpdater.on('update-downloaded', (info) => {
      log.info('更新下载完成:', info.version);
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
   * 安装更新并重启
   */
  quitAndInstall() {
    try {
      // 使用 setImmediate 确保在下一个事件循环中执行
      setImmediate(() => {
        autoUpdater.quitAndInstall(false, true);
      });
    } catch (error) {
      log.error('安装更新失败:', error);
      // 如果安装失败，尝试不强制重启的方式
      try {
        autoUpdater.quitAndInstall(true, false);
      } catch (retryError) {
        log.error('重试安装更新失败:', retryError);
        throw retryError;
      }
    }
  }
}

// 导出单例
export const updateManager = new UpdateManager();

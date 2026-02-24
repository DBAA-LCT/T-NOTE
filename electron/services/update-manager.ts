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
      
      // 显示通知
      if (this.mainWindow) {
        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: '发现新版本',
          message: `发现新版本 ${info.version}`,
          detail: '正在后台下载更新，下载完成后会通知您。',
          buttons: ['确定']
        });
      }
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
      
      // 询问用户是否立即安装
      if (this.mainWindow) {
        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: '更新已下载',
          message: `新版本 ${info.version} 已下载完成`,
          detail: '是否立即重启应用并安装更新？',
          buttons: ['立即安装', '稍后安装'],
          defaultId: 0,
          cancelId: 1
        }).then((result) => {
          if (result.response === 0) {
            // 立即安装并重启
            autoUpdater.quitAndInstall(false, true);
          }
        });
      }
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
    autoUpdater.quitAndInstall(false, true);
  }
}

// 导出单例
export const updateManager = new UpdateManager();

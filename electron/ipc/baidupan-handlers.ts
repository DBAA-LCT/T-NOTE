/**
 * 百度网盘 IPC 处理器
 *
 * 连接渲染进程请求到主进程的百度网盘服务。
 */

import { ipcMain, BrowserWindow } from 'electron';
import { BAIDU_IPC_CHANNELS } from './baidupan-channels';
import { getBaiduPanAuth } from '../services/baidupan-auth';
import { getBaiduPanClient } from '../services/baidupan-client';
import { getSettingsManager } from '../services/settings-manager';
import { logger } from '../utils/logger';

const DEFAULT_SYNC_FOLDER = '/apps/TNote';

export function registerBaiduPanHandlers(mainWindow: BrowserWindow): void {
  // ---- 认证 ----

  ipcMain.handle(BAIDU_IPC_CHANNELS.AUTH_AUTHENTICATE, async () => {
    try {
      const auth = getBaiduPanAuth();
      return await auth.authenticate();
    } catch (error) {
      logger.error('auth', '百度网盘: 认证失败', error as Error);
      throw error;
    }
  });

  ipcMain.handle(BAIDU_IPC_CHANNELS.AUTH_DISCONNECT, async () => {
    try {
      await getBaiduPanAuth().disconnect();
    } catch (error) {
      logger.error('auth', '百度网盘: 断开失败', error as Error);
      throw error;
    }
  });

  ipcMain.handle(BAIDU_IPC_CHANNELS.AUTH_GET_USER_INFO, async () => {
    try {
      return await getBaiduPanAuth().getUserInfo();
    } catch (error) {
      logger.error('auth', '百度网盘: 获取用户信息失败', error as Error);
      throw error;
    }
  });

  ipcMain.handle(BAIDU_IPC_CHANNELS.AUTH_IS_AUTHENTICATED, () => {
    return getBaiduPanAuth().isAuthenticated();
  });

  // ---- 网盘容量 ----

  ipcMain.handle(BAIDU_IPC_CHANNELS.QUOTA_GET, async () => {
    try {
      return await getBaiduPanClient().getQuota();
    } catch (error) {
      logger.error('sync', '百度网盘: 获取容量失败', error as Error);
      throw error;
    }
  });

  // ---- 文件操作 ----

  ipcMain.handle(BAIDU_IPC_CHANNELS.FILE_LIST, async (_event, dir?: string) => {
    try {
      return await getBaiduPanClient().listFiles(dir || DEFAULT_SYNC_FOLDER);
    } catch (error) {
      logger.error('sync', '百度网盘: 获取文件列表失败', error as Error);
      throw error;
    }
  });

  ipcMain.handle(BAIDU_IPC_CHANNELS.FILE_CREATE_FOLDER, async (_event, folderPath: string) => {
    try {
      await getBaiduPanClient().createFolder(folderPath);
      return { success: true };
    } catch (error) {
      logger.error('sync', '百度网盘: 创建目录失败', error as Error);
      throw error;
    }
  });

  ipcMain.handle(BAIDU_IPC_CHANNELS.FILE_DELETE, async (_event, filePaths: string[]) => {
    try {
      await getBaiduPanClient().deleteFile(filePaths);
      return { success: true };
    } catch (error) {
      logger.error('sync', '百度网盘: 删除文件失败', error as Error);
      throw error;
    }
  });

  // ---- 同步操作 ----

  ipcMain.handle(
    BAIDU_IPC_CHANNELS.SYNC_UPLOAD_NOTE,
    async (_event, params: { noteContent: string; noteName: string; noteId: string; currentFilePath?: string; cloudSource?: { provider: string; cloudFileId: string | number; cloudPath?: string } }) => {
      try {
        const client = getBaiduPanClient();
        const syncFolder = getSettingsManager().getBaiduPanSyncFolder() || '/apps/TNote';
        // 确保文件名带 .note 后缀
        const fileName = params.noteName.endsWith('.note') ? params.noteName : `${params.noteName}.note`;
        // 如果有 cloudSource 且是百度网盘，直接用原路径覆盖；否则用同步目录 + 文件名
        const remotePath = (params.cloudSource && params.cloudSource.provider === 'baidupan' && params.cloudSource.cloudPath)
          ? params.cloudSource.cloudPath
          : `${syncFolder}/${fileName}`;

        // 发送进度
        mainWindow.webContents.send(BAIDU_IPC_CHANNELS.EVENT_SYNC_PROGRESS, {
          phase: 'uploading',
          current: 0,
          total: 1,
          fileName,
        });

        const result = await client.uploadContent(params.noteContent, remotePath, (current, total) => {
          mainWindow.webContents.send(BAIDU_IPC_CHANNELS.EVENT_SYNC_PROGRESS, {
            phase: 'uploading',
            current,
            total,
            fileName,
          });
        });

        mainWindow.webContents.send(BAIDU_IPC_CHANNELS.EVENT_SYNC_COMPLETE, {
          result: { uploaded: 1, downloaded: 0, errors: [], timestamp: Date.now() },
        });

        return { success: true, path: result.path, cloudId: result.fsId, fileName };
      } catch (error) {
        const errMsg = (error as Error).message;
        mainWindow.webContents.send(BAIDU_IPC_CHANNELS.EVENT_SYNC_ERROR, { error: errMsg });
        logger.error('sync', '百度网盘: 上传笔记失败', error as Error);
        throw error;
      }
    }
  );

  ipcMain.handle(BAIDU_IPC_CHANNELS.SYNC_GET_CLOUD_NOTES, async () => {
    try {
      const client = getBaiduPanClient();
      const syncFolder = getSettingsManager().getBaiduPanSyncFolder() || '/apps/TNote';
      const files = await client.listFiles(syncFolder);
      // 只返回 .note 文件
      return files.filter(f => f.isdir === 0 && f.filename.endsWith('.note'));
    } catch (error) {
      logger.error('sync', '百度网盘: 获取云端笔记列表失败', error as Error);
      throw error;
    }
  });

  ipcMain.handle(BAIDU_IPC_CHANNELS.SYNC_DOWNLOAD_NOTE, async (_event, fsId: number) => {
    try {
      const client = getBaiduPanClient();

      mainWindow.webContents.send(BAIDU_IPC_CHANNELS.EVENT_SYNC_PROGRESS, {
        phase: 'downloading',
        current: 0,
        total: 1,
      });

      const buffer = await client.downloadFile(fsId);
      const content = buffer.toString('utf-8');

      mainWindow.webContents.send(BAIDU_IPC_CHANNELS.EVENT_SYNC_COMPLETE, {
        result: { uploaded: 0, downloaded: 1, errors: [], timestamp: Date.now() },
      });

      return { success: true, content };
    } catch (error) {
      const errMsg = (error as Error).message;
      mainWindow.webContents.send(BAIDU_IPC_CHANNELS.EVENT_SYNC_ERROR, { error: errMsg });
      logger.error('sync', '百度网盘: 下载笔记失败', error as Error);
      return { success: false, error: errMsg };
    }
  });

  // ---- 文件夹浏览 ----

  ipcMain.handle(BAIDU_IPC_CHANNELS.FOLDER_BROWSE, async (_event, parentPath?: string) => {
    try {
      const client = getBaiduPanClient();
      const dir = parentPath || '/';
      const files = await client.listFiles(dir);
      // 只返回目录
      return files
        .filter(f => f.isdir === 1)
        .map(f => ({ name: f.filename, path: f.path, childCount: 0 }));
    } catch (error) {
      logger.error('sync', '百度网盘: 浏览文件夹失败', error as Error);
      throw error;
    }
  });

  ipcMain.handle(BAIDU_IPC_CHANNELS.FOLDER_GET_SYNC, async () => {
    try {
      return getSettingsManager().getBaiduPanSyncFolder();
    } catch (error) {
      logger.error('sync', '百度网盘: 获取同步文件夹失败', error as Error);
      throw error;
    }
  });

  ipcMain.handle(BAIDU_IPC_CHANNELS.FOLDER_SET_SYNC, async (_event, folderPath: string) => {
    try {
      await getSettingsManager().setBaiduPanSyncFolder(folderPath);
    } catch (error) {
      logger.error('sync', '百度网盘: 设置同步文件夹失败', error as Error);
      throw error;
    }
  });

  // ---- 设置 ----

  ipcMain.handle(BAIDU_IPC_CHANNELS.SETTINGS_GET, async () => {
    try {
      return getSettingsManager().getBaiduPanSyncSettings();
    } catch (error) {
      logger.error('sync', '百度网盘: 获取设置失败', error as Error);
      throw error;
    }
  });

  ipcMain.handle(BAIDU_IPC_CHANNELS.SETTINGS_UPDATE, async (_event, updates: { wifiOnly?: boolean; saveConflictCopy?: boolean }) => {
    try {
      await getSettingsManager().updateBaiduPanSyncSettings(updates);
    } catch (error) {
      logger.error('sync', '百度网盘: 更新设置失败', error as Error);
      throw error;
    }
  });
}

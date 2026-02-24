/**
 * 远程账号管理 IPC 处理器
 */

import { ipcMain } from 'electron';
import { getRemoteAccountsManager } from '../services/remote-accounts-manager';
import { logger } from '../utils/logger';

export function registerRemoteAccountsHandlers(): void {
  const manager = getRemoteAccountsManager();

  // 获取所有账号
  ipcMain.handle('remote-accounts:getAll', async () => {
    try {
      return manager.getAll();
    } catch (error) {
      logger.error('general', 'Failed to get all accounts', error as Error);
      throw error;
    }
  });

  // 创建账号
  ipcMain.handle('remote-accounts:create', async (_, params: { provider: string; displayName: string }) => {
    try {
      return await manager.create(params as any);
    } catch (error) {
      logger.error('general', 'Failed to create account', error as Error);
      throw error;
    }
  });

  // 删除账号
  ipcMain.handle('remote-accounts:delete', async (_, accountId: string) => {
    try {
      await manager.delete(accountId);
    } catch (error) {
      logger.error('general', 'Failed to delete account', error as Error);
      throw error;
    }
  });

  // 设置默认账号
  ipcMain.handle('remote-accounts:setDefault', async (_, accountId: string) => {
    try {
      await manager.setDefault(accountId);
    } catch (error) {
      logger.error('general', 'Failed to set default account', error as Error);
      throw error;
    }
  });

  // 认证相关
  ipcMain.handle('remote-accounts:isAuthenticated', async (_, accountId: string) => {
    try {
      return await manager.isAuthenticated(accountId);
    } catch (error) {
      logger.error('general', 'Failed to check authentication', error as Error);
      return false;
    }
  });

  ipcMain.handle('remote-accounts:authenticate', async (_, accountId: string) => {
    try {
      return await manager.authenticate(accountId);
    } catch (error) {
      logger.error('general', 'Failed to authenticate', error as Error);
      throw error;
    }
  });

  ipcMain.handle('remote-accounts:disconnect', async (_, accountId: string) => {
    try {
      await manager.disconnect(accountId);
    } catch (error) {
      logger.error('general', 'Failed to disconnect', error as Error);
      throw error;
    }
  });

  ipcMain.handle('remote-accounts:getUserInfo', async (_, accountId: string) => {
    try {
      return await manager.getUserInfo(accountId);
    } catch (error) {
      logger.error('general', 'Failed to get user info', error as Error);
      throw error;
    }
  });

  // 存储相关
  ipcMain.handle('remote-accounts:getQuota', async (_, accountId: string) => {
    try {
      return await manager.getQuota(accountId);
    } catch (error) {
      logger.error('general', 'Failed to get quota', error as Error);
      throw error;
    }
  });

  // 同步文件夹
  ipcMain.handle('remote-accounts:getSyncFolder', async (_, accountId: string) => {
    try {
      return manager.getSyncFolder(accountId);
    } catch (error) {
      logger.error('general', 'Failed to get sync folder', error as Error);
      throw error;
    }
  });

  ipcMain.handle('remote-accounts:setSyncFolder', async (_, accountId: string, folderPath: string) => {
    try {
      await manager.setSyncFolder(accountId, folderPath);
    } catch (error) {
      logger.error('general', 'Failed to set sync folder', error as Error);
      throw error;
    }
  });

  ipcMain.handle('remote-accounts:browseFolders', async (_, accountId: string, parentPath?: string) => {
    try {
      return await manager.browseFolders(accountId, parentPath);
    } catch (error) {
      logger.error('general', 'Failed to browse folders', error as Error);
      throw error;
    }
  });

  ipcMain.handle('remote-accounts:createFolder', async (_, accountId: string, name: string, parentPath?: string) => {
    try {
      return await manager.createFolder(accountId, name, parentPath);
    } catch (error) {
      logger.error('general', 'Failed to create folder', error as Error);
      throw error;
    }
  });

  // 同步设置
  ipcMain.handle('remote-accounts:getSyncSettings', async (_, accountId: string) => {
    try {
      return manager.getSyncSettings(accountId);
    } catch (error) {
      logger.error('general', 'Failed to get sync settings', error as Error);
      throw error;
    }
  });

  ipcMain.handle('remote-accounts:updateSyncSetting', async (_, accountId: string, key: string, value: boolean) => {
    try {
      await manager.updateSyncSetting(accountId, key, value);
    } catch (error) {
      logger.error('general', 'Failed to update sync setting', error as Error);
      throw error;
    }
  });

  // 云端笔记
  ipcMain.handle('remote-accounts:getCloudNotes', async (_, accountId: string) => {
    try {
      return await manager.getCloudNotes(accountId);
    } catch (error) {
      logger.error('general', 'Failed to get cloud notes', error as Error);
      throw error;
    }
  });

  logger.info('general', 'Remote accounts IPC handlers registered');
}

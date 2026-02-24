/**
 * 远程账号管理服务
 * 支持多账号管理
 */

import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import type { RemoteAccount, RemoteAccountsSettings, RemoteProvider } from '../../src/types/remote-account';
import { getAuthManager } from './auth-manager';
import { getBaiduPanAuth } from './baidupan-auth';
import { getOneDriveClient } from './onedrive-client';
import { getBaiduPanClient } from './baidupan-client';

export class RemoteAccountsManager {
  private settingsPath: string;
  private settings: RemoteAccountsSettings | null = null;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.settingsPath = path.join(userDataPath, 'remote-accounts.json');
  }

  async initialize(): Promise<void> {
    try {
      await this.loadSettings();
      logger.info('general', 'RemoteAccountsManager initialized');
    } catch (error) {
      logger.error('general', 'Failed to initialize RemoteAccountsManager', error as Error);
      throw error;
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const exists = await this.fileExists(this.settingsPath);
      if (exists) {
        const data = await fs.readFile(this.settingsPath, 'utf-8');
        this.settings = JSON.parse(data);
      } else {
        this.settings = { accounts: [], defaultAccountId: null };
        await this.saveSettings();
      }
    } catch (error) {
      logger.error('general', 'Failed to load remote accounts settings', error as Error);
      this.settings = { accounts: [], defaultAccountId: null };
      await this.saveSettings();
    }
  }

  private async saveSettings(): Promise<void> {
    if (!this.settings) return;
    try {
      await fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (error) {
      logger.error('general', 'Failed to save remote accounts settings', error as Error);
      throw error;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.settings) {
      await this.initialize();
    }
    if (!this.settings) {
      throw new Error('Failed to initialize settings');
    }
  }

  // ============================================================================
  // 账号管理
  // ============================================================================

  getAll(): RemoteAccountsSettings {
    if (!this.settings) {
      logger.warn('general', 'Settings not initialized, returning empty settings');
      return { accounts: [], defaultAccountId: null };
    }
    return this.settings;
  }

  async create(params: { provider: RemoteProvider; displayName: string }): Promise<RemoteAccount> {
    await this.ensureInitialized();
    // TypeScript 类型守卫
    if (!this.settings) throw new Error('Settings initialization failed');

    const account: RemoteAccount = {
      id: `${params.provider}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      provider: params.provider,
      displayName: params.displayName,
      syncFolder: params.provider === 'baidupan' ? '/apps/TNote' : null,
      connected: false,
      syncSettings: {
        wifiOnly: false,
        saveConflictCopy: true,
      },
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };

    this.settings.accounts.push(account);
    
    // 如果是第一个账号，设为默认
    if (this.settings.accounts.length === 1) {
      this.settings.defaultAccountId = account.id;
    }

    await this.saveSettings();
    logger.info('general', 'Remote account created', { accountId: account.id, provider: params.provider });
    return account;
  }

  async delete(accountId: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.settings) throw new Error('Settings initialization failed');

    const index = this.settings.accounts.findIndex(a => a.id === accountId);
    if (index === -1) throw new Error('Account not found');

    this.settings.accounts.splice(index, 1);

    // 如果删除的是默认账号，清除默认设置
    if (this.settings.defaultAccountId === accountId) {
      this.settings.defaultAccountId = this.settings.accounts.length > 0 ? this.settings.accounts[0].id : null;
    }

    await this.saveSettings();
    logger.info('general', 'Remote account deleted', { accountId });
  }

  async setDefault(accountId: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.settings) throw new Error('Settings initialization failed');

    const account = this.settings.accounts.find(a => a.id === accountId);
    if (!account) throw new Error('Account not found');

    this.settings.defaultAccountId = accountId;
    await this.saveSettings();
    logger.info('general', 'Default account set', { accountId });
  }

  getAccount(accountId: string): RemoteAccount {
    if (!this.settings) {
      throw new Error('Settings not initialized');
    }

    const account = this.settings.accounts.find(a => a.id === accountId);
    if (!account) throw new Error('Account not found');

    return account;
  }

  private async updateAccount(accountId: string, updates: Partial<RemoteAccount>): Promise<void> {
    await this.ensureInitialized();
    if (!this.settings) throw new Error('Settings initialization failed');

    const account = this.settings.accounts.find(a => a.id === accountId);
    if (!account) throw new Error('Account not found');

    Object.assign(account, updates);
    await this.saveSettings();
  }

  // ============================================================================
  // 认证相关
  // ============================================================================

  async isAuthenticated(accountId: string): Promise<boolean> {
    const account = this.getAccount(accountId);
    return account.connected;
  }

  async authenticate(accountId: string): Promise<any> {
    const account = this.getAccount(accountId);

    if (account.provider === 'onedrive') {
      const authManager = getAuthManager();
      
      // 使用 forceAccountSelection 参数强制用户选择账号
      const userInfo = await authManager.authenticate(true);
      
      // Store tokens with account-specific filename for future use
      const tokens = await authManager.getStoredTokens();
      await this.storeAccountTokens(accountId, tokens);
      
      await this.updateAccount(accountId, {
        connected: true,
        userInfo: {
          userId: userInfo.id,
          email: userInfo.email,
          name: userInfo.displayName,
        },
        lastUsedAt: Date.now(),
      });

      return {
        displayName: userInfo.displayName,
        email: userInfo.email,
        userId: userInfo.id,
      };
    } else if (account.provider === 'baidupan') {
      const auth = getBaiduPanAuth();
      
      // 使用 forceLogin 参数强制用户登录
      const userInfo = await auth.authenticate(true);

      await this.updateAccount(accountId, {
        connected: true,
        userInfo: {
          userId: String(userInfo.uk),
          name: userInfo.netdiskName || userInfo.baiduName,
        },
        lastUsedAt: Date.now(),
      });

      return {
        displayName: userInfo.netdiskName || userInfo.baiduName,
        userId: String(userInfo.uk),
      };
    }

    throw new Error('Unsupported provider');
  }

  async disconnect(accountId: string): Promise<void> {
    const account = this.getAccount(accountId);

    if (account.provider === 'onedrive') {
      const authManager = getAuthManager();
      await authManager.disconnect();
    } else if (account.provider === 'baidupan') {
      const auth = getBaiduPanAuth();
      await auth.disconnect();
    }

    // Clear account-specific tokens
    await this.clearAccountTokens(accountId);

    await this.updateAccount(accountId, {
      connected: false,
      userInfo: undefined,
    });
  }

  async getUserInfo(accountId: string): Promise<any> {
    const account = this.getAccount(accountId);

    if (!account.connected) {
      throw new Error('Account not connected');
    }

    if (account.provider === 'onedrive') {
      const authManager = getAuthManager();
      const userInfo = await authManager.getUserInfo();
      return {
        displayName: userInfo.displayName,
        email: userInfo.email,
        userId: userInfo.id,
      };
    } else if (account.provider === 'baidupan') {
      const auth = getBaiduPanAuth();
      const userInfo = await auth.getUserInfo();
      return {
        displayName: userInfo.netdiskName || userInfo.baiduName,
        userId: String(userInfo.uk),
      };
    }

    throw new Error('Unsupported provider');
  }

  // ============================================================================
  // 存储相关
  // ============================================================================

  async getQuota(accountId: string): Promise<any> {
    const account = this.getAccount(accountId);

    if (account.provider === 'onedrive') {
      const client = getOneDriveClient();
      return await client.getStorageQuota();
    } else if (account.provider === 'baidupan') {
      const client = getBaiduPanClient();
      return await client.getQuota();
    }

    throw new Error('Unsupported provider');
  }

  // ============================================================================
  // 同步文件夹
  // ============================================================================

  getSyncFolder(accountId: string): string | null {
    const account = this.getAccount(accountId);
    return account.syncFolder;
  }

  async setSyncFolder(accountId: string, folderPath: string): Promise<void> {
    await this.updateAccount(accountId, { syncFolder: folderPath });
  }

  async browseFolders(accountId: string, parentPath?: string): Promise<any[]> {
    const account = this.getAccount(accountId);

    if (account.provider === 'onedrive') {
      const client = getOneDriveClient();
      return await client.browseFolders(parentPath);
    } else if (account.provider === 'baidupan') {
      const client = getBaiduPanClient();
      const dir = parentPath || '/';
      const files = await client.listFiles(dir);
      return files
        .filter(f => f.isdir === 1)
        .map(f => ({ name: f.filename, path: f.path, childCount: 0 }));
    }

    throw new Error('Unsupported provider');
  }

  async createFolder(accountId: string, name: string, parentPath?: string): Promise<any> {
    const account = this.getAccount(accountId);

    if (account.provider === 'onedrive') {
      const client = getOneDriveClient();
      return await client.createFolder(name, parentPath);
    } else if (account.provider === 'baidupan') {
      const client = getBaiduPanClient();
      const folderPath = parentPath ? `${parentPath}/${name}` : `/${name}`;
      await client.createFolder(folderPath);
      return { name, path: folderPath, childCount: 0 };
    }

    throw new Error('Unsupported provider');
  }

  // ============================================================================
  // 同步设置
  // ============================================================================

  getSyncSettings(accountId: string): { wifiOnly: boolean; saveConflictCopy: boolean } {
    const account = this.getAccount(accountId);
    return account.syncSettings;
  }

  async updateSyncSetting(accountId: string, key: string, value: boolean): Promise<void> {
    const account = this.getAccount(accountId);
    const syncSettings = { ...account.syncSettings, [key]: value };
    await this.updateAccount(accountId, { syncSettings });
  }

  // ============================================================================
  // 云端笔记
  // ============================================================================

  async getCloudNotes(accountId: string): Promise<any[]> {
    const account = this.getAccount(accountId);

    if (!account.connected) {
      throw new Error('Account not connected');
    }

    if (!account.syncFolder) {
      throw new Error('Sync folder not configured for this account');
    }

    if (account.provider === 'onedrive') {
      const client = getOneDriveClient();
      const items = await client.listFiles(account.syncFolder);
      const noteFiles = items.filter(item => item.file && item.name.endsWith('.note'));
      
      return noteFiles.map(item => ({
        id: item.id,
        name: item.name,
        updatedAt: new Date(item.lastModifiedDateTime).getTime(),
        size: item.size,
      }));
    } else if (account.provider === 'baidupan') {
      const client = getBaiduPanClient();
      const files = await client.listFiles(account.syncFolder);
      return files.filter(f => f.filename.endsWith('.note'));
    }

    throw new Error('Unsupported provider');
  }

  // ============================================================================
  // 账号特定的 Token 存储（用于支持多账号）
  // ============================================================================

  private getAccountTokenPath(accountId: string): string {
    const userDataPath = app.getPath('userData');
    const account = this.getAccount(accountId);
    return path.join(userDataPath, `${account.provider}-tokens-${accountId}.enc`);
  }

  private async storeAccountTokens(accountId: string, tokens: any): Promise<void> {
    if (!tokens) return;
    
    try {
      const tokenPath = this.getAccountTokenPath(accountId);
      const tokenJson = JSON.stringify(tokens);
      const { safeStorage } = await import('electron');
      const encrypted = safeStorage.encryptString(tokenJson);
      await fs.writeFile(tokenPath, encrypted.toString('base64'), 'utf-8');
      logger.info('general', 'Account tokens stored', { accountId });
    } catch (error) {
      logger.error('general', 'Failed to store account tokens', error as Error);
    }
  }

  private async clearAccountTokens(accountId: string): Promise<void> {
    try {
      const tokenPath = this.getAccountTokenPath(accountId);
      await fs.unlink(tokenPath).catch(() => {});
      logger.info('general', 'Account tokens cleared', { accountId });
    } catch (error) {
      logger.error('general', 'Failed to clear account tokens', error as Error);
    }
  }
}

let instance: RemoteAccountsManager | null = null;

export function getRemoteAccountsManager(): RemoteAccountsManager {
  if (!instance) {
    instance = new RemoteAccountsManager();
  }
  return instance;
}

export async function ensureRemoteAccountsManagerInitialized(): Promise<RemoteAccountsManager> {
  const manager = getRemoteAccountsManager();
  await manager.initialize();
  return manager;
}

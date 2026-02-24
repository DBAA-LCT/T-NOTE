/**
 * 百度网盘 OAuth 2.0 认证管理
 *
 * 使用授权码模式，通过 BrowserWindow 引导用户登录百度账号并授权。
 * Access Token 有效期 30 天，支持 refresh_token 刷新。
 */

import { BrowserWindow, safeStorage, app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { BaiduUserInfo, BaiduTokenData } from '../../src/types/baidupan-sync';
import { logger } from '../utils/logger';

const BAIDU_OAUTH_CONFIG = {
  clientId: 'gs2jbazfqnBglCmZxlO2mG89H8U5t3kG',
  clientSecret: '5nuxevJbX4iK6dflqIchxIYSMRNmkrl4',
  redirectUri: 'http://localhost:3001/baidu/callback',
  authUrl: 'https://openapi.baidu.com/oauth/2.0/authorize',
  tokenUrl: 'https://openapi.baidu.com/oauth/2.0/token',
  userInfoUrl: 'https://pan.baidu.com/rest/2.0/xpan/nas',
  scope: 'basic,netdisk',
};

export class BaiduPanAuth {
  private authWindow: BrowserWindow | null = null;
  private tokenData: BaiduTokenData | null = null;
  private tokenFilePath: string;

  constructor() {
    this.tokenFilePath = path.join(app.getPath('userData'), 'baidupan-token.json');
    this.loadStoredTokens();
  }

  /** 启动 OAuth 授权流程 */
  async authenticate(forceLogin: boolean = false): Promise<BaiduUserInfo> {
    logger.info('auth', '百度网盘: 开始 OAuth 授权', { forceLogin });

    const code = await this.getAuthorizationCode(forceLogin);
    await this.exchangeCodeForToken(code);

    const userInfo = await this.getUserInfo();
    logger.info('auth', '百度网盘: 授权成功', { uk: userInfo.uk });
    return userInfo;
  }

  /** 打开浏览器窗口获取授权码 */
  private getAuthorizationCode(forceLogin: boolean = false): Promise<string> {
    return new Promise((resolve, reject) => {
      let authUrl = `${BAIDU_OAUTH_CONFIG.authUrl}?response_type=code&client_id=${BAIDU_OAUTH_CONFIG.clientId}&redirect_uri=${encodeURIComponent(BAIDU_OAUTH_CONFIG.redirectUri)}&scope=${BAIDU_OAUTH_CONFIG.scope}&display=popup`;
      
      // 强制登录以支持多账号
      if (forceLogin) {
        authUrl += '&force_login=1';
      }

      this.authWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: true,
        webPreferences: { 
          nodeIntegration: false, 
          contextIsolation: true,
          // 使用独立的session以清除缓存
          partition: forceLogin ? `persist:baidu-oauth-${Date.now()}` : 'persist:baidu-oauth',
        },
      });

      this.authWindow.loadURL(authUrl);

      // 监听回调地址
      this.authWindow.webContents.on('will-redirect', (_event, url) => {
        this.handleCallback(url, resolve, reject);
      });
      this.authWindow.webContents.on('will-navigate', (_event, url) => {
        this.handleCallback(url, resolve, reject);
      });

      this.authWindow.on('closed', () => {
        this.authWindow = null;
        reject(new Error('用户取消了授权'));
      });
    });
  }

  private handleCallback(
    url: string,
    resolve: (code: string) => void,
    reject: (err: Error) => void
  ) {
    if (!url.startsWith(BAIDU_OAUTH_CONFIG.redirectUri)) return;

    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const error = urlObj.searchParams.get('error');

    if (error) {
      this.authWindow?.close();
      reject(new Error(`授权失败: ${error}`));
      return;
    }
    if (code) {
      this.authWindow?.close();
      resolve(code);
    }
  }

  /** 用授权码换取 Access Token */
  private async exchangeCodeForToken(code: string): Promise<void> {
    const url = `${BAIDU_OAUTH_CONFIG.tokenUrl}?grant_type=authorization_code&code=${code}&client_id=${BAIDU_OAUTH_CONFIG.clientId}&client_secret=${BAIDU_OAUTH_CONFIG.clientSecret}&redirect_uri=${encodeURIComponent(BAIDU_OAUTH_CONFIG.redirectUri)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'pan.baidu.com' },
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`获取 Token 失败: ${data.error_description || data.error}`);
    }

    this.tokenData = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    await this.saveTokens();
    logger.info('auth', '百度网盘: Token 获取成功');
  }

  /** 刷新 Access Token */
  async refreshAccessToken(): Promise<void> {
    if (!this.tokenData?.refreshToken) {
      throw new Error('没有可用的 refresh_token，请重新授权');
    }

    const url = `${BAIDU_OAUTH_CONFIG.tokenUrl}?grant_type=refresh_token&refresh_token=${this.tokenData.refreshToken}&client_id=${BAIDU_OAUTH_CONFIG.clientId}&client_secret=${BAIDU_OAUTH_CONFIG.clientSecret}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'pan.baidu.com' },
    });

    const data = await response.json();
    if (data.error) {
      // 刷新失败，清除 token，需要重新授权
      this.tokenData = null;
      await this.clearTokens();
      throw new Error(`刷新 Token 失败: ${data.error_description || data.error}`);
    }

    this.tokenData = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    await this.saveTokens();
    logger.info('auth', '百度网盘: Token 刷新成功');
  }

  /** 获取有效的 Access Token，过期自动刷新 */
  async getAccessToken(): Promise<string> {
    if (!this.tokenData) {
      throw new Error('未登录百度网盘');
    }

    // 提前 5 分钟刷新
    if (Date.now() >= this.tokenData.expiresAt - 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }

    return this.tokenData!.accessToken;
  }

  /** 获取用户信息 */
  async getUserInfo(): Promise<BaiduUserInfo> {
    const accessToken = await this.getAccessToken();
    const url = `${BAIDU_OAUTH_CONFIG.userInfoUrl}?method=uinfo&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.errno && data.errno !== 0) {
      throw new Error(`获取用户信息失败: errno=${data.errno}`);
    }

    return {
      uk: data.uk,
      baiduName: data.baidu_name,
      netdiskName: data.netdisk_name,
      avatarUrl: data.avatar_url,
      vipType: data.vip_type,
    };
  }

  isAuthenticated(): boolean {
    return !!this.tokenData?.accessToken;
  }

  async disconnect(): Promise<void> {
    this.tokenData = null;
    await this.clearTokens();
    logger.info('auth', '百度网盘: 已断开连接');
  }

  // ---- Token 持久化 ----

  private async saveTokens(): Promise<void> {
    if (!this.tokenData) return;
    try {
      const json = JSON.stringify(this.tokenData);
      const encrypted = safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(json).toString('base64')
        : json;
      await fs.writeFile(this.tokenFilePath, encrypted, 'utf-8');
    } catch (err) {
      logger.error('auth', '百度网盘: 保存 Token 失败', err as Error);
    }
  }

  private loadStoredTokens(): void {
    try {
      const raw = require('fs').readFileSync(this.tokenFilePath, 'utf-8');
      let json: string;
      if (safeStorage.isEncryptionAvailable()) {
        json = safeStorage.decryptString(Buffer.from(raw, 'base64'));
      } else {
        json = raw;
      }
      this.tokenData = JSON.parse(json);
      logger.info('auth', '百度网盘: 已加载存储的 Token');
    } catch {
      this.tokenData = null;
    }
  }

  private async clearTokens(): Promise<void> {
    try {
      await fs.unlink(this.tokenFilePath);
    } catch { /* 文件不存在也没关系 */ }
  }
}

// 单例
let instance: BaiduPanAuth | null = null;
export function getBaiduPanAuth(): BaiduPanAuth {
  if (!instance) instance = new BaiduPanAuth();
  return instance;
}

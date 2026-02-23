/**
 * 通用 OAuth 2.0 认证管理器基类
 * 
 * 提供 OAuth 认证流程、Token 管理和刷新的通用实现
 */

import { BrowserWindow, safeStorage, app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
}

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export abstract class BaseAuthManager<TUserInfo, TTokenData extends TokenData> {
  protected authWindow: BrowserWindow | null = null;
  protected tokenData: TTokenData | null = null;
  protected tokenFilePath: string;
  protected abstract config: OAuthConfig;

  constructor(tokenFileName: string) {
    this.tokenFilePath = path.join(app.getPath('userData'), tokenFileName);
    this.loadStoredTokens();
  }

  /** 启动 OAuth 授权流程 */
  async authenticate(): Promise<TUserInfo> {
    logger.info('auth', `${this.getProviderName()}: 开始 OAuth 授权`);

    const code = await this.getAuthorizationCode();
    await this.exchangeCodeForToken(code);

    const userInfo = await this.getUserInfo();
    logger.info('auth', `${this.getProviderName()}: 授权成功`);
    return userInfo;
  }

  /** 断开连接 */
  async disconnect(): Promise<void> {
    this.tokenData = null;
    try {
      await fs.unlink(this.tokenFilePath);
    } catch {}
    logger.info('auth', `${this.getProviderName()}: 已断开连接`);
  }

  /** 检查是否已认证 */
  isAuthenticated(): boolean {
    return this.tokenData !== null && this.tokenData.accessToken !== '';
  }

  /** 获取访问令牌 */
  async getAccessToken(): Promise<string> {
    if (!this.tokenData) {
      throw new Error('未认证');
    }

    // 检查是否需要刷新
    if (Date.now() >= this.tokenData.expiresAt - 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }

    return this.tokenData.accessToken;
  }

  /** 获取用户信息 - 子类实现 */
  abstract getUserInfo(): Promise<TUserInfo>;

  /** 获取提供商名称 - 子类实现 */
  protected abstract getProviderName(): string;

  /** 构建授权 URL - 子类可覆盖 */
  protected buildAuthUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope,
    });
    return `${this.config.authUrl}?${params.toString()}`;
  }

  /** 解析回调 URL 中的授权码 - 子类可覆盖 */
  protected parseAuthCode(url: string): string | null {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('code');
  }

  /** 交换授权码为 Token - 子类可覆盖 */
  protected async exchangeCodeForToken(code: string): Promise<void> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
    });

    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret);
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token 交换失败: ${response.statusText}`);
    }

    const data = await response.json();
    this.tokenData = this.parseTokenResponse(data);
    await this.storeTokens();
  }

  /** 刷新访问令牌 */
  protected async refreshAccessToken(): Promise<void> {
    if (!this.tokenData?.refreshToken) {
      throw new Error('无刷新令牌');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.tokenData.refreshToken,
      client_id: this.config.clientId,
    });

    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret);
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error('Token 刷新失败');
    }

    const data = await response.json();
    this.tokenData = this.parseTokenResponse(data);
    await this.storeTokens();
    logger.info('auth', `${this.getProviderName()}: Token 已刷新`);
  }

  /** 解析 Token 响应 - 子类实现 */
  protected abstract parseTokenResponse(data: any): TTokenData;

  /** 打开浏览器窗口获取授权码 */
  private getAuthorizationCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      const authUrl = this.buildAuthUrl();

      this.authWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      this.authWindow.loadURL(authUrl);

      const handleCallback = (_event: any, url: string) => {
        if (!url.startsWith(this.config.redirectUri)) return;

        const code = this.parseAuthCode(url);
        if (code) {
          this.authWindow?.close();
          resolve(code);
        } else {
          const error = new URL(url).searchParams.get('error');
          this.authWindow?.close();
          reject(new Error(error || '授权失败'));
        }
      };

      this.authWindow.webContents.on('will-redirect', handleCallback);
      this.authWindow.webContents.on('will-navigate', handleCallback);

      this.authWindow.on('closed', () => {
        this.authWindow = null;
        reject(new Error('用户取消了授权'));
      });
    });
  }

  /** 加载存储的 Token */
  private async loadStoredTokens(): Promise<void> {
    try {
      const encrypted = await fs.readFile(this.tokenFilePath);
      const decrypted = safeStorage.decryptString(encrypted);
      this.tokenData = JSON.parse(decrypted);
      logger.info('auth', `${this.getProviderName()}: Token 已加载`);
    } catch {
      // Token 文件不存在或解密失败
    }
  }

  /** 存储 Token */
  private async storeTokens(): Promise<void> {
    if (!this.tokenData) return;

    const json = JSON.stringify(this.tokenData);
    const encrypted = safeStorage.encryptString(json);
    await fs.writeFile(this.tokenFilePath, encrypted);
  }
}

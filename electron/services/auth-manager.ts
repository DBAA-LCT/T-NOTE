/**
 * Auth Manager - OAuth 2.0 Authentication for OneDrive
 * 
 * Handles OAuth 2.0 authorization flow, token management, and user authentication.
 */

import { BrowserWindow, safeStorage, app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UserInfo, TokenData } from '../../src/types/onedrive-sync';
import { SettingsManager } from './settings-manager';
import { logger } from '../utils/logger';

// Load environment variables from .env file
async function loadEnvFile(): Promise<void> {
  try {
    const envPath = path.join(process.cwd(), '.env');
    const envContent = await fs.readFile(envPath, 'utf-8');
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          process.env[key.trim()] = value;
        }
      }
    });
  } catch {
    // .env file doesn't exist, that's okay
  }
}

// Load .env file synchronously at module load time
try {
  const envPath = path.join(process.cwd(), '.env');
  const envContent = require('fs').readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line: string) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    }
  });
} catch {
  // .env file doesn't exist, that's okay
}

// OAuth 2.0 Configuration
const OAUTH_CONFIG = {
  clientId: process.env.ONEDRIVE_CLIENT_ID || 'YOUR_CLIENT_ID',
  redirectUri: 'http://localhost:3000/auth/callback',
  authUrl: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
  scope: 'Files.ReadWrite offline_access User.Read',
  userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
};

export class AuthManager {
  private settingsManager: SettingsManager;
  private authWindow: BrowserWindow | null = null;
  private tokenData: TokenData | null = null;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
    this.loadStoredTokens();
  }

  /**
   * Start OAuth 2.0 authorization flow
   * Opens a browser window for user to authorize the application
   * @returns User information after successful authentication
   */
  async authenticate(): Promise<UserInfo> {
    logger.info('auth', 'Starting OAuth 2.0 authentication flow');

    try {
      // Step 1: Get authorization code
      const authCode = await this.getAuthorizationCode();
      
      // Step 2: Exchange authorization code for tokens
      const tokens = await this.exchangeCodeForTokens(authCode);
      
      // Step 3: Store tokens securely
      await this.storeTokens(tokens);
      
      // Step 4: Get user information
      const userInfo = await this.getUserInfo();
      
      logger.info('auth', 'Authentication successful', { userId: userInfo.id });
      return userInfo;
    } catch (error) {
      logger.error('auth', 'Authentication failed', error as Error);
      throw error;
    }
  }

  /**
   * Get authorization code by opening OAuth window
   * @returns Authorization code from OAuth callback
   */
  private async getAuthorizationCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Build authorization URL
      const authUrl = this.buildAuthorizationUrl();
      
      // Create authorization window
      this.authWindow = new BrowserWindow({
        width: 600,
        height: 800,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      // Load authorization URL
      this.authWindow.loadURL(authUrl);

      // Handle navigation to redirect URI
      this.authWindow.webContents.on('will-redirect', (_event, url) => {
        this.handleAuthCallback(url, resolve, reject);
      });

      // Handle direct navigation (some OAuth flows)
      this.authWindow.webContents.on('did-navigate', (_event, url) => {
        this.handleAuthCallback(url, resolve, reject);
      });

      // Handle window close
      this.authWindow.on('closed', () => {
        this.authWindow = null;
        reject(new Error('User cancelled authorization'));
      });
    });
  }

  /**
   * Build OAuth 2.0 authorization URL
   * @returns Complete authorization URL with parameters
   */
  private buildAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: OAUTH_CONFIG.clientId,
      response_type: 'code',
      redirect_uri: OAUTH_CONFIG.redirectUri,
      scope: OAUTH_CONFIG.scope,
      response_mode: 'query',
    });

    return `${OAUTH_CONFIG.authUrl}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback and extract authorization code
   * @param url Callback URL
   * @param resolve Promise resolve function
   * @param reject Promise reject function
   */
  private handleAuthCallback(
    url: string,
    resolve: (code: string) => void,
    reject: (error: Error) => void
  ): void {
    // Check if this is our redirect URI
    if (!url.startsWith(OAUTH_CONFIG.redirectUri)) {
      return;
    }

    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      const error = urlObj.searchParams.get('error');
      const errorDescription = urlObj.searchParams.get('error_description');

      // Close the auth window
      if (this.authWindow) {
        this.authWindow.close();
        this.authWindow = null;
      }

      if (error) {
        logger.error('auth', 'OAuth error', undefined, { error, errorDescription });
        reject(new Error(errorDescription || error));
        return;
      }

      if (!code) {
        reject(new Error('No authorization code received'));
        return;
      }

      logger.info('auth', 'Authorization code received');
      resolve(code);
    } catch (error) {
      logger.error('auth', 'Failed to parse callback URL', error as Error);
      reject(error as Error);
    }
  }

  /**
   * Exchange authorization code for access and refresh tokens
   * @param code Authorization code
   * @returns Token data
   */
  private async exchangeCodeForTokens(code: string): Promise<TokenData> {
    logger.info('auth', 'Exchanging authorization code for tokens');

    const params = new URLSearchParams({
      client_id: OAUTH_CONFIG.clientId,
      code,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      grant_type: 'authorization_code',
    });

    try {
      const response = await fetch(OAUTH_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || 'Token exchange failed');
      }

      const data = await response.json();
      
      const tokenData: TokenData = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };

      logger.info('auth', 'Tokens obtained successfully');
      return tokenData;
    } catch (error) {
      logger.error('auth', 'Token exchange failed', error as Error);
      throw error;
    }
  }

  /**
   * Get valid access token (automatically refreshes if expired)
   * @returns Valid access token
   */
  async getAccessToken(): Promise<string> {
    if (!this.tokenData) {
      throw new Error('Not authenticated');
    }

    // Check if token is expired or will expire in next 5 minutes
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    if (Date.now() + expiryBuffer >= this.tokenData.expiresAt) {
      logger.info('auth', 'Access token expired, refreshing');
      await this.refreshAccessToken();
    }

    return this.tokenData!.accessToken;
  }

  /**
   * Refresh access token using refresh token
   * @returns New access token
   */
  async refreshAccessToken(): Promise<string> {
    if (!this.tokenData?.refreshToken) {
      throw new Error('No refresh token available');
    }

    logger.info('auth', 'Refreshing access token');

    const params = new URLSearchParams({
      client_id: OAUTH_CONFIG.clientId,
      refresh_token: this.tokenData.refreshToken,
      grant_type: 'refresh_token',
    });

    try {
      const response = await fetch(OAUTH_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('auth', 'Token refresh failed', undefined, { error: errorData });
        
        // Clear invalid tokens
        this.tokenData = null;
        await this.clearStoredTokens();
        
        throw new Error(errorData.error_description || 'Token refresh failed');
      }

      const data = await response.json();
      
      // Update token data
      this.tokenData = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.tokenData.refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
      };

      // Store updated tokens
      await this.storeTokens(this.tokenData);

      logger.info('auth', 'Access token refreshed successfully');
      return this.tokenData.accessToken;
    } catch (error) {
      logger.error('auth', 'Token refresh failed', error as Error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   * @returns Authentication status
   */
  isAuthenticated(): boolean {
    return this.tokenData !== null;
  }

  /**
   * Disconnect account and clear all tokens
   */
  async disconnect(): Promise<void> {
    logger.info('auth', 'Disconnecting OneDrive account');

    // Clear in-memory tokens
    this.tokenData = null;

    // Clear stored tokens (this also clears OneDrive settings)
    await this.clearStoredTokens();

    logger.info('auth', 'Account disconnected successfully');
  }

  /**
   * Get current user information
   * @returns User information
   */
  async getUserInfo(): Promise<UserInfo> {
    const accessToken = await this.getAccessToken();

    try {
      const response = await fetch(OAUTH_CONFIG.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get user info');
      }

      const data = await response.json();

      return {
        id: data.id,
        displayName: data.displayName,
        email: data.userPrincipalName || data.mail,
      };
    } catch (error) {
      logger.error('auth', 'Failed to get user info', error as Error);
      throw error;
    }
  }

  /**
   * Store tokens securely using Electron's safeStorage
   * @param tokens Token data to store
   */
  async storeTokens(tokens: TokenData): Promise<void> {
    this.tokenData = tokens;

    try {
      // Encrypt token data
      const tokenJson = JSON.stringify(tokens);
      const encrypted = safeStorage.encryptString(tokenJson);

      // Store encrypted data in a separate file
      const userDataPath = app.getPath('userData');
      const tokenPath = path.join(userDataPath, 'onedrive-tokens.enc');
      
      await fs.writeFile(tokenPath, encrypted.toString('base64'), 'utf-8');

      // Ensure settings manager is initialized before updating connection status
      const { ensureSettingsManagerInitialized } = require('./settings-manager');
      const settingsManager = await ensureSettingsManagerInitialized();
      await settingsManager.setConnectionStatus(true);

      logger.info('auth', 'Tokens stored securely');
    } catch (error) {
      logger.error('auth', 'Failed to store tokens', error as Error);
      throw error;
    }
  }

  /**
   * Load stored tokens from secure storage
   */
  private async loadStoredTokens(): Promise<void> {
    try {
      const userDataPath = app.getPath('userData');
      const tokenPath = path.join(userDataPath, 'onedrive-tokens.enc');

      // Check if token file exists
      try {
        await fs.access(tokenPath);
      } catch {
        // Token file doesn't exist
        return;
      }

      // Read and decrypt token data
      const encryptedData = await fs.readFile(tokenPath, 'utf-8');
      const encrypted = Buffer.from(encryptedData, 'base64');
      const decrypted = safeStorage.decryptString(encrypted);
      this.tokenData = JSON.parse(decrypted);

      logger.info('auth', 'Tokens loaded from storage');
    } catch (error) {
      logger.error('auth', 'Failed to load stored tokens', error as Error);
      // Clear invalid tokens
      await this.clearStoredTokens();
    }
  }

  /**
   * Clear stored tokens
   */
  private async clearStoredTokens(): Promise<void> {
    try {
      const userDataPath = app.getPath('userData');
      const tokenPath = path.join(userDataPath, 'onedrive-tokens.enc');

      // Delete token file if it exists
      try {
        await fs.unlink(tokenPath);
      } catch {
        // File doesn't exist, that's fine
      }

      // Ensure settings manager is initialized before clearing settings
      const { ensureSettingsManagerInitialized } = require('./settings-manager');
      const settingsManager = await ensureSettingsManagerInitialized();
      await settingsManager.clearOneDriveSettings();
      
      logger.info('auth', 'Stored tokens cleared');
    } catch (error) {
      logger.error('auth', 'Failed to clear stored tokens', error as Error);
    }
  }

  /**
   * Get stored tokens (for testing purposes)
   * @returns Stored token data or null if not authenticated
   */
  async getStoredTokens(): Promise<TokenData | null> {
    return this.tokenData;
  }
}

// Singleton instance
let authManagerInstance: AuthManager | null = null;

/**
 * Get the singleton Auth Manager instance
 */
export function getAuthManager(): AuthManager {
  if (!authManagerInstance) {
    const { getSettingsManager } = require('./settings-manager');
    authManagerInstance = new AuthManager(getSettingsManager());
  }
  return authManagerInstance;
}

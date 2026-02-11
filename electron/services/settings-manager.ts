/**
 * Settings Manager
 * 
 * Manages sync-related configuration and settings storage.
 * Uses JSON file storage with Electron's app.getPath('userData').
 */

import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { SyncSettings, AppSettings } from '../../src/types/onedrive-sync';
import { logger } from '../utils/logger';

export class SettingsManager {
  private settingsPath: string;
  private settings: AppSettings | null = null;
  private readonly DEFAULT_SETTINGS: AppSettings = {
    onedrive: {
      connected: false,
      userId: null,
      userEmail: null,
      syncFolder: null,
    },
    sync: {
      wifiOnly: false,
      saveConflictCopy: true,
    },
  };

  constructor() {
    const userDataPath = app.getPath('userData');
    this.settingsPath = path.join(userDataPath, 'onedrive-sync-settings.json');
  }

  /**
   * Initialize settings manager and load existing settings
   */
  async initialize(): Promise<void> {
    try {
      await this.loadSettings();
      logger.info('general', 'Settings Manager initialized', { path: this.settingsPath });
    } catch (error) {
      logger.error('general', 'Failed to initialize Settings Manager', error as Error);
      throw error;
    }
  }

  /**
   * Load settings from disk
   */
  private async loadSettings(): Promise<void> {
    try {
      const fileExists = await this.fileExists(this.settingsPath);
      
      if (fileExists) {
        const data = await fs.readFile(this.settingsPath, 'utf-8');
        this.settings = JSON.parse(data);
        logger.info('general', 'Settings loaded from disk');
      } else {
        // Initialize with default settings
        this.settings = { ...this.DEFAULT_SETTINGS };
        await this.saveSettings();
        logger.info('general', 'Initialized with default settings');
      }
    } catch (error) {
      logger.error('general', 'Failed to load settings', error as Error);
      // Fall back to default settings
      this.settings = { ...this.DEFAULT_SETTINGS };
    }
  }

  /**
   * Save settings to disk
   */
  private async saveSettings(): Promise<void> {
    try {
      if (!this.settings) {
        throw new Error('Settings not initialized');
      }

      const data = JSON.stringify(this.settings, null, 2);
      await fs.writeFile(this.settingsPath, data, 'utf-8');
      logger.info('general', 'Settings saved to disk');
    } catch (error) {
      logger.error('general', 'Failed to save settings', error as Error);
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get sync folder path
   * @returns Sync folder path or null if not set
   */
  getSyncFolder(): string | null {
    if (!this.settings) {
      throw new Error('Settings not initialized');
    }
    return this.settings.onedrive.syncFolder;
  }

  /**
   * Set sync folder path
   * @param folderPath - OneDrive folder path
   */
  async setSyncFolder(folderPath: string): Promise<void> {
    if (!this.settings) {
      throw new Error('Settings not initialized');
    }

    // Validate folder path
    const validatedPath = this.validateFolderPath(folderPath);

    this.settings.onedrive.syncFolder = validatedPath;
    await this.saveSettings();
    
    logger.info('sync', 'Sync folder updated', { folderPath: validatedPath });
  }

  /**
   * Validate folder path
   * @param folderPath - Path to validate
   * @returns Normalized valid path
   * @throws Error if path is invalid
   */
  private validateFolderPath(folderPath: string): string {
    // Check if path is provided and is a string
    if (!folderPath || typeof folderPath !== 'string') {
      throw new Error('Folder path must be a non-empty string');
    }

    // Trim whitespace
    const trimmedPath = folderPath.trim();
    
    if (trimmedPath.length === 0) {
      throw new Error('Folder path cannot be empty');
    }

    // Check for invalid characters (Windows and OneDrive restrictions)
    const invalidChars = /[<>:"|?*\x00-\x1F]/;
    if (invalidChars.test(trimmedPath)) {
      throw new Error('Folder path contains invalid characters');
    }

    // Check for reserved names (Windows)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    const pathParts = trimmedPath.split('/');
    for (const part of pathParts) {
      if (reservedNames.test(part)) {
        throw new Error(`Folder path contains reserved name: ${part}`);
      }
    }

    // Normalize path (remove trailing slashes, convert backslashes to forward slashes)
    let normalizedPath = trimmedPath.replace(/\\/g, '/').replace(/\/+$/, '');
    
    // Remove leading slash if present (OneDrive paths are relative)
    normalizedPath = normalizedPath.replace(/^\/+/, '');

    // Ensure path doesn't have double slashes
    normalizedPath = normalizedPath.replace(/\/+/g, '/');

    return normalizedPath;
  }

  /**
   * Get sync settings
   * @returns Current sync settings
   */
  getSyncSettings(): SyncSettings {
    if (!this.settings) {
      throw new Error('Settings not initialized');
    }

    return {
      wifiOnly: this.settings.sync.wifiOnly,
      saveConflictCopy: this.settings.sync.saveConflictCopy,
      syncFolder: this.settings.onedrive.syncFolder,
    };
  }

  /**
   * Update sync settings
   * @param settings - Partial sync settings to update
   */
  async updateSyncSettings(settings: Partial<SyncSettings>): Promise<void> {
    if (!this.settings) {
      throw new Error('Settings not initialized');
    }

    // Update sync settings
    if (settings.wifiOnly !== undefined) {
      this.settings.sync.wifiOnly = settings.wifiOnly;
    }

    if (settings.saveConflictCopy !== undefined) {
      this.settings.sync.saveConflictCopy = settings.saveConflictCopy;
    }

    if (settings.syncFolder !== undefined) {
      this.settings.onedrive.syncFolder = settings.syncFolder;
    }

    await this.saveSettings();
    
    logger.info('sync', 'Sync settings updated', { settings });
  }

  /**
   * Get OneDrive connection status
   * @returns Connection status
   */
  isConnected(): boolean {
    if (!this.settings) {
      throw new Error('Settings not initialized');
    }
    return this.settings.onedrive.connected;
  }

  /**
   * Set OneDrive connection status
   * @param connected - Connection status
   * @param userId - User ID (optional)
   * @param userEmail - User email (optional)
   */
  async setConnectionStatus(
    connected: boolean,
    userId?: string,
    userEmail?: string
  ): Promise<void> {
    if (!this.settings) {
      throw new Error('Settings not initialized');
    }

    this.settings.onedrive.connected = connected;
    
    if (userId !== undefined) {
      this.settings.onedrive.userId = userId;
    }
    
    if (userEmail !== undefined) {
      this.settings.onedrive.userEmail = userEmail;
    }

    await this.saveSettings();
    
    logger.info('auth', 'Connection status updated', { connected, userId, userEmail });
  }

  /**
   * Clear all OneDrive settings (for disconnect)
   */
  async clearOneDriveSettings(): Promise<void> {
    if (!this.settings) {
      throw new Error('Settings not initialized');
    }

    this.settings.onedrive = {
      connected: false,
      userId: null,
      userEmail: null,
      syncFolder: null,
    };

    await this.saveSettings();
    
    logger.info('auth', 'OneDrive settings cleared');
  }

  /**
   * Get all settings (for debugging/export)
   * @returns Complete settings object
   */
  getAllSettings(): AppSettings {
    if (!this.settings) {
      throw new Error('Settings not initialized');
    }
    return { ...this.settings };
  }

  /**
   * Reset all settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    this.settings = { ...this.DEFAULT_SETTINGS };
    await this.saveSettings();
    logger.info('general', 'Settings reset to defaults');
  }
}

// Singleton instance
let settingsManagerInstance: SettingsManager | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Get the singleton Settings Manager instance
 * Automatically initializes on first call
 */
export function getSettingsManager(): SettingsManager {
  if (!settingsManagerInstance) {
    settingsManagerInstance = new SettingsManager();
    // Initialize asynchronously but don't wait for it
    // The initialize() method will be called, and subsequent calls will use the initialized instance
    initializationPromise = settingsManagerInstance.initialize().catch(error => {
      logger.error('general', 'Failed to initialize SettingsManager', error as Error);
    });
  }
  return settingsManagerInstance;
}

/**
 * Ensure settings manager is initialized
 * Call this before using the settings manager in critical paths
 */
export async function ensureSettingsManagerInitialized(): Promise<SettingsManager> {
  const manager = getSettingsManager();
  if (initializationPromise) {
    await initializationPromise;
  }
  return manager;
}

/**
 * OneDrive Sync IPC Handlers
 * 
 * This file implements all IPC handlers for OneDrive sync functionality.
 * It connects the renderer process requests to the main process services.
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IPC_CHANNELS } from './sync-channels';
import { getAuthManager } from '../services/auth-manager';
import { getSyncEngine } from '../services/sync-engine';
import { getSettingsManager } from '../services/settings-manager';
import { getConflictResolver } from '../services/conflict-resolver';
import { getNetworkMonitor } from '../services/network-monitor';
import { getOneDriveClient } from '../services/onedrive-client';
import { logger } from '../utils/logger';
import type {
  SyncOptions,
  ConflictInfo,
  ConflictResolution,
  SyncSettings,
} from '../../src/types/onedrive-sync';

/**
 * Register all OneDrive sync IPC handlers
 */
export function registerSyncHandlers(mainWindow: BrowserWindow): void {
  // ============================================================================
  // Authentication Handlers
  // ============================================================================

  ipcMain.handle(IPC_CHANNELS.AUTH_AUTHENTICATE, async () => {
    try {
      logger.info('auth', 'IPC: Starting authentication');
      const authManager = getAuthManager();
      const userInfo = await authManager.authenticate();
      logger.info('auth', 'IPC: Authentication successful', { userId: userInfo.id });
      return userInfo;
    } catch (error) {
      logger.error('auth', 'IPC: Authentication failed', error as Error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_DISCONNECT, async () => {
    try {
      logger.info('auth', 'IPC: Disconnecting OneDrive account');
      const authManager = getAuthManager();
      await authManager.disconnect();
      logger.info('auth', 'IPC: Disconnect successful');
    } catch (error) {
      logger.error('auth', 'IPC: Disconnect failed', error as Error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_USER_INFO, async () => {
    try {
      const authManager = getAuthManager();
      const userInfo = await authManager.getUserInfo();
      return userInfo;
    } catch (error) {
      logger.error('auth', 'IPC: Get user info failed', error as Error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_IS_AUTHENTICATED, async () => {
    try {
      const authManager = getAuthManager();
      return authManager.isAuthenticated();
    } catch (error) {
      logger.error('auth', 'IPC: Check authentication failed', error as Error);
      return false;
    }
  });

  // ============================================================================
  // Sync Operation Handlers
  // ============================================================================

  ipcMain.handle(IPC_CHANNELS.SYNC_EXECUTE, async (_, options?: SyncOptions) => {
    try {
      logger.info('sync', 'IPC: Starting full sync', { options });
      const syncEngine = getSyncEngine();
      
      // Set up progress callback
      syncEngine.onProgress((progress) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.EVENT_SYNC_PROGRESS, progress);
        }
      });
      
      const result = await syncEngine.sync(options);
      
      // Send completion event
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.EVENT_SYNC_COMPLETE, { result });
      }
      
      logger.info('sync', 'IPC: Sync completed', { 
        uploaded: result.uploaded, 
        downloaded: result.downloaded,
        conflicts: result.conflicts.length,
        errors: result.errors.length
      });
      
      return result;
    } catch (error) {
      logger.error('sync', 'IPC: Sync failed', error as Error);
      
      // Send error event
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.EVENT_SYNC_ERROR, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYNC_NOTE, async (_, noteId: string) => {
    try {
      logger.info('sync', 'IPC: Syncing single note', { noteId });
      const syncEngine = getSyncEngine();
      const result = await syncEngine.syncNote(noteId);
      logger.info('sync', 'IPC: Note sync completed', { noteId, status: result.status });
      return result;
    } catch (error) {
      logger.error('sync', 'IPC: Note sync failed', error as Error, { noteId });
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYNC_UPLOAD_NOTE, async (_, noteId: string) => {
    try {
      logger.info('sync', 'IPC: Uploading note', { noteId });
      const syncEngine = getSyncEngine();
      const result = await syncEngine.uploadNote(noteId);
      logger.info('sync', 'IPC: Note upload completed', { noteId, success: result.success });
      return result;
    } catch (error) {
      logger.error('sync', 'IPC: Note upload failed', error as Error, { noteId });
      throw error;
    }
  });

  // Upload note content directly (for current note in editor)
  ipcMain.handle('onedrive:sync:uploadNoteContent', async (_, { noteContent, noteName, noteId, currentFilePath }: { noteContent: string; noteName: string; noteId: string; currentFilePath?: string }) => {
    try {
      logger.info('sync', 'IPC: Uploading note content', { noteName, noteId, contentLength: noteContent.length });
      
      const syncFolder = getSettingsManager().getSyncFolder();
      if (!syncFolder) {
        throw new Error('Sync folder not configured');
      }

      // Parse and validate note content
      let note;
      try {
        note = JSON.parse(noteContent);
        logger.info('sync', 'Note parsed successfully', { 
          id: note.id, 
          name: note.name, 
          pagesCount: note.pages?.length || 0 
        });
      } catch (error) {
        logger.error('sync', 'Failed to parse note content', error as Error);
        throw new Error('Invalid note content format');
      }
      
      // 确定文件名：如果有本地文件路径，使用本地文件名；否则使用笔记ID
      let fileName: string;
      if (currentFilePath) {
        // 从本地文件路径提取文件名
        fileName = path.basename(currentFilePath);
        logger.info('sync', 'Using filename from local path', { fileName, currentFilePath });
      } else {
        // 使用笔记ID作为文件名
        fileName = `${noteId}.note`;
        logger.info('sync', 'Using noteId as filename', { fileName });
      }
      
      // Create temporary file
      const tempDir = await import('os').then(os => os.tmpdir());
      const tempFilePath = path.join(tempDir, fileName);
      await fs.writeFile(tempFilePath, noteContent, 'utf-8');
      
      // Verify temp file was written correctly
      const tempFileContent = await fs.readFile(tempFilePath, 'utf-8');
      logger.info('sync', 'Temp file created', { 
        tempFilePath, 
        originalLength: noteContent.length,
        tempFileLength: tempFileContent.length,
        match: noteContent === tempFileContent
      });

      try {
        // Upload to OneDrive
        const client = getOneDriveClient();
        const remotePath = `${syncFolder}/${fileName}`;
        logger.info('sync', 'Uploading to OneDrive', { remotePath });
        
        const driveItem = await client.uploadFile(tempFilePath, remotePath);

        logger.info('sync', 'IPC: Note content uploaded successfully', { 
          noteId, 
          cloudId: driveItem.id, 
          fileName,
          size: driveItem.size
        });

        // 更新笔记的同步配置
        if (currentFilePath) {
          const { getFileManager } = require('../services/file-manager');
          const fileManager = getFileManager();
          
          try {
            const updatedNote = await fileManager.readNote(noteId);
            updatedNote.syncConfig = {
              enabled: true,
              autoCommit: false,
              oneDrivePath: syncFolder,
              lastSyncAt: Date.now()
            };
            updatedNote.syncMetadata = {
              cloudId: driveItem.id,
              lastSyncAt: Date.now(),
              syncStatus: 'synced'
            };
            await fileManager.writeNote(updatedNote);
            logger.info('sync', 'Note sync config updated', { noteId });
          } catch (error) {
            logger.warn('sync', 'Failed to update note sync config', error as Error);
          }
        }

        return {
          success: true,
          cloudId: driveItem.id,
          fileName: fileName
        };
      } finally {
        // Clean up temp file
        await fs.unlink(tempFilePath).catch(() => {});
      }
    } catch (error) {
      logger.error('sync', 'IPC: Upload note content failed', error as Error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYNC_DOWNLOAD_NOTE, async (_, cloudNoteId: string, localPath?: string) => {
    try {
      logger.info('sync', 'IPC: Downloading note', { cloudNoteId, localPath });
      
      // 创建临时下载路径
      const tempDir = await import('os').then(os => os.tmpdir());
      const tempFilePath = path.join(tempDir, `${cloudNoteId}.note.download`);

      // 从OneDrive下载文件
      const client = getOneDriveClient();
      await client.downloadFile(cloudNoteId, tempFilePath);

      // 读取下载的内容
      const content = await fs.readFile(tempFilePath, 'utf-8');
      const note = JSON.parse(content);

      // 如果提供了本地路径，保存到指定位置
      if (localPath) {
        await fs.writeFile(localPath, content, 'utf-8');
        logger.info('sync', 'IPC: Note saved to local path', { cloudNoteId, localPath });
      }

      // 清理临时文件
      await fs.unlink(tempFilePath).catch(() => {});

      logger.info('sync', 'IPC: Note download completed', { cloudNoteId, success: true });
      return { success: true, localId: note.id, content };
    } catch (error) {
      logger.error('sync', 'IPC: Note download failed', error as Error, { cloudNoteId });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYNC_GET_STATUS, async (_, noteId: string) => {
    try {
      const syncEngine = getSyncEngine();
      return syncEngine.getSyncStatus(noteId);
    } catch (error) {
      logger.error('sync', 'IPC: Get sync status failed', error as Error, { noteId });
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYNC_CANCEL, async () => {
    try {
      logger.info('sync', 'IPC: Cancelling sync');
      const syncEngine = getSyncEngine();
      await syncEngine.cancelSync();
      logger.info('sync', 'IPC: Sync cancelled');
    } catch (error) {
      logger.error('sync', 'IPC: Cancel sync failed', error as Error);
      throw error;
    }
  });

  // ============================================================================
  // Cloud Notes Handlers
  // ============================================================================

  ipcMain.handle(IPC_CHANNELS.CLOUD_GET_NOTES, async () => {
    try {
      logger.info('sync', 'IPC: Getting cloud notes');
      const syncEngine = getSyncEngine();
      const notes = await syncEngine.getCloudNotes();
      logger.info('sync', 'IPC: Retrieved cloud notes', { count: notes.length });
      return notes;
    } catch (error) {
      logger.error('sync', 'IPC: Get cloud notes failed', error as Error);
      throw error;
    }
  });

  // ============================================================================
  // Page-Level Sync Handlers
  // ============================================================================

  ipcMain.handle('onedrive:commit-page', async (_, noteId: string, pageId: string) => {
    try {
      logger.info('sync', 'IPC: Committing page', { noteId, pageId });
      const syncEngine = getSyncEngine();
      const result = await syncEngine.commitPage(noteId, pageId);
      logger.info('sync', 'IPC: Page commit completed', { noteId, pageId, success: result.success });
      return result;
    } catch (error) {
      logger.error('sync', 'IPC: Page commit failed', error as Error, { noteId, pageId });
      throw error;
    }
  });

  ipcMain.handle('onedrive:get-cloud-pages', async (_, noteId: string) => {
    try {
      logger.info('sync', 'IPC: Getting cloud pages', { noteId });
      const syncEngine = getSyncEngine();
      const pages = await syncEngine.getCloudPages(noteId);
      logger.info('sync', 'IPC: Retrieved cloud pages', { noteId, count: pages.length });
      return pages;
    } catch (error) {
      logger.error('sync', 'IPC: Get cloud pages failed', error as Error, { noteId });
      throw error;
    }
  });

  ipcMain.handle('onedrive:use-cloud-version', async (_, noteId: string, pageId: string) => {
    try {
      logger.info('sync', 'IPC: Using cloud version', { noteId, pageId });
      const syncEngine = getSyncEngine();
      await syncEngine.useCloudVersion(noteId, pageId);
      logger.info('sync', 'IPC: Cloud version applied', { noteId, pageId });
    } catch (error) {
      logger.error('sync', 'IPC: Use cloud version failed', error as Error, { noteId, pageId });
      throw error;
    }
  });

  ipcMain.handle('onedrive:enable-note-sync', async (_, noteId: string, oneDrivePath: string) => {
    try {
      logger.info('sync', 'IPC: Enabling note sync', { noteId, oneDrivePath });
      
      // Read note
      const { getFileManager } = require('../services/file-manager');
      const fileManager = getFileManager();
      const note = await fileManager.readNote(noteId);
      
      // Update sync config
      note.syncConfig = {
        enabled: true,
        autoCommit: false,
        oneDrivePath: oneDrivePath,
        lastSyncAt: Date.now()
      };
      
      await fileManager.writeNote(note);
      
      // Create cloud folder
      const client = getOneDriveClient();
      try {
        await client.createFolder(noteId, oneDrivePath);
      } catch (error: any) {
        // Folder might already exist, ignore error
        if (!error.message?.includes('已存在')) {
          throw error;
        }
      }
      
      logger.info('sync', 'IPC: Note sync enabled', { noteId });
      return { success: true };
    } catch (error) {
      logger.error('sync', 'IPC: Enable note sync failed', error as Error, { noteId, oneDrivePath });
      throw error;
    }
  });

  ipcMain.handle('onedrive:update-note-sync-settings', async (_, noteId: string, settings: { autoCommit?: boolean }) => {
    try {
      logger.info('sync', 'IPC: Updating note sync settings', { noteId, settings });
      
      const { getFileManager } = require('../services/file-manager');
      const fileManager = getFileManager();
      const note = await fileManager.readNote(noteId);
      
      if (!note.syncConfig) {
        throw new Error('Sync not enabled for this note');
      }
      
      note.syncConfig = {
        ...note.syncConfig,
        ...settings
      };
      
      await fileManager.writeNote(note);
      
      logger.info('sync', 'IPC: Note sync settings updated', { noteId });
      return { success: true };
    } catch (error) {
      logger.error('sync', 'IPC: Update note sync settings failed', error as Error, { noteId });
      throw error;
    }
  });

  // ============================================================================
  // Folder Browsing Handlers
  // ============================================================================

  ipcMain.handle(IPC_CHANNELS.CLOUD_BROWSE_FOLDERS, async (_, parentPath?: string) => {
    try {
      logger.info('api', 'IPC: Browsing folders', { parentPath });
      const client = getOneDriveClient();
      const folders = await client.browseFolders(parentPath);
      logger.info('api', 'IPC: Retrieved folders', { count: folders.length });
      return folders;
    } catch (error) {
      logger.error('api', 'IPC: Browse folders failed', error as Error, { parentPath });
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLOUD_CREATE_FOLDER, async (_, { folderName, parentPath }: { folderName: string; parentPath?: string }) => {
    try {
      logger.info('api', 'IPC: Creating folder', { folderName, parentPath });
      const client = getOneDriveClient();
      const folder = await client.createFolder(folderName, parentPath);
      logger.info('api', 'IPC: Folder created', { folderId: folder.id, folderName: folder.name });
      return folder;
    } catch (error) {
      logger.error('api', 'IPC: Create folder failed', error as Error, { folderName, parentPath });
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLOUD_GET_STORAGE_QUOTA, async () => {
    try {
      logger.info('api', 'IPC: Getting storage quota');
      const client = getOneDriveClient();
      const quota = await client.getStorageQuota();
      logger.info('api', 'IPC: Retrieved storage quota', { 
        total: quota.total, 
        used: quota.used, 
        remaining: quota.remaining 
      });
      return quota;
    } catch (error) {
      logger.error('api', 'IPC: Get storage quota failed', error as Error);
      throw error;
    }
  });

  // ============================================================================
  // Settings Handlers
  // ============================================================================

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_SYNC_FOLDER, async () => {
    try {
      const settingsManager = getSettingsManager();
      return settingsManager.getSyncFolder();
    } catch (error) {
      logger.error('general', 'IPC: Get sync folder failed', error as Error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_SYNC_FOLDER, async (_, folderPath: string) => {
    try {
      logger.info('general', 'IPC: Setting sync folder', { folderPath });
      const settingsManager = getSettingsManager();
      await settingsManager.setSyncFolder(folderPath);
      logger.info('general', 'IPC: Sync folder set successfully');
    } catch (error) {
      logger.error('general', 'IPC: Set sync folder failed', error as Error, { folderPath });
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_SYNC_SETTINGS, async () => {
    try {
      const settingsManager = getSettingsManager();
      return settingsManager.getSyncSettings();
    } catch (error) {
      logger.error('general', 'IPC: Get sync settings failed', error as Error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE_SYNC_SETTINGS, async (_, settings: Partial<SyncSettings>) => {
    try {
      logger.info('general', 'IPC: Updating sync settings', { settings });
      const settingsManager = getSettingsManager();
      await settingsManager.updateSyncSettings(settings);
      logger.info('general', 'IPC: Sync settings updated successfully');
    } catch (error) {
      logger.error('general', 'IPC: Update sync settings failed', error as Error, { settings });
      throw error;
    }
  });

  // ============================================================================
  // Conflict Resolution Handlers
  // ============================================================================

  ipcMain.handle(IPC_CHANNELS.CONFLICT_RESOLVE, async (_, { conflict, resolution }: { 
    conflict: ConflictInfo; 
    resolution: ConflictResolution 
  }) => {
    try {
      logger.info('conflict', 'IPC: Resolving conflict', { 
        noteId: conflict.noteId, 
        action: resolution.action 
      });
      const conflictResolver = getConflictResolver();
      await conflictResolver.resolveConflict(conflict, resolution);
      logger.info('conflict', 'IPC: Conflict resolved successfully');
    } catch (error) {
      logger.error('conflict', 'IPC: Resolve conflict failed', error as Error, { 
        noteId: conflict.noteId 
      });
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.CONFLICT_GET_INFO, async (_, noteId: string) => {
    try {
      const syncEngine = getSyncEngine();
      // Get conflict info from sync engine's conflict tracking
      const conflicts = syncEngine.getConflicts();
      const conflict = conflicts.find(c => c.noteId === noteId);
      return conflict || null;
    } catch (error) {
      logger.error('conflict', 'IPC: Get conflict info failed', error as Error, { noteId });
      throw error;
    }
  });

  // ============================================================================
  // Network Handlers
  // ============================================================================

  ipcMain.handle(IPC_CHANNELS.NETWORK_GET_STATUS, async () => {
    try {
      const networkMonitor = getNetworkMonitor();
      return await networkMonitor.getStatus();
    } catch (error) {
      logger.error('network', 'IPC: Get network status failed', error as Error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.NETWORK_IS_WIFI, async () => {
    try {
      const networkMonitor = getNetworkMonitor();
      return await networkMonitor.isWiFi();
    } catch (error) {
      logger.error('network', 'IPC: Check WiFi failed', error as Error);
      throw error;
    }
  });

  // ============================================================================
  // Event Listeners Setup
  // ============================================================================

  // Network status change listener
  const networkMonitor = getNetworkMonitor();
  networkMonitor.onStatusChange((status) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_NETWORK_STATUS_CHANGE, {
        status
      });
    }
  });

  // Conflict detection listener
  const syncEngine = getSyncEngine();
  syncEngine.onConflictDetected((conflict) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_CONFLICT_DETECTED, conflict);
    }
  });

  logger.info('general', 'All OneDrive sync IPC handlers registered successfully');
}

/**
 * Unregister all OneDrive sync IPC handlers
 */
export function unregisterSyncHandlers(): void {
  // Remove all handlers
  Object.values(IPC_CHANNELS).forEach(channel => {
    ipcMain.removeHandler(channel);
  });
  
  logger.info('general', 'All OneDrive sync IPC handlers unregistered');
}

/**
 * Sync Engine - Core Synchronization Component
 * 
 * Coordinates all sync operations including bidirectional sync,
 * conflict detection, and sync state management.
 */

import type {
  Note,
  SyncOptions,
  SyncResult,
  NoteSyncResult,
  UploadResult,
  DownloadResult,
  CloudNote,
  SyncStatus,
  CloudNoteData,
  DriveItem,
  ConflictInfo,
  SyncErrorInfo,
  InitialSyncStrategy,
  InitialSyncOptions,
  InitialSyncResult,
  IPCSyncProgress
} from '../../src/types/onedrive-sync';
import { logger } from '../utils/logger';
import { getFileManager } from './file-manager';
import { getConflictResolver } from './conflict-resolver';
import { OneDriveClient } from './onedrive-client';
import { SettingsManager } from './settings-manager';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Sync plan item representing an action to take
 */
interface SyncPlanItem {
  noteId: string;
  noteName: string;
  action: 'upload' | 'download' | 'conflict';
  localNote?: Note;
  cloudNote?: CloudNoteData;
}

/**
 * Sync plan containing all actions to execute
 */
interface SyncPlan {
  upload: SyncPlanItem[];
  download: SyncPlanItem[];
  conflicts: SyncPlanItem[];
}

export class SyncEngine {
  private fileManager = getFileManager();
  private conflictResolver = getConflictResolver();
  private oneDriveClient: OneDriveClient;
  private settingsManager: SettingsManager;
  private syncStates: Map<string, SyncStatus> = new Map();
  private progressCallback?: (progress: IPCSyncProgress) => void;
  private conflictCallback?: (conflict: ConflictInfo) => void;
  private conflicts: ConflictInfo[] = [];
  private isCancelled = false;

  constructor(oneDriveClient: OneDriveClient, settingsManager: SettingsManager) {
    this.oneDriveClient = oneDriveClient;
    this.settingsManager = settingsManager;
  }

  /**
   * Execute complete bidirectional sync
   * Requirements: 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 9.2
   * @param options Sync options
   * @returns Sync result
   */
  async sync(options?: SyncOptions): Promise<SyncResult> {
    logger.info('sync', 'Starting bidirectional sync');

    const result: SyncResult = {
      uploaded: 0,
      downloaded: 0,
      conflicts: [],
      errors: [],
      timestamp: Date.now()
    };

    try {
      // Step 1: Check network and WiFi settings
      // TODO: Implement network check when NetworkMonitor is integrated
      const settings = options || this.settingsManager.getSyncSettings();

      // Step 2: Get sync folder path
      const syncFolder = this.settingsManager.getSyncFolder();
      if (!syncFolder) {
        throw new Error('Sync folder not configured');
      }

      // Step 3: Get local notes
      logger.info('sync', 'Fetching local notes');
      const localNotes = await this.fileManager.getAllNotes();
      logger.info('sync', `Found ${localNotes.length} local notes`);

      // Step 4: Get cloud notes
      logger.info('sync', 'Fetching cloud notes');
      const cloudNotes = await this.getCloudNotesData(syncFolder);
      logger.info('sync', `Found ${cloudNotes.length} cloud notes`);

      // Step 5: Generate sync plan
      logger.info('sync', 'Generating sync plan');
      const plan = this.generateSyncPlan(localNotes, cloudNotes);
      logger.info('sync', 'Sync plan generated', {
        uploadCount: plan.upload.length,
        downloadCount: plan.download.length,
        conflictCount: plan.conflicts.length
      });

      // Step 6: Execute uploads
      this.isCancelled = false;
      const totalOperations = plan.upload.length + plan.download.length;
      let currentOperation = 0;

      for (const item of plan.upload) {
        if (this.isCancelled) {
          logger.info('sync', 'Sync cancelled by user');
          break;
        }

        try {
          currentOperation++;
          this.emitProgress(currentOperation, totalOperations, 'upload', item.noteId, item.noteName);
          this.setSyncStatus(item.noteId, 'syncing');
          await this.uploadNote(item.noteId);
          result.uploaded++;
          this.setSyncStatus(item.noteId, 'synced');
        } catch (error) {
          logger.error('sync', `Failed to upload note: ${item.noteId}`, error as Error);
          const syncError: SyncErrorInfo = {
            noteId: item.noteId,
            noteName: item.noteName,
            error: (error as Error).message,
            type: 'upload'
          };
          result.errors.push(syncError);
          this.setSyncStatus(item.noteId, 'error');
        }
      }

      // Step 7: Execute downloads
      for (const item of plan.download) {
        if (this.isCancelled) {
          logger.info('sync', 'Sync cancelled by user');
          break;
        }

        try {
          currentOperation++;
          this.emitProgress(currentOperation, totalOperations, 'download', item.noteId, item.noteName);
          this.setSyncStatus(item.noteId, 'syncing');
          await this.downloadNote(item.cloudNote!.id);
          result.downloaded++;
          this.setSyncStatus(item.noteId, 'synced');
        } catch (error) {
          logger.error('sync', `Failed to download note: ${item.noteId}`, error as Error);
          const syncError: SyncErrorInfo = {
            noteId: item.noteId,
            noteName: item.noteName,
            error: (error as Error).message,
            type: 'download'
          };
          result.errors.push(syncError);
          this.setSyncStatus(item.noteId, 'error');
        }
      }

      // Step 8: Handle conflicts
      for (const item of plan.conflicts) {
        this.setSyncStatus(item.noteId, 'conflict');
        const conflict = this.conflictResolver.detectConflict(
          item.localNote!,
          item.cloudNote!
        );
        if (conflict) {
          result.conflicts.push(conflict);
          this.emitConflictDetected(conflict);
        }
      }

      logger.info('sync', 'Sync completed', {
        uploaded: result.uploaded,
        downloaded: result.downloaded,
        conflicts: result.conflicts.length,
        errors: result.errors.length
      });

      return result;
    } catch (error) {
      logger.error('sync', 'Sync failed', error as Error);
      throw error;
    }
  }

  /**
   * Generate sync plan by comparing local and cloud notes
   * Requirements: 4.1, 4.2, 4.3
   * @param localNotes Local notes
   * @param cloudNotes Cloud notes
   * @returns Sync plan
   */
  private generateSyncPlan(localNotes: Note[], cloudNotes: CloudNoteData[]): SyncPlan {
    const plan: SyncPlan = {
      upload: [],
      download: [],
      conflicts: []
    };

    // Create maps for efficient lookup
    const localMap = new Map<string, Note>();
    const cloudMap = new Map<string, CloudNoteData>();

    for (const note of localNotes) {
      localMap.set(note.id, note);
    }

    for (const note of cloudNotes) {
      cloudMap.set(note.id, note);
    }

    // Process local notes
    for (const localNote of localNotes) {
      const cloudNote = cloudMap.get(localNote.id);

      if (!cloudNote) {
        // Local note doesn't exist in cloud - upload
        plan.upload.push({
          noteId: localNote.id,
          noteName: localNote.title,
          action: 'upload',
          localNote
        });
      } else {
        // Note exists in both places - compare timestamps
        if (localNote.updatedAt > cloudNote.updatedAt) {
          // Local is newer - upload
          plan.upload.push({
            noteId: localNote.id,
            noteName: localNote.title,
            action: 'upload',
            localNote,
            cloudNote
          });
        } else if (cloudNote.updatedAt > localNote.updatedAt) {
          // Cloud is newer - download
          plan.download.push({
            noteId: localNote.id,
            noteName: localNote.title,
            action: 'download',
            localNote,
            cloudNote
          });
        } else {
          // Same timestamp - check for conflict
          const conflict = this.conflictResolver.detectConflict(localNote, cloudNote);
          if (conflict) {
            plan.conflicts.push({
              noteId: localNote.id,
              noteName: localNote.title,
              action: 'conflict',
              localNote,
              cloudNote
            });
          }
          // If no conflict, notes are in sync - no action needed
        }
      }
    }

    // Process cloud notes that don't exist locally
    for (const cloudNote of cloudNotes) {
      if (!localMap.has(cloudNote.id)) {
        // Cloud note doesn't exist locally - download
        plan.download.push({
          noteId: cloudNote.id,
          noteName: cloudNote.name,
          action: 'download',
          cloudNote
        });
      }
    }

    return plan;
  }

  /**
   * Sync a single note
   * Requirements: 3.4
   * @param noteId Note ID
   * @returns Sync result
   */
  async syncNote(noteId: string): Promise<NoteSyncResult> {
    logger.info('sync', 'Syncing single note', { noteId });

    try {
      this.setSyncStatus(noteId, 'syncing');

      // Get sync folder
      const syncFolder = this.settingsManager.getSyncFolder();
      if (!syncFolder) {
        throw new Error('Sync folder not configured');
      }

      // Get local note
      const localNote = await this.fileManager.readNote(noteId);

      // Check if note exists in cloud
      const cloudNotes = await this.getCloudNotesData(syncFolder);
      const cloudNote = cloudNotes.find(n => n.id === noteId);

      if (!cloudNote) {
        // Note doesn't exist in cloud - upload
        await this.uploadNote(noteId);
        this.setSyncStatus(noteId, 'synced');
        return { status: 'success', message: 'Note uploaded successfully' };
      }

      // Compare timestamps
      if (localNote.updatedAt > cloudNote.updatedAt) {
        // Local is newer - upload
        await this.uploadNote(noteId);
        this.setSyncStatus(noteId, 'synced');
        return { status: 'success', message: 'Note uploaded successfully' };
      } else if (cloudNote.updatedAt > localNote.updatedAt) {
        // Cloud is newer - download
        await this.downloadNote(cloudNote.driveItemId || cloudNote.id);
        this.setSyncStatus(noteId, 'synced');
        return { status: 'success', message: 'Note downloaded successfully' };
      } else {
        // Same timestamp - check for conflict
        const conflict = this.conflictResolver.detectConflict(localNote, cloudNote);
        if (conflict) {
          this.setSyncStatus(noteId, 'conflict');
          return { status: 'conflict', conflict };
        }

        // No conflict - already in sync
        this.setSyncStatus(noteId, 'synced');
        return { status: 'success', message: 'Note already in sync' };
      }
    } catch (error) {
      logger.error('sync', 'Failed to sync note', error as Error, { noteId });
      this.setSyncStatus(noteId, 'error');
      return {
        status: 'error',
        message: (error as Error).message
      };
    }
  }

  /**
   * Upload a note to cloud
   * Requirements: 4.3, 13.1
   * @param noteId Note ID
   * @returns Upload result
   */
  async uploadNote(noteId: string): Promise<UploadResult> {
    logger.info('sync', 'Uploading note', { noteId });

    try {
      // Get sync folder
      const syncFolder = this.settingsManager.getSyncFolder();
      if (!syncFolder) {
        throw new Error('Sync folder not configured');
      }

      // Read local note
      const note = await this.fileManager.readNote(noteId);

      // Create temporary file with note content
      const tempDir = await import('os').then(os => os.tmpdir());
      const tempFilePath = path.join(tempDir, `${noteId}.note`);
      const noteContent = JSON.stringify(note, null, 2);
      await fs.writeFile(tempFilePath, noteContent, 'utf-8');

      try {
        // Upload to OneDrive
        const remotePath = `${syncFolder}/${noteId}.note`;
        const driveItem = await this.oneDriveClient.uploadFile(tempFilePath, remotePath);

        // Verify file size
        const localSize = Buffer.byteLength(noteContent, 'utf-8');
        if (driveItem.size !== localSize) {
          logger.error('sync', 'File size mismatch after upload', undefined, {
            noteId,
            localSize,
            cloudSize: driveItem.size
          });
          throw new Error('File size verification failed after upload');
        }

        // Update sync metadata
        note.syncMetadata = {
          cloudId: driveItem.id,
          lastSyncAt: Date.now(),
          syncStatus: 'synced'
        };
        await this.fileManager.writeNote(note);

        logger.info('sync', 'Note uploaded successfully', { noteId, cloudId: driveItem.id });

        return {
          success: true,
          cloudId: driveItem.id
        };
      } finally {
        // Clean up temp file
        await fs.unlink(tempFilePath).catch(() => {});
      }
    } catch (error) {
      logger.error('sync', 'Failed to upload note', error as Error, { noteId });
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Download a note from cloud
   * Requirements: 4.2, 13.2, 13.4
   * @param cloudNoteId Cloud note ID
   * @returns Download result
   */
  async downloadNote(cloudNoteId: string): Promise<DownloadResult> {
    logger.info('sync', 'Downloading note', { cloudNoteId });

    let backupPath: string | undefined;

    try {
      // Get sync folder
      const syncFolder = this.settingsManager.getSyncFolder();
      if (!syncFolder) {
        throw new Error('Sync folder not configured');
      }

      // Create temporary download path
      const tempDir = await import('os').then(os => os.tmpdir());
      const tempFilePath = path.join(tempDir, `${cloudNoteId}.note.download`);

      // Download from OneDrive
      await this.oneDriveClient.downloadFile(cloudNoteId, tempFilePath);

      // Validate downloaded file format
      const isValid = await this.fileManager.validateNoteFormat(tempFilePath);
      if (!isValid) {
        await fs.unlink(tempFilePath).catch(() => {});
        throw new Error('Downloaded file has invalid format');
      }

      // Read and parse downloaded note
      const content = await fs.readFile(tempFilePath, 'utf-8');
      const note: Note = JSON.parse(content);

      // Create backup if note already exists locally
      try {
        const existingNote = await this.fileManager.readNote(note.id);
        backupPath = await this.fileManager.createBackup(note.id);
        logger.info('sync', 'Created backup before download', { noteId: note.id, backupPath });
      } catch {
        // Note doesn't exist locally, no backup needed
      }

      try {
        // Update sync metadata
        note.syncMetadata = {
          cloudId: cloudNoteId,
          lastSyncAt: Date.now(),
          syncStatus: 'synced'
        };

        // Write note to local storage
        await this.fileManager.writeNote(note);

        // Delete backup if successful
        if (backupPath) {
          await this.fileManager.deleteBackup(backupPath);
        }

        // Clean up temp file
        await fs.unlink(tempFilePath).catch(() => {});

        logger.info('sync', 'Note downloaded successfully', { cloudNoteId, localId: note.id });

        return {
          success: true,
          localId: note.id
        };
      } catch (error) {
        // Restore from backup if write failed
        if (backupPath) {
          logger.warn('sync', 'Restoring from backup after download failure', undefined, { noteId: note.id });
          await this.fileManager.restoreFromBackup(note.id, backupPath);
          await this.fileManager.deleteBackup(backupPath);
        }
        throw error;
      }
    } catch (error) {
      logger.error('sync', 'Failed to download note', error as Error, { cloudNoteId });
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get cloud notes list
   * Requirements: 8.2, 8.4
   * @returns Cloud notes list
   */
  async getCloudNotes(): Promise<CloudNote[]> {
    logger.info('sync', 'Fetching cloud notes list');

    try {
      const syncFolder = this.settingsManager.getSyncFolder();
      if (!syncFolder) {
        throw new Error('Sync folder not configured');
      }

      // Get cloud notes data
      const cloudNotesData = await this.getCloudNotesData(syncFolder);

      // Get local notes to check existence
      const localNotes = await this.fileManager.getAllNotes();
      const localIds = new Set(localNotes.map(n => n.id));

      // Map to CloudNote format — use driveItemId as id so download API works
      const cloudNotes: CloudNote[] = cloudNotesData.map(note => ({
        id: note.driveItemId || note.id,
        name: note.name,
        updatedAt: note.updatedAt,
        size: note.size || 0,
        existsLocally: localIds.has(note.id),
      }));

      logger.info('sync', 'Cloud notes list fetched', { count: cloudNotes.length });

      return cloudNotes;
    } catch (error) {
      logger.error('sync', 'Failed to fetch cloud notes list', error as Error);
      throw error;
    }
  }

  /**
   * Get cloud notes data from OneDrive
   * @param syncFolder Sync folder path
   * @returns Array of cloud note data
   */
  private async getCloudNotesData(syncFolder: string): Promise<CloudNoteData[]> {
    try {
      // List files in sync folder
      const items = await this.oneDriveClient.listFiles(syncFolder);

      // Filter for .note files
      const noteFiles = items.filter(item => 
        item.file && item.name.endsWith('.note')
      );

      // Map to CloudNoteData
      const cloudNotes: CloudNoteData[] = noteFiles.map(item => {
        // Extract note ID from filename (for sync matching)
        const noteId = item.name.replace('.note', '');
        const updatedAt = new Date(item.lastModifiedDateTime).getTime();

        return {
          id: noteId,
          name: item.name,
          content: '', // Content will be fetched when needed
          updatedAt,
          size: item.size,
          driveItemId: item.id,
        };
      });

      return cloudNotes;
    } catch (error) {
      logger.error('sync', 'Failed to get cloud notes data', error as Error, { syncFolder });
      throw error;
    }
  }

  /**
   * Check if initial sync is needed
   * Requirements: 14.1, 14.6
   * @returns True if initial sync configuration is needed
   */
  async needsInitialSync(): Promise<boolean> {
    logger.info('sync', 'Checking if initial sync is needed');

    try {
      const syncFolder = this.settingsManager.getSyncFolder();
      if (!syncFolder) {
        logger.info('sync', 'No sync folder configured, initial sync not needed');
        return false;
      }

      // Check if this is first time connecting (no sync metadata exists)
      const localNotes = await this.fileManager.getAllNotes();
      const hasLocalNotes = localNotes.length > 0;
      const hasSyncedNotes = localNotes.some(note => note.syncMetadata?.lastSyncAt);

      // If we have synced notes, initial sync is not needed
      if (hasSyncedNotes) {
        logger.info('sync', 'Found synced notes, initial sync not needed');
        return false;
      }

      // Get cloud notes
      const cloudNotes = await this.getCloudNotesData(syncFolder);
      const hasCloudNotes = cloudNotes.length > 0;

      // Initial sync is needed if we have local notes OR cloud notes (but not both synced)
      const needsSync = hasLocalNotes || hasCloudNotes;
      
      logger.info('sync', 'Initial sync check completed', {
        hasLocalNotes,
        hasCloudNotes,
        needsSync
      });

      return needsSync;
    } catch (error) {
      logger.error('sync', 'Failed to check initial sync status', error as Error);
      throw error;
    }
  }

  /**
   * Perform initial sync with specified strategy
   * Requirements: 14.3, 14.4, 14.5
   * @param options Initial sync options
   * @returns Initial sync result
   */
  async performInitialSync(options: InitialSyncOptions): Promise<InitialSyncResult> {
    logger.info('sync', 'Starting initial sync', { strategy: options.strategy });

    const result: InitialSyncResult = {
      uploaded: 0,
      downloaded: 0,
      merged: 0,
      errors: [],
      timestamp: Date.now()
    };

    try {
      const syncFolder = this.settingsManager.getSyncFolder();
      if (!syncFolder) {
        throw new Error('Sync folder not configured');
      }

      // Get local and cloud notes
      const localNotes = await this.fileManager.getAllNotes();
      const cloudNotes = await this.getCloudNotesData(syncFolder);

      logger.info('sync', 'Initial sync data fetched', {
        localCount: localNotes.length,
        cloudCount: cloudNotes.length
      });

      switch (options.strategy) {
        case 'upload_local':
          await this.uploadLocalStrategy(localNotes, result);
          break;
        case 'download_cloud':
          await this.downloadCloudStrategy(cloudNotes, result);
          break;
        case 'smart_merge':
          await this.smartMergeStrategy(localNotes, cloudNotes, result);
          break;
        default:
          throw new Error(`Unknown initial sync strategy: ${options.strategy}`);
      }

      logger.info('sync', 'Initial sync completed', {
        strategy: options.strategy,
        uploaded: result.uploaded,
        downloaded: result.downloaded,
        merged: result.merged,
        errors: result.errors.length
      });

      return result;
    } catch (error) {
      logger.error('sync', 'Initial sync failed', error as Error);
      throw error;
    }
  }

  /**
   * Upload all local notes to cloud
   * Requirements: 14.3
   * @param localNotes Local notes
   * @param result Result object to update
   */
  private async uploadLocalStrategy(
    localNotes: Note[],
    result: InitialSyncResult
  ): Promise<void> {
    logger.info('sync', 'Executing upload local strategy', { count: localNotes.length });

    for (const note of localNotes) {
      try {
        this.setSyncStatus(note.id, 'syncing');
        const uploadResult = await this.uploadNote(note.id);
        
        if (uploadResult.success) {
          result.uploaded++;
          this.setSyncStatus(note.id, 'synced');
        } else {
          throw new Error(uploadResult.error || 'Upload failed');
        }
      } catch (error) {
        logger.error('sync', `Failed to upload note: ${note.id}`, error as Error);
        const syncError: SyncErrorInfo = {
          noteId: note.id,
          noteName: note.title,
          error: (error as Error).message,
          type: 'upload'
        };
        result.errors.push(syncError);
        this.setSyncStatus(note.id, 'error');
      }
    }
  }

  /**
   * Download all cloud notes to local
   * Requirements: 14.4
   * @param cloudNotes Cloud notes
   * @param result Result object to update
   */
  private async downloadCloudStrategy(
    cloudNotes: CloudNoteData[],
    result: InitialSyncResult
  ): Promise<void> {
    logger.info('sync', 'Executing download cloud strategy', { count: cloudNotes.length });

    for (const cloudNote of cloudNotes) {
      try {
        this.setSyncStatus(cloudNote.id, 'syncing');
        const downloadResult = await this.downloadNote(cloudNote.driveItemId || cloudNote.id);
        
        if (downloadResult.success) {
          result.downloaded++;
          this.setSyncStatus(cloudNote.id, 'synced');
        } else {
          throw new Error(downloadResult.error || 'Download failed');
        }
      } catch (error) {
        logger.error('sync', `Failed to download note: ${cloudNote.id}`, error as Error);
        const syncError: SyncErrorInfo = {
          noteId: cloudNote.id,
          noteName: cloudNote.name,
          error: (error as Error).message,
          type: 'download'
        };
        result.errors.push(syncError);
        this.setSyncStatus(cloudNote.id, 'error');
      }
    }
  }

  /**
   * Smart merge based on timestamps
   * Requirements: 14.5
   * @param localNotes Local notes
   * @param cloudNotes Cloud notes
   * @param result Result object to update
   */
  private async smartMergeStrategy(
    localNotes: Note[],
    cloudNotes: CloudNoteData[],
    result: InitialSyncResult
  ): Promise<void> {
    logger.info('sync', 'Executing smart merge strategy', {
      localCount: localNotes.length,
      cloudCount: cloudNotes.length
    });

    // Create maps for efficient lookup
    const localMap = new Map<string, Note>();
    const cloudMap = new Map<string, CloudNoteData>();

    for (const note of localNotes) {
      localMap.set(note.id, note);
    }

    for (const note of cloudNotes) {
      cloudMap.set(note.id, note);
    }

    // Process local notes
    for (const localNote of localNotes) {
      const cloudNote = cloudMap.get(localNote.id);

      if (!cloudNote) {
        // Local note doesn't exist in cloud - upload
        try {
          this.setSyncStatus(localNote.id, 'syncing');
          const uploadResult = await this.uploadNote(localNote.id);
          
          if (uploadResult.success) {
            result.uploaded++;
            result.merged++;
            this.setSyncStatus(localNote.id, 'synced');
          } else {
            throw new Error(uploadResult.error || 'Upload failed');
          }
        } catch (error) {
          logger.error('sync', `Failed to upload note: ${localNote.id}`, error as Error);
          const syncError: SyncErrorInfo = {
            noteId: localNote.id,
            noteName: localNote.title,
            error: (error as Error).message,
            type: 'upload'
          };
          result.errors.push(syncError);
          this.setSyncStatus(localNote.id, 'error');
        }
      } else {
        // Note exists in both places - keep newer version
        if (localNote.updatedAt >= cloudNote.updatedAt) {
          // Local is newer or same - upload
          try {
            this.setSyncStatus(localNote.id, 'syncing');
            const uploadResult = await this.uploadNote(localNote.id);
            
            if (uploadResult.success) {
              result.uploaded++;
              result.merged++;
              this.setSyncStatus(localNote.id, 'synced');
            } else {
              throw new Error(uploadResult.error || 'Upload failed');
            }
          } catch (error) {
            logger.error('sync', `Failed to upload note: ${localNote.id}`, error as Error);
            const syncError: SyncErrorInfo = {
              noteId: localNote.id,
              noteName: localNote.title,
              error: (error as Error).message,
              type: 'upload'
            };
            result.errors.push(syncError);
            this.setSyncStatus(localNote.id, 'error');
          }
        } else {
          // Cloud is newer - download
          try {
            this.setSyncStatus(localNote.id, 'syncing');
            const downloadResult = await this.downloadNote(cloudNote.driveItemId || cloudNote.id);
            
            if (downloadResult.success) {
              result.downloaded++;
              result.merged++;
              this.setSyncStatus(localNote.id, 'synced');
            } else {
              throw new Error(downloadResult.error || 'Download failed');
            }
          } catch (error) {
            logger.error('sync', `Failed to download note: ${cloudNote.id}`, error as Error);
            const syncError: SyncErrorInfo = {
              noteId: cloudNote.id,
              noteName: cloudNote.name,
              error: (error as Error).message,
              type: 'download'
            };
            result.errors.push(syncError);
            this.setSyncStatus(localNote.id, 'error');
          }
        }
      }
    }

    // Process cloud notes that don't exist locally
    for (const cloudNote of cloudNotes) {
      if (!localMap.has(cloudNote.id)) {
        // Cloud note doesn't exist locally - download
        try {
          this.setSyncStatus(cloudNote.id, 'syncing');
          const downloadResult = await this.downloadNote(cloudNote.driveItemId || cloudNote.id);
          
          if (downloadResult.success) {
            result.downloaded++;
            result.merged++;
            this.setSyncStatus(cloudNote.id, 'synced');
          } else {
            throw new Error(downloadResult.error || 'Download failed');
          }
        } catch (error) {
          logger.error('sync', `Failed to download note: ${cloudNote.id}`, error as Error);
          const syncError: SyncErrorInfo = {
            noteId: cloudNote.id,
            noteName: cloudNote.name,
            error: (error as Error).message,
            type: 'download'
          };
          result.errors.push(syncError);
          this.setSyncStatus(cloudNote.id, 'error');
        }
      }
    }
  }

  /**
   * Get sync status for a note
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
   * @param noteId Note ID
   * @returns Sync status
   */
  getSyncStatus(noteId: string): SyncStatus {
    return this.syncStates.get(noteId) || 'not_synced';
  }

  /**
   * Set sync status for a note
   * @param noteId Note ID
   * @param status Sync status
   */
  private setSyncStatus(noteId: string, status: SyncStatus): void {
    this.syncStates.set(noteId, status);
    logger.debug('sync', 'Sync status updated', { noteId, status });
  }

  /**
   * Register progress callback for IPC communication
   * @param callback Progress callback function
   */
  onProgress(callback: (progress: IPCSyncProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Register conflict detection callback for IPC communication
   * @param callback Conflict callback function
   */
  onConflictDetected(callback: (conflict: ConflictInfo) => void): void {
    this.conflictCallback = callback;
  }

  /**
   * Get all detected conflicts
   * @returns Array of conflict information
   */
  getConflicts(): ConflictInfo[] {
    return this.conflicts;
  }

  /**
   * Cancel ongoing sync operation
   */
  async cancelSync(): Promise<void> {
    logger.info('sync', 'Cancelling sync operation');
    this.isCancelled = true;
  }

  /**
   * Emit progress event
   * @param current Current progress
   * @param total Total items
   * @param operation Operation type
   * @param noteId Note ID
   * @param noteName Note name
   */
  private emitProgress(
    current: number,
    total: number,
    operation: 'upload' | 'download',
    noteId: string,
    noteName: string
  ): void {
    if (this.progressCallback) {
      this.progressCallback({
        current,
        total,
        operation,
        noteId,
        noteName
      });
    }
  }

  /**
   * Emit conflict detected event
   * @param conflict Conflict information
   */
  private emitConflictDetected(conflict: ConflictInfo): void {
    this.conflicts.push(conflict);
    if (this.conflictCallback) {
      this.conflictCallback(conflict);
    }
  }

  // ============================================================================
  // Page-Level Sync Methods
  // ============================================================================

  /**
   * Commit a single page to cloud
   * @param noteId Note ID
   * @param pageId Page ID
   * @returns Commit result
   */
  async commitPage(noteId: string, pageId: string): Promise<import('../../src/types/onedrive-sync').CommitResult> {
    logger.info('sync', 'Committing page to cloud', { noteId, pageId });

    try {
      // 1. Read note and page
      const note = await this.fileManager.readNote(noteId);
      const page = note.pages.find(p => p.id === pageId);
      if (!page) {
        throw new Error('Page not found');
      }

      // 2. Check sync configuration
      if (!note.syncConfig?.enabled) {
        throw new Error('Sync not enabled for this note');
      }

      // 3. Calculate content hash
      const contentHash = this.calculateHash(page.content);

      // 4. Check if upload is needed (content unchanged)
      if (page.syncStatus?.contentHash === contentHash && page.syncStatus?.status === 'synced') {
        logger.info('sync', 'Page content unchanged, skipping upload');
        return { success: true, skipped: true };
      }

      // 5. Prepare page data
      const pageData: import('../../src/types/onedrive-sync').PageData = {
        id: page.id,
        title: page.title,
        content: page.content,
        tags: page.tags,
        bookmarks: page.bookmarks,
        createdAt: page.createdAt,
        updatedAt: Date.now()
      };

      // 6. Create temp file
      const os = await import('os');
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `${pageId}.json`);
      await fs.writeFile(tempFilePath, JSON.stringify(pageData, null, 2), 'utf-8');

      try {
        // 7. Upload to OneDrive
        const remotePath = `${note.syncConfig.oneDrivePath}/${noteId}/${pageId}.json`;
        await this.oneDriveClient.uploadFile(tempFilePath, remotePath);

        // 8. Update page sync status
        page.syncStatus = {
          status: 'synced',
          lastSyncAt: Date.now(),
          cloudUpdatedAt: Date.now(),
          contentHash: contentHash
        };
        page.updatedAt = Date.now();

        note.updatedAt = Date.now();
        await this.fileManager.writeNote(note);

        logger.info('sync', 'Page committed successfully', { noteId, pageId });

        return { success: true, skipped: false };
      } finally {
        // Clean up temp file
        await fs.unlink(tempFilePath).catch(() => {});
      }
    } catch (error) {
      logger.error('sync', 'Failed to commit page', error as Error, { noteId, pageId });

      // Update error status
      try {
        const note = await this.fileManager.readNote(noteId);
        const page = note.pages.find(p => p.id === pageId);
        if (page) {
          page.syncStatus = {
            status: 'error',
            error: (error as Error).message
          };
          await this.fileManager.writeNote(note);
        }
      } catch {}

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get cloud pages for a note
   * @param noteId Note ID
   * @returns Array of cloud pages
   */
  async getCloudPages(noteId: string): Promise<import('../../src/types/onedrive-sync').CloudPage[]> {
    logger.info('sync', 'Fetching cloud pages', { noteId });

    try {
      const note = await this.fileManager.readNote(noteId);

      if (!note.syncConfig?.enabled) {
        return [];
      }

      // List files in cloud folder
      const folderPath = `${note.syncConfig.oneDrivePath}/${noteId}`;
      const items = await this.oneDriveClient.listFiles(folderPath);

      // Filter page files
      const pageFiles = items.filter(item =>
        item.file && item.name.endsWith('.json') && item.name !== 'metadata.json'
      );

      // Build cloud pages list
      const cloudPages: import('../../src/types/onedrive-sync').CloudPage[] = [];

      for (const file of pageFiles) {
        const pageId = file.name.replace('.json', '');
        const localPage = note.pages.find(p => p.id === pageId);
        const cloudUpdatedAt = new Date(file.lastModifiedDateTime).getTime();

        cloudPages.push({
          id: pageId,
          name: file.name,
          updatedAt: cloudUpdatedAt,
          size: file.size,
          existsLocally: !!localPage,
          status: this.determinePageStatus(localPage, cloudUpdatedAt)
        });
      }

      logger.info('sync', 'Cloud pages fetched', { noteId, count: cloudPages.length });

      return cloudPages;
    } catch (error) {
      logger.error('sync', 'Failed to fetch cloud pages', error as Error, { noteId });
      throw error;
    }
  }

  /**
   * Determine page sync status
   * @param localPage Local page
   * @param cloudUpdatedAt Cloud updated timestamp
   * @returns Page status
   */
  private determinePageStatus(
    localPage: any | undefined,
    cloudUpdatedAt: number
  ): 'synced' | 'cloud_newer' | 'local_newer' | 'not_synced' {
    if (!localPage) return 'not_synced';

    const localUpdatedAt = localPage.updatedAt;
    const lastSyncAt = localPage.syncStatus?.lastSyncAt || 0;

    if (cloudUpdatedAt > lastSyncAt && cloudUpdatedAt > localUpdatedAt) {
      return 'cloud_newer';
    }

    if (localUpdatedAt > lastSyncAt) {
      return 'local_newer';
    }

    return 'synced';
  }

  /**
   * Use cloud version of a page
   * @param noteId Note ID
   * @param pageId Page ID
   */
  async useCloudVersion(noteId: string, pageId: string): Promise<void> {
    logger.info('sync', 'Using cloud version', { noteId, pageId });

    try {
      const note = await this.fileManager.readNote(noteId);

      if (!note.syncConfig?.enabled) {
        throw new Error('Sync not enabled');
      }

      // 1. Get cloud file
      const folderPath = `${note.syncConfig.oneDrivePath}/${noteId}`;
      const items = await this.oneDriveClient.listFiles(folderPath);
      const pageFile = items.find(item => item.name === `${pageId}.json`);
      
      if (!pageFile) {
        throw new Error('Cloud page not found');
      }

      // 2. Download cloud page
      const os = await import('os');
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `${pageId}.json`);

      await this.oneDriveClient.downloadFile(pageFile.id, tempFilePath);

      // 3. Read cloud page data
      const cloudPageData = JSON.parse(await fs.readFile(tempFilePath, 'utf-8'));
      await fs.unlink(tempFilePath).catch(() => {});

      // 4. Create backup
      const localPage = note.pages.find(p => p.id === pageId);
      if (localPage) {
        await this.fileManager.createBackup(noteId);
      }

      // 5. Update local page
      const pageIndex = note.pages.findIndex(p => p.id === pageId);
      const contentHash = this.calculateHash(cloudPageData.content);

      if (pageIndex >= 0) {
        // Update existing page
        note.pages[pageIndex] = {
          ...cloudPageData,
          syncStatus: {
            status: 'synced',
            lastSyncAt: Date.now(),
            cloudUpdatedAt: cloudPageData.updatedAt,
            contentHash: contentHash
          }
        };
      } else {
        // Add new page
        note.pages.push({
          ...cloudPageData,
          syncStatus: {
            status: 'synced',
            lastSyncAt: Date.now(),
            cloudUpdatedAt: cloudPageData.updatedAt,
            contentHash: contentHash
          }
        });
      }

      note.updatedAt = Date.now();
      await this.fileManager.writeNote(note);

      logger.info('sync', 'Cloud version applied successfully', { noteId, pageId });
    } catch (error) {
      logger.error('sync', 'Failed to use cloud version', error as Error, { noteId, pageId });
      throw error;
    }
  }

  /**
   * Calculate content hash for comparison
   * @param content Content string
   * @returns Hash string
   */
  private calculateHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

// Singleton instance
let syncEngineInstance: SyncEngine | null = null;

/**
 * Get the singleton Sync Engine instance
 */
export function getSyncEngine(): SyncEngine {
  if (!syncEngineInstance) {
    const { getOneDriveClient } = require('./onedrive-client');
    const { getSettingsManager } = require('./settings-manager');
    syncEngineInstance = new SyncEngine(getOneDriveClient(), getSettingsManager());
  }
  return syncEngineInstance;
}

/**
 * File Manager
 * 
 * Manages local note file operations including reading, writing, validation,
 * and backup/restore functionality.
 */

import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Note } from '../../src/types/onedrive-sync';
import { ValidationError } from '../../src/types/onedrive-sync';
import { logger } from '../utils/logger';

export class FileManager {
  private notesPath: string;

  constructor() {
    // Use Documents folder as default notes location
    this.notesPath = app.getPath('documents');
  }

  /**
   * Initialize file manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info('filesystem', 'File Manager initialized', { notesPath: this.notesPath });
    } catch (error) {
      logger.error('filesystem', 'Failed to initialize File Manager', error as Error);
      throw error;
    }
  }

  /**
   * Read note file from disk
   * @param noteId - Note ID (filename without extension)
   * @returns Parsed note data
   * @throws ValidationError if file format is invalid
   */
  async readNote(noteId: string): Promise<Note> {
    try {
      // Construct file path
      const filePath = this.getNoteFilePath(noteId);
      
      logger.info('filesystem', 'Reading note file', { noteId, filePath });

      // Check if file exists
      const exists = await this.fileExists(filePath);
      if (!exists) {
        throw new Error(`Note file not found: ${noteId}`);
      }

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Parse JSON
      let data: any;
      try {
        data = JSON.parse(content);
      } catch (parseError) {
        logger.error('validation', 'Failed to parse note JSON', parseError as Error, { noteId });
        throw new ValidationError('Invalid JSON format in note file');
      }

      // Validate note data format
      const validatedNote = this.validateNoteData(data);
      
      logger.info('filesystem', 'Note file read successfully', { noteId });
      
      return validatedNote;
    } catch (error) {
      logger.error('filesystem', 'Failed to read note', error as Error, { noteId });
      throw error;
    }
  }

  /**
   * Validate note data structure
   * @param data - Raw data to validate
   * @returns Validated Note object
   * @throws ValidationError if data is invalid
   */
  private validateNoteData(data: any): Note {
    // Check if data is an object
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Note data must be an object');
    }

    // Validate required fields
    const requiredFields = ['id', 'title', 'content', 'createdAt', 'updatedAt'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new ValidationError(`Missing required field: ${field}`, field);
      }
    }

    // Validate field types
    if (typeof data.id !== 'string' || !data.id) {
      throw new ValidationError('Invalid id: must be non-empty string', 'id');
    }

    if (typeof data.title !== 'string') {
      throw new ValidationError('Invalid title: must be string', 'title');
    }

    if (typeof data.content !== 'string') {
      throw new ValidationError('Invalid content: must be string', 'content');
    }

    if (typeof data.createdAt !== 'number' || data.createdAt <= 0) {
      throw new ValidationError('Invalid createdAt: must be positive number', 'createdAt');
    }

    if (typeof data.updatedAt !== 'number' || data.updatedAt <= 0) {
      throw new ValidationError('Invalid updatedAt: must be positive number', 'updatedAt');
    }

    // Validate timestamp logic
    if (data.updatedAt < data.createdAt) {
      throw new ValidationError('updatedAt cannot be earlier than createdAt');
    }

    // Validate optional fields
    if (data.tags !== undefined) {
      if (!Array.isArray(data.tags)) {
        throw new ValidationError('Invalid tags: must be array', 'tags');
      }
      
      for (const tag of data.tags) {
        if (typeof tag !== 'string') {
          throw new ValidationError('Invalid tags: all elements must be strings', 'tags');
        }
      }
    }

    if (data.syncMetadata !== undefined) {
      if (typeof data.syncMetadata !== 'object' || data.syncMetadata === null) {
        throw new ValidationError('Invalid syncMetadata: must be object', 'syncMetadata');
      }

      // Validate syncMetadata fields
      if (!data.syncMetadata.cloudId || typeof data.syncMetadata.cloudId !== 'string') {
        throw new ValidationError('Invalid syncMetadata.cloudId: must be non-empty string', 'syncMetadata.cloudId');
      }

      if (typeof data.syncMetadata.lastSyncAt !== 'number' || data.syncMetadata.lastSyncAt <= 0) {
        throw new ValidationError('Invalid syncMetadata.lastSyncAt: must be positive number', 'syncMetadata.lastSyncAt');
      }

      const validStatuses = ['synced', 'not_synced', 'syncing', 'conflict', 'error'];
      if (!validStatuses.includes(data.syncMetadata.syncStatus)) {
        throw new ValidationError('Invalid syncMetadata.syncStatus: must be valid status', 'syncMetadata.syncStatus');
      }
    }

    // Return validated note
    return data as Note;
  }

  /**
   * Write note file to disk atomically
   * @param note - Note data to write
   * @throws Error if write operation fails
   */
  async writeNote(note: Note): Promise<void> {
    try {
      const filePath = this.getNoteFilePath(note.id);
      
      logger.info('filesystem', 'Writing note file', { noteId: note.id, filePath });

      // Serialize note data to JSON with formatting
      const jsonContent = JSON.stringify(note, null, 2);
      
      // Write to temporary file first (atomic write pattern)
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, jsonContent, 'utf-8');
      
      // Verify written content
      const writtenContent = await fs.readFile(tempPath, 'utf-8');
      if (writtenContent !== jsonContent) {
        await fs.unlink(tempPath).catch(() => {}); // Clean up temp file
        throw new Error('File content verification failed');
      }
      
      // Atomically replace the original file
      await fs.rename(tempPath, filePath);
      
      logger.info('filesystem', 'Note file written successfully', { noteId: note.id });
    } catch (error) {
      logger.error('filesystem', 'Failed to write note', error as Error, { noteId: note.id });
      throw error;
    }
  }

  /**
   * Get full file path for a note
   * @param noteId - Note ID
   * @returns Full file path
   */
  private getNoteFilePath(noteId: string): string {
    // Sanitize noteId to prevent path traversal
    const sanitizedId = noteId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.notesPath, `${sanitizedId}.note`);
  }

  /**
   * Get all notes from the notes directory
   * @returns Array of all notes
   */
  async getAllNotes(): Promise<Note[]> {
    try {
      logger.info('filesystem', 'Scanning notes directory', { notesPath: this.notesPath });

      // Read directory contents
      let files: string[];
      try {
        files = await fs.readdir(this.notesPath);
      } catch (error: any) {
        // If directory doesn't exist or can't be read, return empty array
        if (error.code === 'ENOENT' || error.code === 'EACCES') {
          logger.warn('filesystem', 'Notes directory not accessible', undefined, { notesPath: this.notesPath, errorMessage: error.message });
          return [];
        }
        throw error;
      }

      // Filter for .note files
      const noteFiles = files.filter(file => file.endsWith('.note'));
      
      logger.info('filesystem', 'Found note files', { count: noteFiles.length });

      // Read all note files
      const notes: Note[] = [];
      const errors: Array<{ file: string; error: string }> = [];

      for (const file of noteFiles) {
        try {
          // Extract note ID from filename (remove .note extension)
          const noteId = file.slice(0, -5);
          
          // Read and validate note
          const note = await this.readNote(noteId);
          notes.push(note);
        } catch (error) {
          // Log error but continue processing other files
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.warn('filesystem', 'Failed to read note file', undefined, { file, errorMessage });
          errors.push({ file, error: errorMessage });
        }
      }

      if (errors.length > 0) {
        logger.warn('filesystem', 'Some note files could not be read', undefined, { 
          totalFiles: noteFiles.length,
          successCount: notes.length,
          errorCount: errors.length,
          errorDetails: errors 
        });
      }

      logger.info('filesystem', 'Successfully loaded notes', { count: notes.length });

      return notes;
    } catch (error) {
      logger.error('filesystem', 'Failed to get all notes', error as Error);
      throw error;
    }
  }

  /**
   * Check if file exists
   * @param filePath - File path to check
   * @returns True if file exists
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
   * Create a temporary backup of a note file
   * @param noteId - Note ID to backup
   * @returns Path to the backup file
   * @throws Error if backup creation fails
   */
  async createBackup(noteId: string): Promise<string> {
    try {
      const filePath = this.getNoteFilePath(noteId);
      
      logger.info('filesystem', 'Creating backup for note', { noteId, filePath });

      // Check if original file exists
      const exists = await this.fileExists(filePath);
      if (!exists) {
        throw new Error(`Cannot create backup: note file not found: ${noteId}`);
      }

      // Generate backup file path with timestamp
      const timestamp = Date.now();
      const backupPath = `${filePath}.backup.${timestamp}`;

      // Copy file to backup location
      await fs.copyFile(filePath, backupPath);

      // Verify backup was created successfully
      const backupExists = await this.fileExists(backupPath);
      if (!backupExists) {
        throw new Error('Backup file verification failed');
      }

      logger.info('filesystem', 'Backup created successfully', { noteId, backupPath });

      return backupPath;
    } catch (error) {
      logger.error('filesystem', 'Failed to create backup', error as Error, { noteId });
      throw error;
    }
  }

  /**
   * Restore a note from a backup file
   * @param noteId - Note ID to restore
   * @param backupPath - Path to the backup file
   * @throws Error if restore operation fails
   */
  async restoreFromBackup(noteId: string, backupPath: string): Promise<void> {
    try {
      const filePath = this.getNoteFilePath(noteId);
      
      logger.info('filesystem', 'Restoring note from backup', { noteId, backupPath, filePath });

      // Check if backup file exists
      const backupExists = await this.fileExists(backupPath);
      if (!backupExists) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      // Validate backup file format before restoring
      const isValid = await this.validateNoteFormat(backupPath);
      if (!isValid) {
        throw new Error('Backup file has invalid format');
      }

      // Copy backup file to original location
      await fs.copyFile(backupPath, filePath);

      // Verify restore was successful
      const restoredExists = await this.fileExists(filePath);
      if (!restoredExists) {
        throw new Error('Restore verification failed');
      }

      logger.info('filesystem', 'Note restored from backup successfully', { noteId, backupPath });
    } catch (error) {
      logger.error('filesystem', 'Failed to restore from backup', error as Error, { noteId, backupPath });
      throw error;
    }
  }

  /**
   * Delete a temporary backup file
   * @param backupPath - Path to the backup file to delete
   * @throws Error if deletion fails
   */
  async deleteBackup(backupPath: string): Promise<void> {
    try {
      logger.info('filesystem', 'Deleting backup file', { backupPath });

      // Check if backup file exists
      const exists = await this.fileExists(backupPath);
      if (!exists) {
        logger.warn('filesystem', 'Backup file does not exist, skipping deletion', undefined, { backupPath });
        return;
      }

      // Delete the backup file
      await fs.unlink(backupPath);

      // Verify deletion
      const stillExists = await this.fileExists(backupPath);
      if (stillExists) {
        throw new Error('Backup file deletion verification failed');
      }

      logger.info('filesystem', 'Backup file deleted successfully', { backupPath });
    } catch (error) {
      logger.error('filesystem', 'Failed to delete backup', error as Error, { backupPath });
      throw error;
    }
  }

  /**
   * Validate note file format
   * @param filePath - Path to the file to validate
   * @returns True if file format is valid
   */
  async validateNoteFormat(filePath: string): Promise<boolean> {
    try {
      logger.info('validation', 'Validating note file format', { filePath });

      // Check if file exists
      const exists = await this.fileExists(filePath);
      if (!exists) {
        logger.warn('validation', 'File does not exist', undefined, { filePath });
        return false;
      }

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');

      // Try to parse as JSON
      let data: any;
      try {
        data = JSON.parse(content);
      } catch (parseError) {
        logger.warn('validation', 'Invalid JSON format', undefined, { filePath });
        return false;
      }

      // Validate note data structure
      try {
        this.validateNoteData(data);
        logger.info('validation', 'Note file format is valid', { filePath });
        return true;
      } catch (validationError) {
        logger.warn('validation', 'Note data validation failed', undefined, { 
          filePath, 
          error: validationError instanceof Error ? validationError.message : String(validationError)
        });
        return false;
      }
    } catch (error) {
      logger.error('validation', 'Failed to validate note format', error as Error, { filePath });
      return false;
    }
  }
}

// Singleton instance
let fileManagerInstance: FileManager | null = null;

/**
 * Get the singleton File Manager instance
 */
export function getFileManager(): FileManager {
  if (!fileManagerInstance) {
    fileManagerInstance = new FileManager();
  }
  return fileManagerInstance;
}

/**
 * Conflict Resolver
 * 
 * Handles detection and resolution of sync conflicts between local and cloud versions.
 */

import type { 
  Note, 
  CloudNoteData, 
  ConflictInfo, 
  ConflictResolution 
} from '../../src/types/onedrive-sync';
import { logger } from '../utils/logger';
import { getFileManager } from './file-manager';

export class ConflictResolver {
  private fileManager = getFileManager();

  /**
   * Detect if there's a conflict between local and cloud versions
   * @param localNote - Local note version
   * @param cloudNote - Cloud note version
   * @returns ConflictInfo if conflict exists, null otherwise
   */
  detectConflict(localNote: Note, cloudNote: CloudNoteData): ConflictInfo | null {
    try {
      logger.info('conflict', 'Detecting conflict', { 
        noteId: localNote.id,
        localUpdatedAt: localNote.updatedAt,
        cloudUpdatedAt: cloudNote.updatedAt
      });

      // If timestamps are the same, check content
      if (localNote.updatedAt === cloudNote.updatedAt) {
        // Parse cloud content if it's a JSON string
        let cloudContent = cloudNote.content;
        try {
          const parsed = JSON.parse(cloudNote.content);
          cloudContent = parsed.content || cloudNote.content;
        } catch {
          // If not JSON, use as-is
        }

        if (localNote.content === cloudContent) {
          logger.info('conflict', 'No conflict: timestamps and content match', { noteId: localNote.id });
          return null;
        }

        // Same timestamp but different content - rare but possible conflict
        logger.warn('conflict', 'Conflict detected: same timestamp but different content', undefined, {
          noteId: localNote.id,
          localUpdatedAt: localNote.updatedAt,
          cloudUpdatedAt: cloudNote.updatedAt
        });

        return {
          noteId: localNote.id,
          noteName: localNote.title,
          localVersion: localNote,
          cloudVersion: cloudNote,
          localUpdatedAt: localNote.updatedAt,
          cloudUpdatedAt: cloudNote.updatedAt
        };
      }

      // Different timestamps - this is handled by sync engine's timestamp comparison
      // Only report as conflict if both versions were modified independently
      logger.info('conflict', 'No conflict: timestamps differ (handled by sync engine)', { 
        noteId: localNote.id 
      });
      return null;

    } catch (error) {
      logger.error('conflict', 'Error detecting conflict', error as Error, { 
        noteId: localNote.id 
      });
      throw error;
    }
  }

  /**
   * Resolve a conflict based on user's choice
   * @param conflict - Conflict information
   * @param resolution - User's resolution choice
   */
  async resolveConflict(
    conflict: ConflictInfo, 
    resolution: ConflictResolution
  ): Promise<void> {
    try {
      logger.info('conflict', 'Resolving conflict', {
        noteId: conflict.noteId,
        action: resolution.action,
        saveConflictCopy: resolution.saveConflictCopy
      });

      // Create conflict copy if requested
      if (resolution.saveConflictCopy) {
        const versionToSave = resolution.action === 'keep_local' ? 'cloud' : 'local';
        await this.createConflictCopy(
          versionToSave === 'local' ? conflict.localVersion : this.cloudNoteToNote(conflict.cloudVersion),
          versionToSave
        );
      }

      // Execute resolution action
      switch (resolution.action) {
        case 'keep_local':
          // Keep local version - no file operation needed
          // The sync engine will upload this version to cloud
          logger.info('conflict', 'Keeping local version', { noteId: conflict.noteId });
          break;

        case 'use_cloud':
          // Use cloud version - overwrite local file
          logger.info('conflict', 'Using cloud version', { noteId: conflict.noteId });
          const cloudNote = this.cloudNoteToNote(conflict.cloudVersion);
          await this.fileManager.writeNote(cloudNote);
          break;

        case 'create_both':
          // Create copies of both versions
          logger.info('conflict', 'Creating both versions', { noteId: conflict.noteId });
          await this.createConflictCopy(conflict.localVersion, 'local');
          await this.createConflictCopy(this.cloudNoteToNote(conflict.cloudVersion), 'cloud');
          break;

        default:
          throw new Error(`Unknown resolution action: ${resolution.action}`);
      }

      logger.info('conflict', 'Conflict resolved successfully', { 
        noteId: conflict.noteId,
        action: resolution.action
      });

    } catch (error) {
      logger.error('conflict', 'Failed to resolve conflict', error as Error, {
        noteId: conflict.noteId,
        action: resolution.action
      });
      throw error;
    }
  }

  /**
   * Create a conflict copy of a note
   * @param note - Note to create copy of
   * @param version - Version identifier ('local' or 'cloud')
   * @returns ID of the created copy
   */
  async createConflictCopy(note: Note, version: 'local' | 'cloud'): Promise<string> {
    try {
      logger.info('conflict', 'Creating conflict copy', {
        originalNoteId: note.id,
        version
      });

      // Generate new ID for the copy with conflict marker
      const timestamp = Date.now();
      const copyId = `${note.id}_conflict_${version}_${timestamp}`;

      // Create copy with modified title and new ID
      const copyNote: Note = {
        ...note,
        id: copyId,
        title: `${note.title} (Conflict - ${version === 'local' ? 'Local' : 'Cloud'} Copy)`,
        createdAt: timestamp,
        updatedAt: timestamp,
        // Remove sync metadata from copy
        syncMetadata: undefined
      };

      // Write the copy to disk
      await this.fileManager.writeNote(copyNote);

      logger.info('conflict', 'Conflict copy created successfully', {
        originalNoteId: note.id,
        copyId,
        version
      });

      return copyId;

    } catch (error) {
      logger.error('conflict', 'Failed to create conflict copy', error as Error, {
        noteId: note.id,
        version
      });
      throw error;
    }
  }

  /**
   * Convert CloudNoteData to Note format
   * @param cloudNote - Cloud note data
   * @returns Note object
   */
  private cloudNoteToNote(cloudNote: CloudNoteData): Note {
    // Parse content if it's a JSON string containing a full note
    try {
      const parsed = JSON.parse(cloudNote.content);
      if (parsed.id && parsed.title && parsed.content) {
        // It's a full note object
        return {
          id: cloudNote.id,
          title: parsed.title,
          content: parsed.content,
          createdAt: parsed.createdAt || cloudNote.updatedAt,
          updatedAt: cloudNote.updatedAt,
          tags: parsed.tags,
          pages: parsed.pages || [],
          syncMetadata: parsed.syncMetadata
        };
      }
    } catch {
      // Not JSON or not a full note, treat as simple content
    }

    // Create a note from cloud data
    return {
      id: cloudNote.id,
      title: cloudNote.name.replace('.note', ''),
      content: cloudNote.content,
      createdAt: cloudNote.updatedAt,
      updatedAt: cloudNote.updatedAt,
      pages: []
    };
  }
}

// Singleton instance
let conflictResolverInstance: ConflictResolver | null = null;

/**
 * Get the singleton Conflict Resolver instance
 */
export function getConflictResolver(): ConflictResolver {
  if (!conflictResolverInstance) {
    conflictResolverInstance = new ConflictResolver();
  }
  return conflictResolverInstance;
}

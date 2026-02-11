/**
 * Window API Type Declarations
 * 
 * Extends the Window interface with Electron API types.
 */

import type {
  UserInfo,
  SyncOptions,
  SyncResult,
  NoteSyncResult,
  UploadResult,
  DownloadResult,
  SyncStatus,
  CloudNote,
  CloudPage,
  CommitResult,
  FolderItem,
  StorageQuota,
  SyncSettings,
  ConflictInfo,
  ConflictResolution,
  NetworkStatus,
  IPCSyncProgress,
  IPCSyncComplete,
  IPCSyncError,
  IPCNetworkStatusChange,
} from './onedrive-sync';

export interface ElectronAPI {
  // Existing note operations
  saveNote: (noteData: string, defaultName?: string) => Promise<string | null>;
  saveNoteToPath: (filePath: string, noteData: string) => Promise<boolean>;
  openNote: () => Promise<{ filePath: string; content: string } | null>;
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  renameFile: (oldPath: string, newName: string) => Promise<string | null>;
  setWindowTitle: (title: string) => Promise<void>;
  onMenuOpen: (callback: () => void) => void;
  onMenuSave: (callback: () => void) => void;
  onMenuSaveAs: (callback: () => void) => void;
  onOpenFileFromSystem: (callback: (filePath: string) => void) => () => void;
  
  // OneDrive Sync API
  onedrive: {
    // Authentication
    authenticate: () => Promise<UserInfo>;
    disconnect: () => Promise<void>;
    getUserInfo: () => Promise<UserInfo>;
    isAuthenticated: () => Promise<boolean>;
    
    // Sync Operations
    sync: (options?: SyncOptions) => Promise<SyncResult>;
    syncNote: (noteId: string) => Promise<NoteSyncResult>;
    uploadNote: (noteId: string) => Promise<UploadResult>;
    uploadNoteContent: (noteContent: string, noteName: string) => Promise<UploadResult>;
    downloadNote: (cloudNoteId: string) => Promise<DownloadResult>;
    getSyncStatus: (noteId: string) => Promise<SyncStatus>;
    cancelSync: () => Promise<void>;
    
    // Cloud Notes
    getCloudNotes: () => Promise<CloudNote[]>;
    browseFolders: (parentPath?: string) => Promise<FolderItem[]>;
    createFolder: (folderName: string, parentPath?: string) => Promise<FolderItem>;
    getStorageQuota: () => Promise<StorageQuota>;
    
    // Page-Level Sync
    commitPage: (noteId: string, pageId: string) => Promise<CommitResult>;
    getCloudPages: (noteId: string) => Promise<CloudPage[]>;
    useCloudVersion: (noteId: string, pageId: string) => Promise<void>;
    enableNoteSync: (noteId: string, oneDrivePath: string) => Promise<{ success: boolean }>;
    updateNoteSyncSettings: (noteId: string, settings: { autoCommit?: boolean }) => Promise<{ success: boolean }>;
    
    // Settings
    getSyncFolder: () => Promise<string | null>;
    setSyncFolder: (folderPath: string) => Promise<void>;
    getSyncSettings: () => Promise<SyncSettings>;
    updateSyncSettings: (settings: Partial<SyncSettings>) => Promise<void>;
    
    // Conflict Resolution
    resolveConflict: (conflict: ConflictInfo, resolution: ConflictResolution) => Promise<void>;
    getConflictInfo: (noteId: string) => Promise<ConflictInfo | null>;
    
    // Network
    getNetworkStatus: () => Promise<NetworkStatus>;
    isWifi: () => Promise<boolean>;
    
    // Event Listeners
    onSyncProgress: (callback: (data: IPCSyncProgress) => void) => () => void;
    onSyncComplete: (callback: (data: IPCSyncComplete) => void) => () => void;
    onSyncError: (callback: (data: IPCSyncError) => void) => () => void;
    onNetworkStatusChange: (callback: (data: IPCNetworkStatusChange) => void) => () => void;
    onConflictDetected: (callback: (data: ConflictInfo) => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

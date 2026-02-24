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
  RecentNoteItem,
} from './onedrive-sync';

import type {
  BaiduUserInfo,
  BaiduFileItem,
  BaiduQuotaInfo,
  BaiduSyncProgress,
  BaiduSyncComplete,
  BaiduSyncErrorEvent,
} from './baidupan-sync';

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

  // 最近笔记
  recentNotes: {
    get: () => Promise<RecentNoteItem[]>;
    add: (filePath: string, name: string) => Promise<void>;
    remove: (filePath: string) => Promise<void>;
    clear: () => Promise<void>;
  };

  // 新窗口打开笔记
  openNoteInNewWindow: (filePath: string) => Promise<{ success: boolean }>;
  
  // 远程账号管理
  remoteAccounts: {
    getAll: () => Promise<import('./remote-account').RemoteAccountsSettings>;
    create: (params: { provider: string; displayName: string }) => Promise<import('./remote-account').RemoteAccount>;
    delete: (accountId: string) => Promise<void>;
    setDefault: (accountId: string) => Promise<void>;
    isAuthenticated: (accountId: string) => Promise<boolean>;
    authenticate: (accountId: string) => Promise<any>;
    disconnect: (accountId: string) => Promise<void>;
    getUserInfo: (accountId: string) => Promise<any>;
    getQuota: (accountId: string) => Promise<any>;
    getSyncFolder: (accountId: string) => Promise<string | null>;
    setSyncFolder: (accountId: string, folderPath: string) => Promise<void>;
    browseFolders: (accountId: string, parentPath?: string) => Promise<any[]>;
    createFolder: (accountId: string, name: string, parentPath?: string) => Promise<any>;
    getSyncSettings: (accountId: string) => Promise<{ wifiOnly: boolean; saveConflictCopy: boolean }>;
    updateSyncSetting: (accountId: string, key: string, value: boolean) => Promise<void>;
    getCloudNotes: (accountId: string) => Promise<any[]>;
  };
  
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
    uploadNoteContent: (params: { noteContent: string; noteName: string; noteId: string; currentFilePath?: string; cloudSource?: { provider: string; cloudFileId: string | number; cloudPath?: string } }) => Promise<UploadResult>;
    downloadNote: (cloudNoteId: string, localPath?: string) => Promise<DownloadResult>;
    getSyncStatus: (noteId: string) => Promise<SyncStatus>;
    cancelSync: () => Promise<void>;
    
    // Cloud Notes
    getCloudNotes: () => Promise<CloudNote[]>;
    browseFolders: (parentPath?: string) => Promise<FolderItem[]>;
    createFolder: (folderName: string, parentPath?: string) => Promise<FolderItem>;
    getStorageQuota: () => Promise<StorageQuota>;
    deleteNote: (driveItemId: string) => Promise<{ success: boolean }>;
    
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

  // 百度网盘 API
  baidupan: {
    // 认证
    authenticate: () => Promise<BaiduUserInfo>;
    disconnect: () => Promise<void>;
    getUserInfo: () => Promise<BaiduUserInfo>;
    isAuthenticated: () => Promise<boolean>;

    // 网盘信息
    getQuota: () => Promise<BaiduQuotaInfo>;

    // 文件操作
    listFiles: (dir?: string) => Promise<BaiduFileItem[]>;
    createFolder: (folderPath: string) => Promise<{ success: boolean }>;
    deleteFile: (filePaths: string[]) => Promise<{ success: boolean }>;

    // 文件夹浏览
    browseFolders: (parentPath?: string) => Promise<{ name: string; path: string; childCount: number }[]>;
    getSyncFolder: () => Promise<string | null>;
    setSyncFolder: (folderPath: string) => Promise<void>;

    // 设置
    getSyncSettings: () => Promise<{ wifiOnly: boolean; saveConflictCopy: boolean; syncFolder: string | null }>;
    updateSyncSettings: (settings: { wifiOnly?: boolean; saveConflictCopy?: boolean }) => Promise<void>;

    // 同步
    uploadNote: (params: { noteContent: string; noteName: string; noteId: string; currentFilePath?: string; cloudSource?: { provider: string; cloudFileId: string | number; cloudPath?: string } }) => Promise<{ success: boolean; path?: string; cloudId?: string | number; fileName?: string }>;
    getCloudNotes: () => Promise<BaiduFileItem[]>;
    downloadNote: (fsId: number) => Promise<{ success: boolean; content?: string; error?: string }>;

    // 事件监听
    onSyncProgress: (callback: (data: BaiduSyncProgress) => void) => () => void;
    onSyncComplete: (callback: (data: BaiduSyncComplete) => void) => () => void;
    onSyncError: (callback: (data: BaiduSyncErrorEvent) => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

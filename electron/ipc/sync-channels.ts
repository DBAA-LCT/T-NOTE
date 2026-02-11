/**
 * OneDrive Sync IPC Channel Definitions
 * 
 * This file defines all IPC channel names and message types for OneDrive sync.
 */

// ============================================================================
// IPC Channel Names
// ============================================================================

export const IPC_CHANNELS = {
  // Authentication
  AUTH_AUTHENTICATE: 'onedrive:auth:authenticate',
  AUTH_DISCONNECT: 'onedrive:auth:disconnect',
  AUTH_GET_USER_INFO: 'onedrive:auth:getUserInfo',
  AUTH_IS_AUTHENTICATED: 'onedrive:auth:isAuthenticated',
  
  // Sync Operations
  SYNC_EXECUTE: 'onedrive:sync:execute',
  SYNC_NOTE: 'onedrive:sync:syncNote',
  SYNC_UPLOAD_NOTE: 'onedrive:sync:uploadNote',
  SYNC_DOWNLOAD_NOTE: 'onedrive:sync:downloadNote',
  SYNC_GET_STATUS: 'onedrive:sync:getStatus',
  SYNC_CANCEL: 'onedrive:sync:cancel',
  
  // Cloud Notes
  CLOUD_GET_NOTES: 'onedrive:cloud:getNotes',
  CLOUD_BROWSE_FOLDERS: 'onedrive:cloud:browseFolders',
  CLOUD_CREATE_FOLDER: 'onedrive:cloud:createFolder',
  CLOUD_GET_STORAGE_QUOTA: 'onedrive:cloud:getStorageQuota',
  
  // Settings
  SETTINGS_GET_SYNC_FOLDER: 'onedrive:settings:getSyncFolder',
  SETTINGS_SET_SYNC_FOLDER: 'onedrive:settings:setSyncFolder',
  SETTINGS_GET_SYNC_SETTINGS: 'onedrive:settings:getSyncSettings',
  SETTINGS_UPDATE_SYNC_SETTINGS: 'onedrive:settings:updateSyncSettings',
  
  // Conflict Resolution
  CONFLICT_RESOLVE: 'onedrive:conflict:resolve',
  CONFLICT_GET_INFO: 'onedrive:conflict:getInfo',
  
  // Network
  NETWORK_GET_STATUS: 'onedrive:network:getStatus',
  NETWORK_IS_WIFI: 'onedrive:network:isWifi',
  
  // Events (Main -> Renderer)
  EVENT_SYNC_PROGRESS: 'onedrive:event:syncProgress',
  EVENT_SYNC_COMPLETE: 'onedrive:event:syncComplete',
  EVENT_SYNC_ERROR: 'onedrive:event:syncError',
  EVENT_NETWORK_STATUS_CHANGE: 'onedrive:event:networkStatusChange',
  EVENT_CONFLICT_DETECTED: 'onedrive:event:conflictDetected',
} as const;

// ============================================================================
// Type-safe IPC Channel Types
// ============================================================================

export type IPCChannelName = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

// ============================================================================
// IPC Request/Response Type Mapping
// ============================================================================

import type {
  UserInfo,
  SyncOptions,
  SyncResult,
  NoteSyncResult,
  UploadResult,
  DownloadResult,
  SyncStatus,
  CloudNote,
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
} from '../../src/types/onedrive-sync';

export interface IPCRequestMap {
  [IPC_CHANNELS.AUTH_AUTHENTICATE]: void;
  [IPC_CHANNELS.AUTH_DISCONNECT]: void;
  [IPC_CHANNELS.AUTH_GET_USER_INFO]: void;
  [IPC_CHANNELS.AUTH_IS_AUTHENTICATED]: void;
  
  [IPC_CHANNELS.SYNC_EXECUTE]: SyncOptions | undefined;
  [IPC_CHANNELS.SYNC_NOTE]: string; // noteId
  [IPC_CHANNELS.SYNC_UPLOAD_NOTE]: string; // noteId
  [IPC_CHANNELS.SYNC_DOWNLOAD_NOTE]: string; // cloudNoteId
  [IPC_CHANNELS.SYNC_GET_STATUS]: string; // noteId
  [IPC_CHANNELS.SYNC_CANCEL]: void;
  
  [IPC_CHANNELS.CLOUD_GET_NOTES]: void;
  [IPC_CHANNELS.CLOUD_BROWSE_FOLDERS]: string | undefined; // parentPath
  [IPC_CHANNELS.CLOUD_CREATE_FOLDER]: { folderName: string; parentPath?: string };
  [IPC_CHANNELS.CLOUD_GET_STORAGE_QUOTA]: void;
  
  [IPC_CHANNELS.SETTINGS_GET_SYNC_FOLDER]: void;
  [IPC_CHANNELS.SETTINGS_SET_SYNC_FOLDER]: string; // folderPath
  [IPC_CHANNELS.SETTINGS_GET_SYNC_SETTINGS]: void;
  [IPC_CHANNELS.SETTINGS_UPDATE_SYNC_SETTINGS]: Partial<SyncSettings>;
  
  [IPC_CHANNELS.CONFLICT_RESOLVE]: { conflict: ConflictInfo; resolution: ConflictResolution };
  [IPC_CHANNELS.CONFLICT_GET_INFO]: string; // noteId
  
  [IPC_CHANNELS.NETWORK_GET_STATUS]: void;
  [IPC_CHANNELS.NETWORK_IS_WIFI]: void;
}

export interface IPCResponseMap {
  [IPC_CHANNELS.AUTH_AUTHENTICATE]: UserInfo;
  [IPC_CHANNELS.AUTH_DISCONNECT]: void;
  [IPC_CHANNELS.AUTH_GET_USER_INFO]: UserInfo;
  [IPC_CHANNELS.AUTH_IS_AUTHENTICATED]: boolean;
  
  [IPC_CHANNELS.SYNC_EXECUTE]: SyncResult;
  [IPC_CHANNELS.SYNC_NOTE]: NoteSyncResult;
  [IPC_CHANNELS.SYNC_UPLOAD_NOTE]: UploadResult;
  [IPC_CHANNELS.SYNC_DOWNLOAD_NOTE]: DownloadResult;
  [IPC_CHANNELS.SYNC_GET_STATUS]: SyncStatus;
  [IPC_CHANNELS.SYNC_CANCEL]: void;
  
  [IPC_CHANNELS.CLOUD_GET_NOTES]: CloudNote[];
  [IPC_CHANNELS.CLOUD_BROWSE_FOLDERS]: FolderItem[];
  [IPC_CHANNELS.CLOUD_CREATE_FOLDER]: FolderItem;
  [IPC_CHANNELS.CLOUD_GET_STORAGE_QUOTA]: StorageQuota;
  
  [IPC_CHANNELS.SETTINGS_GET_SYNC_FOLDER]: string | null;
  [IPC_CHANNELS.SETTINGS_SET_SYNC_FOLDER]: void;
  [IPC_CHANNELS.SETTINGS_GET_SYNC_SETTINGS]: SyncSettings;
  [IPC_CHANNELS.SETTINGS_UPDATE_SYNC_SETTINGS]: void;
  
  [IPC_CHANNELS.CONFLICT_RESOLVE]: void;
  [IPC_CHANNELS.CONFLICT_GET_INFO]: ConflictInfo | null;
  
  [IPC_CHANNELS.NETWORK_GET_STATUS]: NetworkStatus;
  [IPC_CHANNELS.NETWORK_IS_WIFI]: boolean;
}

export interface IPCEventMap {
  [IPC_CHANNELS.EVENT_SYNC_PROGRESS]: IPCSyncProgress;
  [IPC_CHANNELS.EVENT_SYNC_COMPLETE]: IPCSyncComplete;
  [IPC_CHANNELS.EVENT_SYNC_ERROR]: IPCSyncError;
  [IPC_CHANNELS.EVENT_NETWORK_STATUS_CHANGE]: IPCNetworkStatusChange;
  [IPC_CHANNELS.EVENT_CONFLICT_DETECTED]: ConflictInfo;
}

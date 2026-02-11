/**
 * OneDrive Cloud Sync Type Definitions
 * 
 * This file contains all TypeScript type definitions for the OneDrive sync feature.
 */

// ============================================================================
// User and Authentication Types
// ============================================================================

export interface UserInfo {
  id: string;
  displayName: string;
  email: string;
}

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
}

// ============================================================================
// Note Types
// ============================================================================

export interface Page {
  id: string;
  title: string;
  content: string;
  tags: string[];
  bookmarks?: any[];
  createdAt: number;
  updatedAt: number;
  syncStatus?: {
    status: 'not_synced' | 'synced' | 'pending' | 'syncing' | 'error' | 'cloud_newer' | 'local_newer';
    lastSyncAt?: number;
    cloudUpdatedAt?: number;
    contentHash?: string;
    error?: string;
  };
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  pages: Page[];
  syncMetadata?: SyncMetadata;
  syncConfig?: {
    enabled: boolean;
    autoCommit: boolean;
    oneDrivePath: string;
    lastSyncAt: number;
  };
}

export interface SyncMetadata {
  cloudId: string;
  lastSyncAt: number;
  syncStatus: SyncStatus;
}

export type SyncStatus = 
  | 'synced'        // 已同步
  | 'not_synced'    // 未同步
  | 'syncing'       // 同步中
  | 'conflict'      // 存在冲突
  | 'error';        // 同步错误

// ============================================================================
// Sync Operation Types
// ============================================================================

export interface SyncOptions {
  wifiOnly?: boolean;
  saveConflictCopy?: boolean;
}

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  conflicts: ConflictInfo[];
  errors: SyncErrorInfo[];
  timestamp: number;
}

export interface NoteSyncResult {
  status: 'success' | 'conflict' | 'error';
  message?: string;
  conflict?: ConflictInfo;
}

export interface UploadResult {
  success: boolean;
  cloudId?: string;
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  localId?: string;
  error?: string;
}

export interface SyncErrorInfo {
  noteId: string;
  noteName: string;
  error: string;
  type: 'upload' | 'download';
}

// ============================================================================
// Conflict Types
// ============================================================================

export interface ConflictInfo {
  noteId: string;
  noteName: string;
  localVersion: Note;
  cloudVersion: CloudNoteData;
  localUpdatedAt: number;
  cloudUpdatedAt: number;
}

export interface ConflictResolution {
  action: 'keep_local' | 'use_cloud' | 'create_both';
  saveConflictCopy: boolean;
}

export interface CloudNoteData {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
}

// ============================================================================
// OneDrive API Types
// ============================================================================

export interface DriveItem {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  file?: {
    mimeType: string;
  };
  folder?: {
    childCount: number;
  };
}

export interface FolderItem {
  id: string;
  name: string;
  path: string;
  childCount: number;
}

export interface StorageQuota {
  total: number;
  used: number;
  remaining: number;
}

export interface CloudNote {
  id: string;
  name: string;
  updatedAt: number;
  size: number;
  existsLocally: boolean;
}

// ============================================================================
// Page-Level Sync Types
// ============================================================================

export interface CloudPage {
  id: string;
  name: string;
  updatedAt: number;
  size: number;
  existsLocally: boolean;
  status: 'synced' | 'cloud_newer' | 'local_newer' | 'not_synced';
}

export interface CommitResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

export interface PageData {
  id: string;
  title: string;
  content: string;
  tags: string[];
  bookmarks?: any[];
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Network Types
// ============================================================================

export interface NetworkStatus {
  online: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
}

// ============================================================================
// Settings Types
// ============================================================================

export interface SyncSettings {
  wifiOnly: boolean;
  saveConflictCopy: boolean;
  syncFolder: string | null;
}

export interface AppSettings {
  onedrive: {
    connected: boolean;
    userId: string | null;
    userEmail: string | null;
    syncFolder: string | null;
  };
  sync: {
    wifiOnly: boolean;
    saveConflictCopy: boolean;
  };
}

// ============================================================================
// Sync State Types
// ============================================================================

export interface SyncState {
  noteId: string;
  status: SyncStatus;
  lastSyncAt: number | null;
  cloudId: string | null;
  error: string | null;
}

// ============================================================================
// Initial Sync Types
// ============================================================================

export type InitialSyncStrategy = 'upload_local' | 'download_cloud' | 'smart_merge';

export interface InitialSyncOptions {
  strategy: InitialSyncStrategy;
}

export interface InitialSyncResult {
  uploaded: number;
  downloaded: number;
  merged: number;
  errors: SyncErrorInfo[];
  timestamp: number;
}

// ============================================================================
// IPC Message Types
// ============================================================================

export interface IPCSyncProgress {
  current: number;
  total: number;
  operation: 'upload' | 'download';
  noteId: string;
  noteName: string;
}

export interface IPCSyncComplete {
  result: SyncResult;
}

export interface IPCSyncError {
  error: string;
  noteId?: string;
}

export interface IPCNetworkStatusChange {
  status: NetworkStatus;
}

// ============================================================================
// Error Types
// ============================================================================

export class SyncError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

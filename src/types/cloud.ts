/**
 * 云存储相关类型定义
 */

export type CloudProvider = 'onedrive' | 'baidupan';

export interface CloudFile {
  id: string | number;
  name: string;
  path: string;
  size: number;
  mtime: number;
  isFolder: boolean;
}

export interface CloudQuota {
  used: number;
  total: number;
}

export interface CloudUserInfo {
  id: string | number;
  name: string;
  email?: string;
}

export interface CloudSyncProgress {
  current: number;
  total: number;
  message?: string;
}

export interface CloudSyncResult {
  uploaded: number;
  downloaded: number;
  deleted: number;
  errors: Array<{ path: string; error: string }>;
  conflicts: Array<{ path: string; reason: string }>;
}

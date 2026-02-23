/**
 * 百度网盘同步类型定义
 */

// ============================================================================
// 用户与认证
// ============================================================================

export interface BaiduUserInfo {
  uk: number;
  baiduName: string;
  netdiskName: string;
  avatarUrl: string;
  vipType: number; // 0普通 1会员 2超级会员
}

export interface BaiduTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// ============================================================================
// 文件与网盘
// ============================================================================

export interface BaiduFileItem {
  fsId: number;
  path: string;
  filename: string;
  size: number;
  isdir: number;
  md5?: string;
  serverMtime: number;
  serverCtime: number;
  localMtime: number;
  localCtime: number;
  category: number;
}

export interface BaiduQuotaInfo {
  total: number;
  free: number;
  used: number;
  expire: boolean;
}

// ============================================================================
// 上传相关
// ============================================================================

export interface PrecreateResult {
  errno: number;
  path: string;
  uploadid: string;
  returnType: number;
  blockList: number[];
}

export interface UploadSliceResult {
  md5: string;
  uploadid: string;
  partseq: string;
}

export interface CreateFileResult {
  errno: number;
  fsId: number;
  md5: string;
  path: string;
  size: number;
  ctime: number;
  mtime: number;
  isdir: number;
}

// ============================================================================
// 同步操作
// ============================================================================

export interface BaiduSyncResult {
  uploaded: number;
  downloaded: number;
  errors: BaiduSyncError[];
  timestamp: number;
}

export interface BaiduSyncError {
  noteId?: string;
  noteName?: string;
  error: string;
  code?: number;
}

export interface BaiduSyncSettings {
  syncFolder: string | null; // 百度网盘同步目录，如 /apps/TNote
}

// ============================================================================
// IPC 事件
// ============================================================================

export interface BaiduSyncProgress {
  phase: string;
  current: number;
  total: number;
  fileName?: string;
}

export interface BaiduSyncComplete {
  result: BaiduSyncResult;
}

export interface BaiduSyncErrorEvent {
  error: string;
  code?: number;
}

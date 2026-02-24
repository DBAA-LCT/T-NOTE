/**
 * 远程账号类型定义
 * 支持多账号管理
 */

export type RemoteProvider = 'onedrive' | 'baidupan';

export interface RemoteAccount {
  /** 账号唯一标识 */
  id: string;
  /** 云盘类型 */
  provider: RemoteProvider;
  /** 账号显示名称（用户自定义） */
  displayName: string;
  /** 用户信息 */
  userInfo?: {
    userId: string;
    email?: string;
    name?: string;
  };
  /** 同步文件夹路径 */
  syncFolder: string | null;
  /** 是否已连接 */
  connected: boolean;
  /** 同步设置 */
  syncSettings: {
    wifiOnly: boolean;
    saveConflictCopy: boolean;
  };
  /** 创建时间 */
  createdAt: number;
  /** 最后使用时间 */
  lastUsedAt: number;
}

export interface RemoteAccountsSettings {
  /** 所有远程账号 */
  accounts: RemoteAccount[];
  /** 默认账号 ID（用于快速上传等操作） */
  defaultAccountId: string | null;
}

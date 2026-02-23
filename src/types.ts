/**
 * 主类型定义文件
 * 重新导出所有类型以保持向后兼容
 */

export * from './types/note';
export * from './types/cloud';

// 保留旧的导出以兼容现有代码
export type { Note, Page, TodoItem, Bookmark, DeletedItem, CloudSource } from './types/note';
export type { CloudProvider, CloudFile, CloudQuota, CloudUserInfo, CloudSyncProgress, CloudSyncResult } from './types/cloud';

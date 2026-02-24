/**
 * 笔记相关类型定义
 */

export interface Note {
  id: string;
  name: string;
  pages: Page[];
  todos?: TodoItem[];
  trash?: DeletedItem[];
  createdAt: number;
  updatedAt: number;
  
  // 笔记级同步配置
  syncConfig?: {
    enabled: boolean;
    autoCommit: boolean;
    oneDrivePath: string;
    lastSyncAt: number;
  };

  // 云端来源信息
  cloudSource?: CloudSource;
}

export interface Page {
  id: string;
  title: string;
  content: string;
  tags: string[];
  bookmarks?: Bookmark[];
  longCodeBlocks?: Record<string, { content: string; language: string; title: string }>; // 长代码块存储
  markerPosition?: number;
  scrollPosition?: number;
  createdAt: number;
  updatedAt: number;
  
  // 页面级同步状态
  syncStatus?: {
    status: 'not_synced' | 'synced' | 'pending' | 'syncing' | 'error' | 'cloud_newer' | 'local_newer';
    lastSyncAt?: number;
    cloudUpdatedAt?: number;
    contentHash?: string;
    error?: string;
  };
}

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  dueDate?: number;
  linkedPageId?: string;
  linkedPosition?: number;
  linkedLength?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Bookmark {
  id: string;
  name: string;
  position: number;
  length: number;
  note?: string;
  createdAt: number;
}

export interface DeletedItem {
  id: string;
  type: 'page' | 'bookmark' | 'todo';
  data: Page | Bookmark | TodoItem;
  pageId?: string;
  deletedAt: number;
}

export interface CloudSource {
  provider: 'onedrive' | 'baidupan';
  cloudFileId: string | number;
  cloudPath?: string;
  cloudMtime: number;
  lastSyncedAt: number;
}

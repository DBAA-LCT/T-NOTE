export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  dueDate?: number;
  linkedPageId?: string; // 关联的页面ID
  linkedPosition?: number; // 关联的位置
  linkedLength?: number; // 关联的长度
  createdAt: number;
  updatedAt: number;
}

export interface Bookmark {
  id: string;
  name: string;
  position: number; // 起始位置
  length: number; // 选中的长度
  note?: string; // 书签标注内容
  createdAt: number;
}

export interface Page {
  id: string;
  title: string;
  content: string;
  tags: string[];
  bookmarks?: Bookmark[]; // 书签列表
  markerPosition?: number; // 定位器位置（每页只有一个）
  scrollPosition?: number; // 滚动位置
  createdAt: number;
  updatedAt: number;
  
  // 页面级同步状态
  syncStatus?: {
    status: 'not_synced' | 'synced' | 'pending' | 'syncing' | 'error' | 'cloud_newer' | 'local_newer';
    lastSyncAt?: number;        // 最后同步时间
    cloudUpdatedAt?: number;    // 云端更新时间
    contentHash?: string;       // 内容哈希，用于快速比较
    error?: string;             // 错误信息
  };
}

export interface DeletedItem {
  id: string;
  type: 'page' | 'bookmark' | 'todo';
  data: Page | Bookmark | TodoItem;
  pageId?: string; // 如果是书签，记录所属页面ID
  deletedAt: number;
}

export interface Note {
  id: string;
  name: string;
  pages: Page[];
  todos?: TodoItem[]; // TODO列表
  trash?: DeletedItem[]; // 回收站
  createdAt: number;
  updatedAt: number;
  
  // 笔记级同步配置
  syncConfig?: {
    enabled: boolean;           // 是否启用同步
    autoCommit: boolean;        // 是否自动提交（默认false）
    oneDrivePath: string;       // OneDrive路径
    lastSyncAt: number;         // 最后同步时间
  };

  // 云端来源信息（轻量同步标记）
  cloudSource?: {
    provider: 'onedrive' | 'baidupan';
    /** 云端文件标识：OneDrive 的 driveItemId 或百度网盘的 fsId */
    cloudFileId: string | number;
    /** 云端文件路径 */
    cloudPath?: string;
    /** 上次同步时云端文件的修改时间 */
    cloudMtime: number;
    /** 上次同步的本地时间 */
    lastSyncedAt: number;
  };
}

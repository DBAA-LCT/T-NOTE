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
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  name: string;
  pages: Page[];
  createdAt: number;
  updatedAt: number;
}

declare global {
  interface Window {
    electronAPI: {
      saveNote: (noteData: string) => Promise<string | null>;
      saveNoteToPath: (filePath: string, noteData: string) => Promise<boolean>;
      openNote: () => Promise<{ filePath: string; content: string } | null>;
      onMenuOpen: (callback: () => void) => void;
      onMenuSave: (callback: () => void) => void;
      onMenuSaveAs: (callback: () => void) => void;
    };
  }
}

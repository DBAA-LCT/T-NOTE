export interface Page {
  id: string;
  title: string;
  content: string;
  tags: string[];
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
    };
  }
}

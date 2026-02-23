/**
 * 笔记管理 Hook
 * 
 * 封装笔记的增删改查逻辑
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Note, Page } from '../types/note';

export interface UseNoteManagerReturn {
  note: Note | null;
  currentPageId: string | null;
  currentFilePath: string | null;
  hasUnsavedChanges: boolean;
  setNote: (note: Note | null) => void;
  setCurrentPageId: (id: string | null) => void;
  setCurrentFilePath: (path: string | null) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  addPage: (page: Page) => void;
  updatePage: (pageId: string, updates: Partial<Page>) => void;
  deletePage: (pageId: string) => void;
  getCurrentPage: () => Page | null;
  saveNote: () => Promise<void>;
}

export function useNoteManager(): UseNoteManagerReturn {
  const [note, setNote] = useState<Note | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const noteRef = useRef(note);
  const currentFilePathRef = useRef(currentFilePath);

  useEffect(() => {
    noteRef.current = note;
    currentFilePathRef.current = currentFilePath;
  }, [note, currentFilePath]);

  const addPage = useCallback((page: Page) => {
    setNote((prev) => {
      if (!prev) return null;
      return { ...prev, pages: [...prev.pages, page] };
    });
    setHasUnsavedChanges(true);
  }, []);

  const updatePage = useCallback((pageId: string, updates: Partial<Page>) => {
    setNote((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.map((p) =>
          p.id === pageId ? { ...p, ...updates, updatedAt: Date.now() } : p
        ),
      };
    });
    setHasUnsavedChanges(true);
  }, []);

  const deletePage = useCallback((pageId: string) => {
    setNote((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.filter((p) => p.id !== pageId),
      };
    });
    setHasUnsavedChanges(true);
  }, []);

  const getCurrentPage = useCallback((): Page | null => {
    if (!note || !currentPageId) return null;
    return note.pages.find((p) => p.id === currentPageId) || null;
  }, [note, currentPageId]);

  const saveNote = useCallback(async () => {
    if (!noteRef.current || !currentFilePathRef.current) {
      throw new Error('没有可保存的笔记');
    }

    await window.electronAPI.saveNote(
      currentFilePathRef.current,
      noteRef.current
    );
    setHasUnsavedChanges(false);
  }, []);

  return {
    note,
    currentPageId,
    currentFilePath,
    hasUnsavedChanges,
    setNote,
    setCurrentPageId,
    setCurrentFilePath,
    setHasUnsavedChanges,
    addPage,
    updatePage,
    deletePage,
    getCurrentPage,
    saveNote,
  };
}

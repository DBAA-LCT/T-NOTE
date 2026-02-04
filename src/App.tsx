import { useState, useEffect } from 'react';
import { Note, Page } from './types';
import Editor from './components/Editor';
import Sidebar from './components/Sidebar';
import './App.css';

function App() {
  const [note, setNote] = useState<Note>({
    id: crypto.randomUUID(),
    name: '新笔记',
    pages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [searchTag, setSearchTag] = useState<string>('');
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);

  const currentPage = note.pages.find(p => p.id === currentPageId);

  // Ctrl+S 快捷键保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveNote();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [note, currentFilePath]);

  const addPage = () => {
    const newPage: Page = {
      id: crypto.randomUUID(),
      title: '新页面',
      content: '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setNote(prev => ({
      ...prev,
      pages: [...prev.pages, newPage],
      updatedAt: Date.now()
    }));
    setCurrentPageId(newPage.id);
  };

  const updatePage = (pageId: string, updates: Partial<Page>) => {
    setNote(prev => ({
      ...prev,
      pages: prev.pages.map(p => 
        p.id === pageId ? { ...p, ...updates, updatedAt: Date.now() } : p
      ),
      updatedAt: Date.now()
    }));
  };

  const deletePage = (pageId: string) => {
    setNote(prev => ({
      ...prev,
      pages: prev.pages.filter(p => p.id !== pageId),
      updatedAt: Date.now()
    }));
    if (currentPageId === pageId) setCurrentPageId(null);
  };

  const saveNote = async () => {
    if (currentFilePath) {
      // 如果有当前文件路径，直接保存
      await window.electronAPI.saveNoteToPath(currentFilePath, JSON.stringify(note, null, 2));
      alert('保存成功！');
    } else {
      // 如果没有路径，执行另存为
      saveAsNote();
    }
  };

  const saveAsNote = async () => {
    const filePath = await window.electronAPI.saveNote(JSON.stringify(note, null, 2));
    if (filePath) {
      setCurrentFilePath(filePath);
      alert('保存成功！');
    }
  };

  const openNote = async () => {
    const result = await window.electronAPI.openNote();
    if (result) {
      const loadedNote = JSON.parse(result.content);
      setNote(loadedNote);
      setCurrentPageId(loadedNote.pages[0]?.id || null);
      setCurrentFilePath(result.filePath);
    }
  };

  const filteredPages = searchTag
    ? note.pages.filter(p => p.tags.some(t => t.includes(searchTag)))
    : note.pages;

  return (
    <div className="app">
      <Sidebar
        pages={filteredPages}
        currentPageId={currentPageId}
        onSelectPage={setCurrentPageId}
        onAddPage={addPage}
        onDeletePage={deletePage}
        onSave={saveNote}
        onSaveAs={saveAsNote}
        onOpen={openNote}
        searchTag={searchTag}
        onSearchTagChange={setSearchTag}
      />
      <Editor
        page={currentPage}
        onUpdatePage={(updates) => currentPage && updatePage(currentPage.id, updates)}
      />
    </div>
  );
}

export default App;

import { useState, useEffect, useRef } from 'react';
import { Layout, message } from 'antd';
import { Note, Page } from './types';
import Editor, { EditorRef } from './components/Editor';
import IconBar, { IconBarTab } from './components/IconBar';
import PagesPanel from './components/PagesPanel';
import SearchPanel from './components/SearchPanel';
import TodoPanel from './components/TodoPanel';
import BookmarkPanel from './components/BookmarkPanel';
import TopBar from './components/TopBar';
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
  const [activeTab, setActiveTab] = useState<IconBarTab>('pages');
  const editorRef = useRef<EditorRef>(null);

  const currentPage = note.pages.find(p => p.id === currentPageId);

  // Ctrl+S 快捷键保存和菜单栏事件监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveNote();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // 监听菜单栏事件（仅在 Electron 环境中）
    if (window.electronAPI) {
      window.electronAPI.onMenuOpen(openNote);
      window.electronAPI.onMenuSave(saveNote);
      window.electronAPI.onMenuSaveAs(saveAsNote);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
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

  const deleteBookmark = (pageId: string, bookmarkId: string) => {
    setNote(prev => ({
      ...prev,
      pages: prev.pages.map(p => 
        p.id === pageId 
          ? { ...p, bookmarks: p.bookmarks?.filter(b => b.id !== bookmarkId), updatedAt: Date.now() }
          : p
      ),
      updatedAt: Date.now()
    }));
    message.success('书签已删除');
  };

  const updateBookmark = (pageId: string, bookmarkId: string, updates: Partial<any>) => {
    setNote(prev => ({
      ...prev,
      pages: prev.pages.map(p => 
        p.id === pageId 
          ? { 
              ...p, 
              bookmarks: p.bookmarks?.map(b => 
                b.id === bookmarkId ? { ...b, ...updates } : b
              ),
              updatedAt: Date.now() 
            }
          : p
      ),
      updatedAt: Date.now()
    }));
  };

  const jumpToBookmark = (pageId: string, position: number, length: number) => {
    // 查找书签ID
    const page = note.pages.find(p => p.id === pageId);
    if (!page) return;
    
    const bookmark = page.bookmarks?.find(b => b.position === position && b.length === length);
    if (!bookmark) return;

    // 如果需要切换页面，先切换
    if (currentPageId !== pageId) {
      setCurrentPageId(pageId);
      // 等待页面切换完成后再跳转
      setTimeout(() => {
        editorRef.current?.jumpToBookmark(bookmark.id);
      }, 200);
    } else {
      // 同一页面直接跳转
      editorRef.current?.jumpToBookmark(bookmark.id);
    }
  };

  const saveNote = async () => {
    if (currentFilePath) {
      // 如果有当前文件路径，直接保存
      await window.electronAPI.saveNoteToPath(currentFilePath, JSON.stringify(note, null, 2));
      message.success('保存成功！');
    } else {
      // 如果没有路径，执行另存为
      saveAsNote();
    }
  };

  const saveAsNote = async () => {
    const filePath = await window.electronAPI.saveNote(JSON.stringify(note, null, 2));
    if (filePath) {
      setCurrentFilePath(filePath);
      message.success('保存成功！');
    }
  };

  const openNote = async () => {
    const result = await window.electronAPI.openNote();
    if (result) {
      const loadedNote = JSON.parse(result.content);
      setNote(loadedNote);
      setCurrentPageId(loadedNote.pages[0]?.id || null);
      setCurrentFilePath(result.filePath);
      message.success('笔记已打开！');
    }
  };

  const renderSidePanel = () => {
    switch (activeTab) {
      case 'pages':
        return (
          <PagesPanel
            pages={note.pages}
            currentPageId={currentPageId}
            onSelectPage={setCurrentPageId}
            onAddPage={addPage}
            onDeletePage={deletePage}
          />
        );
      case 'search':
        return (
          <SearchPanel
            pages={note.pages}
            currentPageId={currentPageId}
            onSelectPage={setCurrentPageId}
            searchTag={searchTag}
            onSearchTagChange={setSearchTag}
          />
        );
      case 'todo':
        return <TodoPanel />;
      case 'bookmarks':
        return (
          <BookmarkPanel
            pages={note.pages}
            currentPageId={currentPageId}
            onSelectPage={setCurrentPageId}
            onJumpToBookmark={jumpToBookmark}
            onDeleteBookmark={deleteBookmark}
            onUpdateBookmark={updateBookmark}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Layout className="app">
      <IconBar activeTab={activeTab} onTabChange={setActiveTab} />
      
      {activeTab && renderSidePanel()}
      
      <Layout style={{ display: 'flex', flexDirection: 'column' }}>
        <TopBar
          noteName={note.name}
          onSave={saveNote}
          onSaveAs={saveAsNote}
          onOpen={openNote}
        />
        <Editor
          ref={editorRef}
          page={currentPage}
          onUpdatePage={(updates) => currentPage && updatePage(currentPage.id, updates)}
        />
      </Layout>
    </Layout>
  );
}

export default App;

import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [note, setNote] = useState<Note | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [searchTag, setSearchTag] = useState<string>('');
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<IconBarTab>(null);
  const editorRef = useRef<EditorRef>(null);

  // 使用 ref 来保存最新的 note 和 currentFilePath
  const noteRef = useRef(note);
  const currentFilePathRef = useRef(currentFilePath);

  useEffect(() => {
    noteRef.current = note;
    currentFilePathRef.current = currentFilePath;
  }, [note, currentFilePath]);

  const currentPage = note?.pages.find(p => p.id === currentPageId);

  const saveNote = useCallback(async () => {
    const currentNote = noteRef.current;
    const currentPath = currentFilePathRef.current;
    
    if (!currentNote) return;
    if (currentPath) {
      // 如果有当前文件路径，直接保存
      await window.electronAPI.saveNoteToPath(currentPath, JSON.stringify(currentNote, null, 2));
      message.success('保存成功！');
    } else {
      // 如果没有路径，执行另存为，使用笔记名作为默认文件名
      const filePath = await window.electronAPI.saveNote(JSON.stringify(currentNote, null, 2), currentNote.name);
      if (filePath) {
        setCurrentFilePath(filePath);
        message.success('保存成功！');
      }
    }
  }, []);

  const saveAsNote = useCallback(async () => {
    const currentNote = noteRef.current;
    if (!currentNote) return;
    const filePath = await window.electronAPI.saveNote(JSON.stringify(currentNote, null, 2), currentNote.name);
    if (filePath) {
      setCurrentFilePath(filePath);
      message.success('保存成功！');
    }
  }, []);

  const openNote = useCallback(async () => {
    const result = await window.electronAPI.openNote();
    if (result) {
      const loadedNote = JSON.parse(result.content);
      setNote(loadedNote);
      setCurrentPageId(loadedNote.pages[0]?.id || null);
      setCurrentFilePath(result.filePath);
      message.success('笔记已打开！');
    }
  }, []);

  // Ctrl+S 快捷键保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveNote();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveNote]);

  // 菜单栏事件监听 - 只在组件挂载时注册一次
  useEffect(() => {
    if (!window.electronAPI) return;

    const removeMenuOpen = window.electronAPI.onMenuOpen(openNote);
    const removeMenuSave = window.electronAPI.onMenuSave(saveNote);
    const removeMenuSaveAs = window.electronAPI.onMenuSaveAs(saveAsNote);

    return () => {
      removeMenuOpen();
      removeMenuSave();
      removeMenuSaveAs();
    };
  }, [openNote, saveNote, saveAsNote]);

  const addPage = () => {
    if (!note) return;
    const newPage: Page = {
      id: crypto.randomUUID(),
      title: '新页面',
      content: '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setNote(prev => prev ? ({
      ...prev,
      pages: [...prev.pages, newPage],
      updatedAt: Date.now()
    }) : null);
    setCurrentPageId(newPage.id);
  };

  const updatePage = (pageId: string, updates: Partial<Page>) => {
    if (!note) return;
    setNote(prev => prev ? ({
      ...prev,
      pages: prev.pages.map(p => 
        p.id === pageId ? { ...p, ...updates, updatedAt: Date.now() } : p
      ),
      updatedAt: Date.now()
    }) : null);
  };

  const deletePage = (pageId: string) => {
    if (!note) return;
    setNote(prev => prev ? ({
      ...prev,
      pages: prev.pages.filter(p => p.id !== pageId),
      updatedAt: Date.now()
    }) : null);
    if (currentPageId === pageId) setCurrentPageId(null);
  };

  const deleteBookmark = (pageId: string, bookmarkId: string) => {
    if (!note) return;
    setNote(prev => prev ? ({
      ...prev,
      pages: prev.pages.map(p => 
        p.id === pageId 
          ? { ...p, bookmarks: p.bookmarks?.filter(b => b.id !== bookmarkId), updatedAt: Date.now() }
          : p
      ),
      updatedAt: Date.now()
    }) : null);
    message.success('书签已删除');
  };

  const updateBookmark = (pageId: string, bookmarkId: string, updates: Partial<any>) => {
    if (!note) return;
    setNote(prev => prev ? ({
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
    }) : null);
  };

  const jumpToBookmark = (pageId: string, position: number, length: number) => {
    if (!note) return;
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

  const createNewNote = () => {
    // 直接创建一个新的空笔记
    const newNote: Note = {
      id: crypto.randomUUID(),
      name: '新建笔记',
      pages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    setNote(newNote);
    setCurrentPageId(null);
    setCurrentFilePath(null); // 清空文件路径，保存时会提示选择位置
    message.success('已创建新笔记！');
  };

  const updateNoteName = (name: string) => {
    if (!note) return;
    setNote(prev => prev ? ({
      ...prev,
      name,
      updatedAt: Date.now()
    }) : null);
  };

  const renderSidePanel = () => {
    if (!note) return null;
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
    <Layout className="app" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar
        noteName={note?.name || '新建笔记'}
        hasNote={note !== null}
        onSave={saveNote}
        onSaveAs={saveAsNote}
        onOpen={openNote}
        onCreateNew={createNewNote}
        onUpdateNoteName={updateNoteName}
      />
      
      <Layout style={{ flex: 1, overflow: 'hidden' }}>
        <IconBar activeTab={activeTab} onTabChange={setActiveTab} />
        
        {activeTab && renderSidePanel()}
        
        <Layout style={{ display: 'flex', flexDirection: 'column' }}>
          <Editor
            key={currentPage?.id || 'no-page'}
            ref={editorRef}
            page={currentPage}
            onUpdatePage={(updates) => currentPage && updatePage(currentPage.id, updates)}
          />
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;

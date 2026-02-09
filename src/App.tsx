import { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, message } from 'antd';
import { Note, Page, TodoItem } from './types';
import Editor, { EditorRef } from './components/Editor';
import ReadOnlyEditor from './components/ReadOnlyEditor';
import IconBar, { IconBarTab } from './components/IconBar';
import PagesPanel from './components/PagesPanel';
import SearchPanel from './components/SearchPanel';
import TodoPanel from './components/TodoPanel';
import BookmarkPanel from './components/BookmarkPanel';
import TrashPanel from './components/TrashPanel';
import TopBar from './components/TopBar';
import PageTabs from './components/PageTabs';
import './App.css';

function App() {
  const [note, setNote] = useState<Note | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [searchTag, setSearchTag] = useState<string>('');
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<IconBarTab>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(280);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const editorRef = useRef<EditorRef>(null);
  
  // Tab栏和分屏相关状态
  const MAX_TABS = 5; // 最大Tab数量
  const [leftTabs, setLeftTabs] = useState<string[]>([]); // 左侧Tab列表
  const [rightTabs, setRightTabs] = useState<string[]>([]); // 右侧Tab列表
  const [activeLeftTab, setActiveLeftTab] = useState<string | null>(null); // 左侧激活的Tab
  const [activeRightTab, setActiveRightTab] = useState<string | null>(null); // 右侧激活的Tab
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('left'); // 当前激活的编辑器侧
  const leftEditorRef = useRef<EditorRef>(null);
  const rightEditorRef = useRef<EditorRef>(null);

  // 使用 ref 来保存最新的 note 和 currentFilePath
  const noteRef = useRef(note);
  const currentFilePathRef = useRef(currentFilePath);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    noteRef.current = note;
    currentFilePathRef.current = currentFilePath;
  }, [note, currentFilePath]);

  // 更新窗口标题
  useEffect(() => {
    if (note && window.electronAPI) {
      const title = `${note.name} - T-Note${hasUnsavedChanges ? ' *' : ''}`;
      window.electronAPI.setWindowTitle(title);
    } else if (window.electronAPI) {
      window.electronAPI.setWindowTitle('T-Note');
    }
  }, [note?.name, hasUnsavedChanges]);

  // 性能监控（仅开发环境）
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const logMemory = () => {
        if ((performance as any).memory) {
          const memory = (performance as any).memory;
          console.log('📊 内存使用情况:', {
            已使用: (memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
            总计: (memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
            限制: (memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB',
            使用率: ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(2) + '%'
          });
        }
      };

      // 立即记录一次
      logMemory();
      
      // 每30秒记录一次
      const interval = setInterval(logMemory, 30000);
      
      return () => clearInterval(interval);
    }
  }, []);

  // 自动保存功能 - 优化版
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    // 清除之前的定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // 创建新的定时器
    autoSaveTimerRef.current = setTimeout(async () => {
      const currentNote = noteRef.current;
      const currentPath = currentFilePathRef.current;
      
      if (!currentNote || !currentPath) return;
      
      try {
        await window.electronAPI.saveNoteToPath(currentPath, JSON.stringify(currentNote, null, 2));
        setHasUnsavedChanges(false);
        console.log('自动保存成功');
      } catch (error) {
        console.error('自动保存失败:', error);
        message.error('自动保存失败');
      }
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges]); // 只依赖 hasUnsavedChanges

  // 侧边栏宽度调整
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX - 50; // 减去 IconBar 的宽度
      if (newWidth >= 200 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const currentPage = note?.pages.find(p => p.id === currentPageId);
  
  // 判断是否显示分屏
  const showSplit = leftTabs.length > 0 && rightTabs.length > 0;
  
  // 获取当前激活的页面
  const activeLeftPage = note?.pages.find(p => p.id === activeLeftTab);
  const activeRightPage = note?.pages.find(p => p.id === activeRightTab);

  const saveNote = useCallback(async () => {
    const currentNote = noteRef.current;
    const currentPath = currentFilePathRef.current;
    
    if (!currentNote) return;
    if (currentPath) {
      // 如果有当前文件路径，直接保存
      await window.electronAPI.saveNoteToPath(currentPath, JSON.stringify(currentNote, null, 2));
      setHasUnsavedChanges(false);
      message.success('保存成功！');
    } else {
      // 如果没有路径，执行另存为，使用笔记名作为默认文件名
      const filePath = await window.electronAPI.saveNote(JSON.stringify(currentNote, null, 2), currentNote.name);
      if (filePath) {
        setCurrentFilePath(filePath);
        setHasUnsavedChanges(false);
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
      setHasUnsavedChanges(false);
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
      setHasUnsavedChanges(false);
      // 打开文件后默认展开页面列表
      setActiveTab('pages');
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
      if (removeMenuOpen) removeMenuOpen();
      if (removeMenuSave) removeMenuSave();
      if (removeMenuSaveAs) removeMenuSaveAs();
    };
  }, [openNote, saveNote, saveAsNote]);

  // 监听系统打开文件事件（双击.note文件）
  useEffect(() => {
    if (!window.electronAPI?.onOpenFileFromSystem) return;

    const removeListener = window.electronAPI.onOpenFileFromSystem(async (filePath: string) => {
      try {
        const result = await window.electronAPI.readFile(filePath);
        if (result.success) {
          const loadedNote = JSON.parse(result.content);
          setNote(loadedNote);
          setCurrentPageId(loadedNote.pages[0]?.id || null);
          setCurrentFilePath(filePath);
          setHasUnsavedChanges(false);
          // 打开文件后默认展开页面列表
          setActiveTab('pages');
          message.success('笔记已打开！');
        } else {
          message.error('打开文件失败');
        }
      } catch (error) {
        console.error('打开文件失败:', error);
        message.error('打开文件失败');
      }
    });

    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  const addPage = () => {
    if (!note) return;
    
    // 计算新页面的序号
    const pageNumber = note.pages.length + 1;
    
    const newPage: Page = {
      id: crypto.randomUUID(),
      title: `第${pageNumber}页`,
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
    
    // 添加到左侧tab栏
    if (!leftTabs.includes(newPage.id)) {
      setLeftTabs(prev => [...prev, newPage.id]);
      setActiveLeftTab(newPage.id);
      setActiveSide('left');
    }
    
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
  };

  const deletePage = (pageId: string) => {
    if (!note) return;
    
    const deletedPage = note.pages.find(p => p.id === pageId);
    if (!deletedPage) return;
    
    // 添加到回收站
    const deletedItem = {
      id: crypto.randomUUID(),
      type: 'page' as const,
      data: deletedPage,
      deletedAt: Date.now()
    };
    
    setNote(prev => prev ? ({
      ...prev,
      pages: prev.pages.filter(p => p.id !== pageId),
      trash: [...(prev.trash || []), deletedItem],
      updatedAt: Date.now()
    }) : null);
    
    // 从两侧tab栏移除
    setLeftTabs(prev => prev.filter(id => id !== pageId));
    setRightTabs(prev => prev.filter(id => id !== pageId));
    
    if (currentPageId === pageId) setCurrentPageId(null);
    if (activeLeftTab === pageId) setActiveLeftTab(null);
    if (activeRightTab === pageId) setActiveRightTab(null);
    setHasUnsavedChanges(true);
    
    // 显示撤销提示
    message.success({
      content: '页面已删除，可在回收站中恢复',
      duration: 3
    });
  };

  const deleteBookmark = (pageId: string, bookmarkId: string) => {
    if (!note) return;
    
    const page = note.pages.find(p => p.id === pageId);
    const deletedBookmark = page?.bookmarks?.find(b => b.id === bookmarkId);
    if (!deletedBookmark) return;
    
    // 添加到回收站
    const deletedItem = {
      id: crypto.randomUUID(),
      type: 'bookmark' as const,
      data: deletedBookmark,
      pageId: pageId,
      deletedAt: Date.now()
    };
    
    setNote(prev => prev ? ({
      ...prev,
      pages: prev.pages.map(p => 
        p.id === pageId 
          ? { ...p, bookmarks: p.bookmarks?.filter(b => b.id !== bookmarkId), updatedAt: Date.now() }
          : p
      ),
      trash: [...(prev.trash || []), deletedItem],
      updatedAt: Date.now()
    }) : null);
    setHasUnsavedChanges(true);
    
    message.success('书签已删除，可在回收站中恢复');
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
    setHasUnsavedChanges(true);
  };

  // TODO相关函数
  const addTodo = (todoData: Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!note) return null;
    const newTodo: TodoItem = {
      ...todoData,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setNote(prev => prev ? ({
      ...prev,
      todos: [...(prev.todos || []), newTodo],
      updatedAt: Date.now()
    }) : null);
    setHasUnsavedChanges(true);
    message.success('待办事项已添加');
    return newTodo;
  };

  const updateTodo = (todoId: string, updates: Partial<TodoItem>) => {
    if (!note) return;
    setNote(prev => prev ? ({
      ...prev,
      todos: prev.todos?.map(t => 
        t.id === todoId ? { ...t, ...updates, updatedAt: Date.now() } : t
      ),
      updatedAt: Date.now()
    }) : null);
    setHasUnsavedChanges(true);
  };

  const deleteTodo = (todoId: string) => {
    if (!note) return;
    
    const deletedTodo = note.todos?.find(t => t.id === todoId);
    if (!deletedTodo) return;
    
    // 添加到回收站
    const deletedItem = {
      id: crypto.randomUUID(),
      type: 'todo' as const,
      data: deletedTodo,
      deletedAt: Date.now()
    };
    
    setNote(prev => prev ? ({
      ...prev,
      todos: prev.todos?.filter(t => t.id !== todoId),
      trash: [...(prev.trash || []), deletedItem],
      updatedAt: Date.now()
    }) : null);
    setHasUnsavedChanges(true);
    
    message.success('待办事项已删除，可在回收站中恢复');
  };

  // 回收站相关函数
  const restoreFromTrash = (item: any) => {
    if (!note) return;
    
    switch (item.type) {
      case 'page':
        setNote(prev => prev ? ({
          ...prev,
          pages: [...prev.pages, item.data],
          trash: prev.trash?.filter(t => t.id !== item.id),
          updatedAt: Date.now()
        }) : null);
        message.success('页面已恢复');
        break;
      case 'bookmark':
        if (item.pageId) {
          setNote(prev => prev ? ({
            ...prev,
            pages: prev.pages.map(p => 
              p.id === item.pageId 
                ? { ...p, bookmarks: [...(p.bookmarks || []), item.data], updatedAt: Date.now() }
                : p
            ),
            trash: prev.trash?.filter(t => t.id !== item.id),
            updatedAt: Date.now()
          }) : null);
          message.success('书签已恢复');
        }
        break;
      case 'todo':
        setNote(prev => prev ? ({
          ...prev,
          todos: [...(prev.todos || []), item.data],
          trash: prev.trash?.filter(t => t.id !== item.id),
          updatedAt: Date.now()
        }) : null);
        message.success('待办事项已恢复');
        break;
    }
    setHasUnsavedChanges(true);
  };

  const permanentDelete = (itemId: string) => {
    if (!note) return;
    
    setNote(prev => prev ? ({
      ...prev,
      trash: prev.trash?.filter(t => t.id !== itemId),
      updatedAt: Date.now()
    }) : null);
    setHasUnsavedChanges(true);
    message.success('已永久删除');
  };

  const clearTrash = () => {
    if (!note) return;
    
    setNote(prev => prev ? ({
      ...prev,
      trash: [],
      updatedAt: Date.now()
    }) : null);
    setHasUnsavedChanges(true);
    message.success('回收站已清空');
  };

  const jumpToBookmark = (pageId: string, position: number, length: number) => {
    if (!note) return;
    const page = note.pages.find(p => p.id === pageId);
    if (!page) return;
    
    const bookmark = page.bookmarks?.find(b => b.position === position && b.length === length);
    if (!bookmark) return;

    // 确定页面在哪一侧
    const isInLeft = leftTabs.includes(pageId);
    const isInRight = rightTabs.includes(pageId);
    
    if (!isInLeft && !isInRight) {
      // 页面不在任何Tab栏，添加到左侧
      setLeftTabs(prev => [...prev, pageId]);
      setActiveLeftTab(pageId);
      setActiveSide('left');
    } else if (isInLeft) {
      setActiveLeftTab(pageId);
      setActiveSide('left');
    } else {
      setActiveRightTab(pageId);
      setActiveSide('right');
    }
    
    setCurrentPageId(pageId);
    
    setTimeout(() => {
      const editorRef = activeSide === 'left' ? leftEditorRef : rightEditorRef;
      editorRef.current?.jumpToBookmark(bookmark.id);
    }, 200);
  };

  const jumpToContentPosition = (pageId: string, position: number) => {
    if (!note) return;
    
    // 确定页面在哪一侧
    const isInLeft = leftTabs.includes(pageId);
    const isInRight = rightTabs.includes(pageId);
    
    if (!isInLeft && !isInRight) {
      // 页面不在任何Tab栏，添加到左侧
      setLeftTabs(prev => [...prev, pageId]);
      setActiveLeftTab(pageId);
      setActiveSide('left');
    } else if (isInLeft) {
      setActiveLeftTab(pageId);
      setActiveSide('left');
    } else {
      setActiveRightTab(pageId);
      setActiveSide('right');
    }
    
    setCurrentPageId(pageId);
    
    setTimeout(() => {
      const editorRef = activeSide === 'left' ? leftEditorRef : rightEditorRef;
      editorRef.current?.jumpToPosition(position);
    }, 200);
  };

  // Tab栏相关函数
  const handleLeftTabClick = (tabId: string) => {
    setActiveLeftTab(tabId);
    setCurrentPageId(tabId);
    setActiveSide('left'); // 切换焦点到左侧
  };

  const handleRightTabClick = (tabId: string) => {
    setActiveRightTab(tabId);
    setCurrentPageId(tabId);
    setActiveSide('right'); // 切换焦点到右侧
  };

  const handleLeftTabClose = (tabId: string) => {
    setLeftTabs(prev => prev.filter(id => id !== tabId));
    
    // 如果关闭的是当前激活的Tab，切换到其他Tab
    if (activeLeftTab === tabId) {
      const remainingTabs = leftTabs.filter(id => id !== tabId);
      if (remainingTabs.length > 0) {
        setActiveLeftTab(remainingTabs[0]);
        setCurrentPageId(remainingTabs[0]);
      } else if (rightTabs.length > 0) {
        // 左侧没有Tab了，切换到右侧
        setActiveSide('right');
        setActiveLeftTab(null);
        if (activeRightTab) {
          setCurrentPageId(activeRightTab);
        }
      } else {
        setActiveLeftTab(null);
        setCurrentPageId(null);
      }
    }
  };

  const handleRightTabClose = (tabId: string) => {
    setRightTabs(prev => prev.filter(id => id !== tabId));
    
    // 如果关闭的是当前激活的Tab，切换到其他Tab
    if (activeRightTab === tabId) {
      const remainingTabs = rightTabs.filter(id => id !== tabId);
      if (remainingTabs.length > 0) {
        setActiveRightTab(remainingTabs[0]);
        setCurrentPageId(remainingTabs[0]);
      } else if (leftTabs.length > 0) {
        // 右侧没有Tab了，切换到左侧
        setActiveSide('left');
        setActiveRightTab(null);
        if (activeLeftTab) {
          setCurrentPageId(activeLeftTab);
        }
      } else {
        setActiveRightTab(null);
        setCurrentPageId(null);
      }
    }
  };

  const handleLeftSplitView = (tabId: string) => {
    // 将Tab移动到右侧
    if (leftTabs.includes(tabId)) {
      setLeftTabs(prev => prev.filter(id => id !== tabId));
      if (!rightTabs.includes(tabId)) {
        setRightTabs(prev => [...prev, tabId]);
      }
      setActiveRightTab(tabId);
      setCurrentPageId(tabId);
      setActiveSide('right');
      
      // 如果左侧没有Tab了，需要设置一个
      const remainingLeftTabs = leftTabs.filter(id => id !== tabId);
      if (remainingLeftTabs.length === 0 && activeLeftTab === tabId) {
        setActiveLeftTab(null);
      }
    }
  };

  const handleRightSplitView = (tabId: string) => {
    // 将Tab移动到左侧
    if (rightTabs.includes(tabId)) {
      setRightTabs(prev => prev.filter(id => id !== tabId));
      if (!leftTabs.includes(tabId)) {
        setLeftTabs(prev => [...prev, tabId]);
      }
      setActiveLeftTab(tabId);
      setCurrentPageId(tabId);
      setActiveSide('left');
      
      // 如果右侧没有Tab了，需要设置一个
      const remainingRightTabs = rightTabs.filter(id => id !== tabId);
      if (remainingRightTabs.length === 0 && activeRightTab === tabId) {
        setActiveRightTab(null);
      }
    }
  };

  const handleLeftTabReorder = (reorderedTabs: Array<{ id: string; title: string }>) => {
    const newTabIds = reorderedTabs.map(t => t.id);
    setLeftTabs(newTabIds);
  };

  const handleRightTabReorder = (reorderedTabs: Array<{ id: string; title: string }>) => {
    const newTabIds = reorderedTabs.map(t => t.id);
    setRightTabs(newTabIds);
  };

  // 当选择页面时，自动添加到tab栏
  const handleSelectPage = (pageId: string) => {
    setCurrentPageId(pageId);
    // 默认添加到左侧Tab栏
    if (!leftTabs.includes(pageId) && !rightTabs.includes(pageId)) {
      setLeftTabs(prev => {
        const newTabs = [...prev, pageId];
        // 如果超过最大数量，移除最早的 Tab
        if (newTabs.length > MAX_TABS) {
          message.info(`已达到最大Tab数量(${MAX_TABS})，自动关闭最早的Tab`);
          return newTabs.slice(1);
        }
        return newTabs;
      });
      setActiveLeftTab(pageId);
      setActiveSide('left');
    } else if (leftTabs.includes(pageId)) {
      setActiveLeftTab(pageId);
      setActiveSide('left');
    } else if (rightTabs.includes(pageId)) {
      setActiveRightTab(pageId);
      setActiveSide('right');
    }
  };

  const createNewNote = async () => {
    // 先让用户选择保存位置
    const filePath = await window.electronAPI.saveNote(JSON.stringify({
      id: crypto.randomUUID(),
      name: '新建笔记',
      pages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }, null, 2), '新建笔记');
    
    if (filePath) {
      // 用户选择了保存位置，创建新笔记
      const newNote: Note = {
        id: crypto.randomUUID(),
        name: '新建笔记',
        pages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      setNote(newNote);
      setCurrentPageId(null);
      setCurrentFilePath(filePath);
      setHasUnsavedChanges(false);
      // 创建新笔记后默认展开页面列表
      setActiveTab('pages');
      message.success('已创建新笔记！');
    }
  };

  const updateNoteName = async (name: string) => {
    if (!note) return;
    
    // 如果有文件路径，尝试重命名文件
    if (currentFilePath) {
      const newPath = await window.electronAPI.renameFile(currentFilePath, name);
      if (newPath) {
        setCurrentFilePath(newPath);
        message.success('笔记名和文件名已同步更新');
      } else {
        message.warning('文件重命名失败，可能文件名已存在');
        return; // 如果重命名失败，不更新笔记名
      }
    }
    
    setNote(prev => prev ? ({
      ...prev,
      name,
      updatedAt: Date.now()
    }) : null);
    setHasUnsavedChanges(true);
  };

  const renderSidePanel = () => {
    if (!note) return null;
    switch (activeTab) {
      case 'pages':
        return (
          <PagesPanel
            pages={note.pages}
            currentPageId={currentPageId}
            onSelectPage={handleSelectPage}
            onAddPage={addPage}
            onDeletePage={deletePage}
          />
        );
      case 'search':
        return (
          <SearchPanel
            pages={note.pages}
            currentPageId={currentPageId}
            onSelectPage={handleSelectPage}
            onJumpToPosition={jumpToContentPosition}
            onJumpToBookmark={jumpToBookmark}
            searchTag={searchTag}
            onSearchTagChange={setSearchTag}
          />
        );
      case 'todo':
        return (
          <TodoPanel 
            todos={note.todos || []}
            pages={note.pages}
            onAddTodo={addTodo}
            onUpdateTodo={updateTodo}
            onDeleteTodo={deleteTodo}
            onJumpToPage={jumpToContentPosition}
          />
        );
      case 'bookmarks':
        return (
          <BookmarkPanel
            pages={note.pages}
            currentPageId={currentPageId}
            onSelectPage={handleSelectPage}
            onJumpToBookmark={jumpToBookmark}
            onDeleteBookmark={deleteBookmark}
            onUpdateBookmark={updateBookmark}
          />
        );
      case 'trash':
        return (
          <TrashPanel
            trash={note.trash || []}
            onRestore={restoreFromTrash}
            onPermanentDelete={permanentDelete}
            onClearAll={clearTrash}
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
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={saveNote}
        onSaveAs={saveAsNote}
        onOpen={openNote}
        onCreateNew={createNewNote}
        onUpdateNoteName={updateNoteName}
      />
      
      <Layout style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
        <IconBar activeTab={activeTab} onTabChange={setActiveTab} />
        
        {activeTab && (
          <>
            <Layout.Sider 
              width={sidebarWidth} 
              style={{ 
                background: '#fff', 
                borderRight: '1px solid #f0f0f0',
                position: 'relative'
              }}
            >
              {renderSidePanel()}
            </Layout.Sider>
            
            {/* 可调整宽度的分隔条 */}
            <div
              style={{
                width: '4px',
                cursor: 'col-resize',
                background: isResizing ? '#1677ff' : 'transparent',
                transition: 'background 0.2s',
                position: 'relative',
                zIndex: 10
              }}
              onMouseDown={() => setIsResizing(true)}
              onMouseEnter={(e) => {
                if (!isResizing) e.currentTarget.style.background = '#e8e8e8';
              }}
              onMouseLeave={(e) => {
                if (!isResizing) e.currentTarget.style.background = 'transparent';
              }}
            />
          </>
        )}
        
        <Layout style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* 编辑器区域 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* 没有笔记时的提示 */}
            {!note && (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fafafa'
              }}>
                <div style={{
                  textAlign: 'center',
                  padding: '48px',
                  maxWidth: '400px'
                }}>
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '24px',
                    opacity: 0.3
                  }}>
                    📝
                  </div>
                  <h2 style={{
                    fontSize: '24px',
                    fontWeight: 600,
                    color: '#333',
                    marginBottom: '16px'
                  }}>
                    欢迎使用笔记本
                  </h2>
                  <p style={{
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '32px',
                    lineHeight: '1.6'
                  }}>
                    开始创建您的第一个笔记，或打开已有的笔记文件
                  </p>
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    justifyContent: 'center'
                  }}>
                    <button
                      onClick={createNewNote}
                      style={{
                        padding: '10px 24px',
                        background: '#1677ff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#0958d9'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#1677ff'}
                    >
                      新建笔记
                    </button>
                    <button
                      onClick={openNote}
                      style={{
                        padding: '10px 24px',
                        background: '#fff',
                        color: '#333',
                        border: '1px solid #d9d9d9',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#1677ff';
                        e.currentTarget.style.color = '#1677ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#d9d9d9';
                        e.currentTarget.style.color = '#333';
                      }}
                    >
                      打开笔记
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* 有笔记但没有页面时的提示 */}
            {note && note.pages.length === 0 && (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fafafa'
              }}>
                <div style={{
                  textAlign: 'center',
                  padding: '48px',
                  maxWidth: '400px'
                }}>
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '24px',
                    opacity: 0.3
                  }}>
                    📄
                  </div>
                  <h2 style={{
                    fontSize: '24px',
                    fontWeight: 600,
                    color: '#333',
                    marginBottom: '16px'
                  }}>
                    还没有页面
                  </h2>
                  <p style={{
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '32px',
                    lineHeight: '1.6'
                  }}>
                    点击左侧的"新建"按钮创建您的第一个页面
                  </p>
                  <button
                    onClick={addPage}
                    style={{
                      padding: '10px 24px',
                      background: '#1677ff',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#0958d9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#1677ff'}
                  >
                    新建页面
                  </button>
                </div>
              </div>
            )}
            
            {/* 有笔记且有页面时显示Tab栏和编辑器 */}
            {note && note.pages.length > 0 && (
              <>
                {/* 双Tab栏 */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0' }}>
                  {/* 左侧Tab栏 */}
                  {leftTabs.length > 0 && (
                    <div style={{ flex: showSplit ? 1 : 'auto', width: showSplit ? '50%' : '100%', borderRight: showSplit ? '1px solid #e0e0e0' : 'none' }}>
                      <PageTabs
                        tabs={leftTabs.map(id => {
                          const page = note?.pages.find(p => p.id === id);
                          return {
                            id,
                            title: page?.title || '未命名页面'
                          };
                        })}
                        activeTabId={activeLeftTab}
                        onTabClick={handleLeftTabClick}
                        onTabClose={handleLeftTabClose}
                        onSplitView={handleLeftSplitView}
                        onTabReorder={handleLeftTabReorder}
                      />
                    </div>
                  )}
                  
                  {/* 右侧Tab栏 */}
                  {rightTabs.length > 0 && (
                    <div style={{ flex: showSplit ? 1 : 'auto', width: showSplit ? '50%' : '100%' }}>
                      <PageTabs
                        tabs={rightTabs.map(id => {
                          const page = note?.pages.find(p => p.id === id);
                          return {
                            id,
                            title: page?.title || '未命名页面'
                          };
                        })}
                        activeTabId={activeRightTab}
                        onTabClick={handleRightTabClick}
                        onTabClose={handleRightTabClose}
                        onSplitView={handleRightSplitView}
                        onTabReorder={handleRightTabReorder}
                      />
                    </div>
                  )}
                </div>
                
                {/* 双编辑器 */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  {/* 左侧编辑器 */}
                  {leftTabs.length > 0 && (
                    <div 
                      style={{ 
                        flex: showSplit ? 1 : 'auto', 
                        width: showSplit ? '50%' : '100%', 
                        overflow: 'hidden',
                        borderRight: showSplit ? '2px solid #e0e0e0' : 'none',
                        cursor: showSplit && activeSide === 'right' ? 'pointer' : 'default'
                      }}
                      onClick={() => showSplit && activeSide === 'right' && setActiveSide('left')}
                    >
                      {activeSide === 'left' || !showSplit ? (
                        <Editor
                          key={activeLeftPage?.id || 'no-left-page'}
                          ref={leftEditorRef}
                          page={activeLeftPage}
                          onUpdatePage={(updates) => activeLeftPage && updatePage(activeLeftPage.id, updates)}
                          todos={note?.todos || []}
                          onAddTodo={addTodo}
                          onUpdateTodo={updateTodo}
                          onDeleteTodo={deleteTodo}
                          onJumpToPage={jumpToContentPosition}
                        />
                      ) : (
                        <ReadOnlyEditor page={activeLeftPage} />
                      )}
                    </div>
                  )}
                  
                  {/* 右侧编辑器 */}
                  {rightTabs.length > 0 && (
                    <div 
                      style={{ 
                        flex: showSplit ? 1 : 'auto', 
                        width: showSplit ? '50%' : '100%', 
                        overflow: 'hidden',
                        cursor: showSplit && activeSide === 'left' ? 'pointer' : 'default'
                      }}
                      onClick={() => showSplit && activeSide === 'left' && setActiveSide('right')}
                    >
                      {activeSide === 'right' || !showSplit ? (
                        <Editor
                          key={activeRightPage?.id || 'no-right-page'}
                          ref={rightEditorRef}
                          page={activeRightPage}
                          onUpdatePage={(updates) => activeRightPage && updatePage(activeRightPage.id, updates)}
                          todos={note?.todos || []}
                          onAddTodo={addTodo}
                          onUpdateTodo={updateTodo}
                          onDeleteTodo={deleteTodo}
                          onJumpToPage={jumpToContentPosition}
                        />
                      ) : (
                        <ReadOnlyEditor page={activeRightPage} />
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;

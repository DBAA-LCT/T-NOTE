import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Layout, Input, Tag, Space, Button, Empty, Popover, List, Popconfirm, message, Modal, Dropdown, Select, DatePicker, Checkbox, Typography, InputNumber } from 'antd';
import { PlusOutlined, BookOutlined, DeleteOutlined, PushpinOutlined, PushpinFilled, EditOutlined, CheckSquareOutlined, FlagOutlined, TableOutlined, SearchOutlined, CloseOutlined, UpOutlined, DownOutlined, ExpandOutlined, CompressOutlined, CopyOutlined, ScissorOutlined, FileTextOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Page, Bookmark, TodoItem } from '../types';
import PageCommitButton from './PageCommitButton';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import { useContextMenu } from '../hooks/useContextMenu';
import dayjs from 'dayjs';

const { Content } = Layout;
const { Text } = Typography;
const { TextArea } = Input;

// 从 HTML 中提取纯文本
const stripHtml = (html: string): string => {
  if (!html) return '';
  try {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  } catch (error) {
    console.error('stripHtml error:', error);
    return '';
  }
};

// 在组件外部注册自定义格式（只注册一次）
const Quill = ReactQuill.Quill;
const Inline = Quill.import('blots/inline') as any;
const BlockEmbed = Quill.import('blots/block/embed') as any;

class BookmarkBlot extends Inline {
  static blotName = 'bookmark';
  static tagName = 'span';
  static className = 'ql-bookmark';

  static create(value: any) {
    const node = super.create();
    if (typeof value === 'string') {
      node.setAttribute('data-bookmark-id', value);
    } else {
      node.setAttribute('data-bookmark-id', value.id);
      if (value.name) {
        const noteText = value.note ? stripHtml(value.note) : '';
        const title = value.name + (noteText ? '\n\n' + noteText : '');
        node.setAttribute('title', title);
      }
    }
    return node;
  }

  static formats(node: HTMLElement) {
    return node.getAttribute('data-bookmark-id');
  }
}

class TodoBlot extends Inline {
  static blotName = 'todo';
  static tagName = 'span';
  static className = 'ql-todo';

  static create(value: any) {
    const node = super.create();
    if (typeof value === 'string') {
      node.setAttribute('data-todo-id', value);
    } else {
      node.setAttribute('data-todo-id', value.id);
      if (value.title) {
        node.setAttribute('title', `待办: ${value.title}${value.completed ? ' (已完成)' : ''}`);
      }
      if (value.completed) {
        node.setAttribute('data-completed', 'true');
      }
    }
    return node;
  }

  static formats(node: HTMLElement) {
    return {
      id: node.getAttribute('data-todo-id'),
      completed: node.getAttribute('data-completed') === 'true'
    };
  }
}

// 长代码块 Blot - 不渲染内容，只显示占位符
class LongCodeBlot extends BlockEmbed {
  static blotName = 'longcode';
  static tagName = 'div';
  static className = 'ql-longcode';

  static create(value: any) {
    const node = super.create();
    node.setAttribute('contenteditable', 'false');
    node.setAttribute('data-code-id', value.id || crypto.randomUUID());
    node.setAttribute('data-language', value.language || 'text');
    node.setAttribute('data-title', value.title || '长代码块');
    node.setAttribute('data-lines', value.lines || '0');
    
    // 创建占位符显示 - 简洁版
    const placeholder = document.createElement('div');
    placeholder.className = 'longcode-placeholder';
    placeholder.style.cssText = `
      padding: 8px 12px;
      background: rgb(245, 245, 245);
      border-left: 3px solid #1677ff;
      border-radius: 2px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      transition: all 0.2s ease;
      margin: 4px 0;
      user-select: none;
    `;
    
    const title = value.title || '长代码块';
    placeholder.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 14px;">📄</span>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-size: 13px; color: #262626; font-weight: 500;">${title}</span>
          <span style="font-size: 12px; color: #8c8c8c;">
            ${value.language || 'text'} · ${value.lines || 0} 行
          </span>
        </div>
      </div>
      <span style="font-size: 12px; color: #8c8c8c;">双击编辑</span>
    `;
    
    // 添加悬停效果
    placeholder.addEventListener('mouseenter', () => {
      placeholder.style.background = '#e6f4ff';
      placeholder.style.borderLeftColor = '#0958d9';
    });
    
    placeholder.addEventListener('mouseleave', () => {
      placeholder.style.background = 'rgb(245, 245, 245)';
      placeholder.style.borderLeftColor = '#1677ff';
    });
    
    node.appendChild(placeholder);
    
    return node;
  }

  static value(node: HTMLElement) {
    return {
      id: node.getAttribute('data-code-id'),
      language: node.getAttribute('data-language'),
      title: node.getAttribute('data-title'),
      lines: node.getAttribute('data-lines')
    };
  }
}

// 注册自定义格式（使用try-catch避免重复注册错误）
try {
  Quill.register(BookmarkBlot);
  console.log('✅ Bookmark format registered');
} catch (error) {
  console.log('⚠️ Bookmark format already registered');
}

try {
  Quill.register(TodoBlot);
  console.log('✅ Todo format registered');
} catch (error) {
  console.log('⚠️ Todo format already registered');
}

try {
  Quill.register(LongCodeBlot);
  console.log('✅ LongCode format registered');
} catch (error) {
  console.log('⚠️ LongCode format already registered');
}

// Table functionality - using simple HTML table insertion
// Note: quill-better-table has compatibility issues with Quill 2.0
console.log('✅ Table support enabled (HTML mode)');

interface EditorProps {
  page?: Page;
  onUpdatePage: (updates: Partial<Page>) => void;
  todos?: TodoItem[];
  onAddTodo?: (todo: Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt'>) => TodoItem | null;
  onUpdateTodo?: (id: string, updates: Partial<TodoItem>) => void;
  onDeleteTodo?: (id: string) => void;
  onJumpToPage?: (pageId: string, position: number) => void;
  noteId?: string;  // 笔记ID，用于页面级同步
  syncConfig?: {    // 同步配置
    enabled: boolean;
    autoCommit: boolean;
  };
}

export interface EditorRef {
  jumpToBookmark: (bookmarkId: string) => void;
  jumpToPosition: (position: number) => void;
}

const Editor = forwardRef<EditorRef, EditorProps>(({ page, onUpdatePage, todos = [], onAddTodo, onUpdateTodo, onDeleteTodo, onJumpToPage, noteId, syncConfig }, ref) => {
  const [tagInput, setTagInput] = useState('');
  const [bookmarkInput, setBookmarkInput] = useState('');
  const [bookmarkPopoverOpen, setBookmarkPopoverOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [bookmarkName, setBookmarkName] = useState('');
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [contextMenuBookmark, setContextMenuBookmark] = useState<Bookmark | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  
  // 长代码块侧边栏状态
  const [longCodeSidebarOpen, setLongCodeSidebarOpen] = useState(false);
  
  // 图片预览相关状态
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [imageScale, setImageScale] = useState(1);
  
  // 待办相关状态
  const [todoPopoverOpen, setTodoPopoverOpen] = useState(false);
  const [todoTitle, setTodoTitle] = useState('');
  const [todoDescription, setTodoDescription] = useState('');
  const [todoPriority, setTodoPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [todoCategory, setTodoCategory] = useState('');
  const [todoDueDate, setTodoDueDate] = useState<number | undefined>();
  const [selectedRange, setSelectedRange] = useState<{ index: number; length: number } | null>(null);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [linkExistingTodo, setLinkExistingTodo] = useState(false);
  const [selectedExistingTodoId, setSelectedExistingTodoId] = useState<string | undefined>();
  
  // 选择对话框状态（当同时是书签和待办时）
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [pendingBookmark, setPendingBookmark] = useState<Bookmark | null>(null);
  const [pendingTodo, setPendingTodo] = useState<TodoItem | null>(null);
  
  const quillRef = useRef<ReactQuill>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // 编辑器右键菜单
  const editorContextMenu = useContextMenu();

  // 搜索替换相关状态
  const [showSearch, setShowSearch] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [searchMatches, setSearchMatches] = useState<{ index: number; length: number }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [tablePopoverOpen, setTablePopoverOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  // 长代码块相关状态
  const [longCodeModalOpen, setLongCodeModalOpen] = useState(false);
  const [longCodeContent, setLongCodeContent] = useState('');
  const [longCodeLanguage, setLongCodeLanguage] = useState('javascript');
  const [longCodeTitle, setLongCodeTitle] = useState('长代码块'); // 代码标题
  const [editingLongCodeId, setEditingLongCodeId] = useState<string | null>(null);
  const [longCodeMap, setLongCodeMap] = useState<Map<string, { content: string; language: string; title: string }>>(new Map());
  const [savedCursorPosition, setSavedCursorPosition] = useState<number | null>(null); // 保存光标位置

  // 检测内容大小 - 加载页面的长代码块
  useEffect(() => {
    if (!page) return;
    
    // 加载页面的长代码块
    if (page.longCodeBlocks) {
      const newMap = new Map<string, { content: string; language: string; title: string }>();
      Object.entries(page.longCodeBlocks).forEach(([id, data]) => {
        // 兼容旧数据，如果没有 title 则使用默认值
        newMap.set(id, {
          content: data.content,
          language: data.language,
          title: data.title || '长代码块'
        });
      });
      setLongCodeMap(newMap);
    } else {
      setLongCodeMap(new Map());
    }
  }, [page?.id, page?.content?.length]);



  // 暴露跳转方法给父组件
  useImperativeHandle(ref, () => ({
    jumpToBookmark: (bookmarkId: string) => {
      jumpToBookmark(bookmarkId);
    },
    jumpToPosition: (position: number) => {
      const quill = quillRef.current?.getEditor();
      if (!quill) return;

      // 跳转到指定位置
      quill.setSelection(position, 0);
      
      // 滚动到视图
      const bounds = quill.getBounds(position);
      if (bounds && quill.root.parentElement) {
        quill.root.parentElement.scrollTop = Math.max(0, bounds.top - 100);
      }
    }
  }));

  // 监听书签和待办的双击事件（统一处理）
  useEffect(() => {
    let clickTimer: NodeJS.Timeout | null = null;
    let clickCount = 0;
    let lastTarget: HTMLElement | null = null;

    const handleClick = (e: MouseEvent) => {
      let target = e.target as HTMLElement;
      
      // 向上查找，检查是否点击在书签、待办或长代码块上
      let bookmarkElement: HTMLElement | null = null;
      let todoElement: HTMLElement | null = null;
      let longCodeElement: HTMLElement | null = null;
      
      let current: HTMLElement | null = target;
      while (current && current !== editorContainerRef.current) {
        if (current.classList.contains('ql-bookmark')) {
          bookmarkElement = current;
        }
        if (current.classList.contains('ql-todo')) {
          todoElement = current;
        }
        if (current.classList.contains('ql-longcode')) {
          longCodeElement = current;
        }
        if (bookmarkElement || todoElement || longCodeElement) break;
        current = current.parentElement;
      }
      
      const clickedElement = bookmarkElement || todoElement || longCodeElement;
      if (!clickedElement) return;
      
      // 如果点击的是同一个元素
      if (clickedElement === lastTarget) {
        clickCount++;
      } else {
        clickCount = 1;
        lastTarget = clickedElement;
      }
      
      if (clickCount === 1) {
        // 第一次点击，等待可能的第二次点击
        clickTimer = setTimeout(() => {
          clickCount = 0;
          lastTarget = null;
        }, 300);
      } else if (clickCount === 2) {
        // 双击
        if (clickTimer) clearTimeout(clickTimer);
        clickCount = 0;
        lastTarget = null;
        
        // 处理长代码块双击
        if (longCodeElement) {
          const codeId = longCodeElement.getAttribute('data-code-id');
          console.log('双击长代码块:', codeId, '当前 Map:', longCodeMap);
          if (codeId) {
            const codeData = longCodeMap.get(codeId);
            if (codeData) {
              setLongCodeContent(codeData.content);
              setLongCodeLanguage(codeData.language);
              setLongCodeTitle(codeData.title || '长代码块');
              setEditingLongCodeId(codeId);
              setLongCodeModalOpen(true);
            } else {
              message.warning('未找到代码内容，可能已被删除');
            }
          }
          return;
        }
        
        // 获取书签和待办信息
        const bookmarkId = bookmarkElement?.getAttribute('data-bookmark-id');
        const todoId = todoElement?.getAttribute('data-todo-id');
        
        const bookmark = bookmarkId && page ? page.bookmarks?.find(b => b.id === bookmarkId) : null;
        const todo = todoId && todos ? todos.find(t => t.id === todoId) : null;
        
        // 判断是否同时是书签和待办
        if (bookmark && todo) {
          // 同时是书签和待办，显示选择对话框
          setPendingBookmark(bookmark);
          setPendingTodo(todo);
          setShowChoiceModal(true);
        } else if (bookmark) {
          // 只是书签
          setEditingBookmark(bookmark);
          setBookmarkName(bookmark.name);
          setBookmarkNote(bookmark.note || '');
        } else if (todo) {
          // 只是待办
          setEditingTodo(todo);
          setTodoTitle(todo.title);
          setTodoDescription(todo.description || '');
          setTodoPriority(todo.priority);
          setTodoCategory(todo.category || '');
          setTodoDueDate(todo.dueDate);
        }
      }
    };

    const handleBookmarkContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('ql-bookmark')) {
        e.preventDefault();
        const bookmarkId = target.getAttribute('data-bookmark-id');
        if (bookmarkId && page) {
          const bookmark = page.bookmarks?.find(b => b.id === bookmarkId);
          if (bookmark) {
            setContextMenuBookmark(bookmark);
            setContextMenuPosition({ x: e.clientX, y: e.clientY });
            setContextMenuVisible(true);
          }
        }
      }
    };

    const handleClickOutside = () => {
      setContextMenuVisible(false);
    };

    const editor = editorContainerRef.current;
    if (editor) {
      editor.addEventListener('click', handleClick);
      editor.addEventListener('contextmenu', handleBookmarkContextMenu);
      document.addEventListener('click', handleClickOutside);
      
      return () => {
        editor.removeEventListener('click', handleClick);
        editor.removeEventListener('contextmenu', handleBookmarkContextMenu);
        document.removeEventListener('click', handleClickOutside);
        if (clickTimer) clearTimeout(clickTimer);
      };
    }
  }, [page?.id, todos?.length, longCodeMap]); // 添加 longCodeMap 依赖

  // 监听图片双击事件，实现预览功能
  useEffect(() => {
    const editor = editorContainerRef.current;
    if (!editor) return;

    const handleImageDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        setPreviewImageUrl(img.src);
        setImageScale(1); // 重置缩放
        setImagePreviewVisible(true);
      }
    };

    editor.addEventListener('dblclick', handleImageDblClick);

    return () => {
      editor.removeEventListener('dblclick', handleImageDblClick);
    };
  }, []);

  // 图片预览滚轮缩放
  useEffect(() => {
    if (!imagePreviewVisible) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // 计算缩放增量
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      
      setImageScale(prevScale => {
        const newScale = prevScale + delta;
        // 限制缩放范围在 0.1 到 5 之间
        return Math.max(0.1, Math.min(5, newScale));
      });
    };

    // 添加到 document，这样在 Modal 内外都能响应
    document.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, [imagePreviewVisible]);

  // 图片大小调整功能
  useEffect(() => {
    const editor = editorContainerRef.current;
    if (!editor) return;

    let isResizing = false;
    let currentImg: HTMLImageElement | null = null;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' && e.button === 0 && e.shiftKey) {
        // Shift + 左键点击图片开始调整大小
        e.preventDefault();
        isResizing = true;
        currentImg = target as HTMLImageElement;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = currentImg.width;
        startHeight = currentImg.height;
        currentImg.classList.add('resizing');
        document.body.style.cursor = 'nwse-resize';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !currentImg) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const delta = Math.max(deltaX, deltaY);
      
      const newWidth = Math.max(50, startWidth + delta);
      const aspectRatio = startHeight / startWidth;
      const newHeight = newWidth * aspectRatio;
      
      currentImg.style.width = newWidth + 'px';
      currentImg.style.height = newHeight + 'px';
    };

    const handleMouseUp = () => {
      if (isResizing && currentImg) {
        currentImg.classList.remove('resizing');
        document.body.style.cursor = 'default';
        isResizing = false;
        currentImg = null;
      }
    };

    editor.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      editor.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // 同步书签信息到 DOM（更新 title 属性）
  useEffect(() => {
    if (!page?.bookmarks) return;

    const editor = editorContainerRef.current;
    if (!editor) return;

    const bookmarkElements = editor.querySelectorAll('.ql-bookmark');
    bookmarkElements.forEach((element) => {
      const bookmarkId = element.getAttribute('data-bookmark-id');
      if (bookmarkId) {
        const bookmark = page.bookmarks?.find(b => b.id === bookmarkId);
        if (bookmark) {
          const noteText = bookmark.note ? stripHtml(bookmark.note) : '';
          const title = bookmark.name + (noteText ? '\n\n' + noteText : '');
          element.setAttribute('title', title);
        }
      }
    });
  }, [page?.bookmarks]);

  // 同步待办完成状态到 DOM
  useEffect(() => {
    if (!todos || todos.length === 0 || !page) return;

    const editor = editorContainerRef.current;
    if (!editor) return;

    const todoElements = editor.querySelectorAll('.ql-todo');
    todoElements.forEach((element) => {
      const todoId = element.getAttribute('data-todo-id');
      if (todoId) {
        const todo = todos.find(t => t.id === todoId);
        if (todo) {
          // 更新完成状态属性
          if (todo.completed) {
            element.setAttribute('data-completed', 'true');
          } else {
            element.removeAttribute('data-completed');
          }
          // 更新title
          element.setAttribute('title', `待办: ${todo.title}${todo.completed ? ' (已完成)' : ''}`);
        }
      }
    });
  }, [todos, page?.id]);

  // 页面加载时自动跳转到定位器位置或恢复滚动位置
  useEffect(() => {
    if (!page) return;

    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    // 页面切换时清除撤销历史，防止撤销到其他页面的内容
    const history = quill.getModule('history') as { clear?: () => void } | null;
    if (history && history.clear) {
      history.clear();
    }

    // 定位器标记符号
    const markerSymbol = '📍';

    // 延迟跳转，确保内容已加载
    const timer = setTimeout(() => {
      // 优先跳转到定位器位置
      if (page.markerPosition !== undefined) {
        const content = quill.getText();
        const markerIndex = content.indexOf(markerSymbol);
        
        if (markerIndex !== -1) {
          // 设置光标到定位器位置
          quill.setSelection(markerIndex, 0);
          // 滚动到定位器位置
          const bounds = quill.getBounds(markerIndex);
          if (bounds && quill.root.parentElement) {
            quill.root.parentElement.scrollTop = Math.max(0, bounds.top - 100);
          }
        }
      } else if (page.scrollPosition !== undefined && quill.root.parentElement) {
        // 如果没有定位器，恢复上次的滚动位置
        quill.root.parentElement.scrollTop = page.scrollPosition;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [page?.id]); // 只在页面切换时触发

  // 监听滚动事件，保存滚动位置
  useEffect(() => {
    if (!page) return;

    const quill = quillRef.current?.getEditor();
    if (!quill || !quill.root.parentElement) return;

    const scrollContainer = quill.root.parentElement;
    let scrollTimer: NodeJS.Timeout;

    const handleScroll = () => {
      // 使用防抖，避免频繁更新
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const scrollTop = scrollContainer.scrollTop;
        // 只有在没有定位器时才保存滚动位置
        if (page.markerPosition === undefined) {
          onUpdatePage({ scrollPosition: scrollTop });
        }
      }, 300);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimer);
    };
  }, [page?.id, page?.markerPosition, onUpdatePage]);

  // 监听内容变化，检测定位器是否被删除
  useEffect(() => {
    if (!page || page.markerPosition === undefined) return;

    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    // 定位器标记符号
    const markerSymbol = '📍';

    const handleTextChange = () => {
      const content = quill.getText();
      const markerIndex = content.indexOf(markerSymbol);
      
      // 如果定位器图标被删除，清除 markerPosition
      if (markerIndex === -1) {
        onUpdatePage({ markerPosition: undefined });
      }
    };

    quill.on('text-change', handleTextChange);
    return () => {
      quill.off('text-change', handleTextChange);
    };
  }, [page?.markerPosition, onUpdatePage]);

  // 监听书签和待办标记的删除
  useEffect(() => {
    if (!page) return;

    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    // 保存上一次的内容状态
    let previousBookmarks = new Set<string>();
    let previousTodos = new Set<string>();

    // 初始化状态
    const initializeState = () => {
      const delta = quill.getContents();
      delta.ops?.forEach((op: any) => {
        if (op.attributes?.bookmark) {
          previousBookmarks.add(op.attributes.bookmark);
        }
        if (op.attributes?.todo?.id) {
          previousTodos.add(op.attributes.todo.id);
        }
      });
    };

    initializeState();

    const handleTextChange = (delta: any, oldDelta: any, source: string) => {
      if (source !== 'user') return;

      // 获取当前的书签和待办
      const currentDelta = quill.getContents();
      const currentBookmarks = new Set<string>();
      const currentTodos = new Set<string>();

      currentDelta.ops?.forEach((op: any) => {
        if (op.attributes?.bookmark) {
          currentBookmarks.add(op.attributes.bookmark);
        }
        if (op.attributes?.todo?.id) {
          currentTodos.add(op.attributes.todo.id);
        }
      });

      // 检查被删除的书签
      previousBookmarks.forEach(bookmarkId => {
        if (!currentBookmarks.has(bookmarkId)) {
          const bookmark = page.bookmarks?.find(b => b.id === bookmarkId);
          if (bookmark) {
            Modal.confirm({
              title: '书签标记已删除',
              content: `书签"${bookmark.name}"的标记已被删除，是否同时删除该书签？`,
              okText: '删除书签',
              cancelText: '保留书签',
              onOk: () => {
                const bookmarks = page.bookmarks || [];
                onUpdatePage({ bookmarks: bookmarks.filter(b => b.id !== bookmarkId) });
                message.success('书签已删除');
              },
              onCancel: () => {
                message.info('已保留书签');
              }
            });
          }
        }
      });

      // 检查被删除的待办
      if (todos && todos.length > 0 && onUpdateTodo && onDeleteTodo) {
        previousTodos.forEach(todoId => {
          if (!currentTodos.has(todoId)) {
            const todo = todos.find(t => t.id === todoId && t.linkedPageId === page.id);
            if (todo) {
              Modal.confirm({
                title: '待办关联已删除',
                content: `待办"${todo.title}"的关联文字已被删除，是否同时删除该待办？`,
                okText: '删除待办',
                cancelText: '仅取消关联',
                onOk: () => {
                  onDeleteTodo(todo.id);
                  message.success('待办已删除');
                },
                onCancel: () => {
                  onUpdateTodo(todo.id, {
                    linkedPageId: undefined,
                    linkedPosition: undefined,
                    linkedLength: undefined
                  });
                  message.info('已取消关联');
                }
              });
            }
          }
        });
      }

      // 更新状态
      previousBookmarks = currentBookmarks;
      previousTodos = currentTodos;
    };

    quill.on('text-change', handleTextChange);
    return () => {
      quill.off('text-change', handleTextChange);
    };
  }, [page, todos, onUpdatePage, onUpdateTodo, onDeleteTodo]);

  // 监听代码块，自动转换超过5行的代码块为长代码块
  useEffect(() => {
    if (!page) return;

    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const handleTextChange = (delta: any, oldDelta: any, source: string) => {
      if (source !== 'user') return;

      const contents = quill.getContents();
      const ops = contents.ops || [];
      
      // 找到所有带 code-block 属性的 ops（每个代表一行）
      const codeBlockOps = ops.filter((op: any) => op.attributes && op.attributes['code-block']);
      const lineCount = codeBlockOps.length;
      
      console.log('代码块行数:', lineCount);
      
      // 如果超过100行，触发转换
      if (lineCount > 100) {
        console.log('触发转换! 行数:', lineCount);
        
        // 延迟执行，避免在 text-change 事件中修改内容
        setTimeout(() => {
          const currentOps = quill.getContents().ops || [];
          
          // 重新理解 Quill 代码块结构：
          // 代码块每一行 = 文本内容(可能没有code-block属性) + \n(有code-block属性)
          // 需要收集所有连续的 code-block 行及其前面的内容
          
          let codeLines: string[] = [];
          let codeBlockStart = -1;
          let codeBlockEnd = -1;
          let currentIndex = 0;
          let inCodeBlock = false;
          let pendingText = ''; // 暂存可能属于代码块的文本
          
          for (let i = 0; i < currentOps.length; i++) {
            const op = currentOps[i];
            const nextOp = i < currentOps.length - 1 ? currentOps[i + 1] : null;
            const text = op.insert;
            const hasCodeBlock = op.attributes && op.attributes['code-block'];
            const nextHasCodeBlock = nextOp?.attributes && nextOp.attributes['code-block'];
            
            if (typeof text === 'string') {
              if (hasCodeBlock) {
                // 这是代码块的换行符
                if (!inCodeBlock) {
                  codeBlockStart = currentIndex - pendingText.length;
                  inCodeBlock = true;
                }
                // 添加前面暂存的文本作为这一行的内容
                codeLines.push(pendingText);
                pendingText = '';
                codeBlockEnd = currentIndex + text.length;
              } else if (nextHasCodeBlock) {
                // 这是代码块行的内容（下一个是 code-block 的 \n）
                pendingText = text;
              } else if (inCodeBlock) {
                // 代码块结束
                break;
              }
              currentIndex += text.length;
            } else {
              if (inCodeBlock) {
                break;
              }
              currentIndex += 1;
            }
          }
          
          const codeContent = codeLines.join('\n');
          console.log('收集到的代码:', { start: codeBlockStart, end: codeBlockEnd, lines: codeLines.length, content: codeContent.substring(0, 100) });
          
          if (codeBlockStart !== -1 && codeContent) {
            console.log('开始转换为长代码块...');
            // 创建长代码块
            const codeId = crypto.randomUUID();
            const newMap = new Map(longCodeMap);
            newMap.set(codeId, {
              content: codeContent.trim(),
              language: 'text',
              title: '长代码块'
            });
            setLongCodeMap(newMap);
            
            // 保存到页面数据
            const longCodeBlocks: Record<string, { content: string; language: string; title: string }> = {};
            newMap.forEach((value, key) => {
              longCodeBlocks[key] = value;
            });
            onUpdatePage({ longCodeBlocks });
            
            console.log('删除原代码块:', codeBlockStart, codeBlockEnd - codeBlockStart);
            // 删除原代码块
            quill.deleteText(codeBlockStart, codeBlockEnd - codeBlockStart, 'silent');
            
            console.log('插入长代码块占位符');
            // 插入长代码块占位符
            quill.insertEmbed(codeBlockStart, 'longcode', {
              id: codeId,
              language: 'text',
              title: '长代码块',
              lines: lineCount
            }, 'silent');
            
            quill.insertText(codeBlockStart + 1, '\n', 'silent');
            
            message.success(`代码块超过100行（${lineCount} 行），为优化编辑器性能已自动转换为长代码块。双击占位符可查看/编辑完整代码。`, 5);
          } else {
            console.log('转换失败: 没有收集到代码内容');
          }
        }, 100);
      }
    };

    quill.on('text-change', handleTextChange);
    return () => {
      quill.off('text-change', handleTextChange);
    };
  }, [page, longCodeMap, onUpdatePage]);

  useEffect(() => {
    // 为工具栏按钮添加中文提示
    const toolbar = document.querySelector('.ql-toolbar');
    if (toolbar) {
      const tooltips: { [key: string]: string } = {
        '.ql-header[value="1"]': '标题 1',
        '.ql-header[value="2"]': '标题 2',
        '.ql-header[value="3"]': '标题 3',
        '.ql-header[value="false"]': '正文',
        '.ql-bold': '粗体',
        '.ql-italic': '斜体',
        '.ql-underline': '下划线',
        '.ql-strike': '删除线',
        '.ql-list[value="ordered"]': '有序列表',
        '.ql-list[value="bullet"]': '无序列表',
        '.ql-color': '文字颜色',
        '.ql-background': '背景颜色',
        '.ql-align': '对齐方式',
        '.ql-link': '插入链接',
        '.ql-image': '插入图片',
        '.ql-code-block': '代码块',
        '.ql-clean': '清除格式'
      };

      Object.entries(tooltips).forEach(([selector, title]) => {
        const element = toolbar.querySelector(selector);
        if (element) {
          element.setAttribute('title', title);
        }
      });

      // 添加书签按钮到工具栏
      const bookmarkContainer = toolbar.querySelector('#bookmark-container');
      if (bookmarkContainer) {
        bookmarkContainer.setAttribute('title', '书签管理');
      }
    }
  }, [page]);

  // ESC键清除格式功能
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 如果搜索栏打开，ESC 关闭搜索栏（由搜索的 useEffect 处理）
        if (showSearch) return;
        
        const selection = quill.getSelection();
        if (selection && selection.length > 0) {
          // 清除选中文本的所有格式
          quill.removeFormat(selection.index, selection.length);
          message.success('已清除格式');
        } else if (selection) {
          // 如果没有选中文本，清除当前光标位置的格式
          const format = quill.getFormat(selection.index);
          Object.keys(format).forEach(key => {
            quill.format(key, false);
          });
          message.success('已清除当前格式');
        }
      }
    };

    const editorElement = quill.root;
    editorElement.addEventListener('keydown', handleKeyDown);

    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [page?.id, showSearch]);

  // ============================================================================
  // 搜索替换功能
  // ============================================================================

  // Ctrl+F / Ctrl+H 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setShowReplace(false);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        setShowSearch(true);
        setShowReplace(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && showSearch) {
        closeSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  // 执行搜索
  const doSearch = useCallback((text: string, matchCase: boolean) => {
    const quill = quillRef.current?.getEditor();
    if (!quill || !text) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      // 清除高亮
      clearSearchHighlights();
      return;
    }

    const content = quill.getText();
    const searchStr = matchCase ? text : text.toLowerCase();
    const contentStr = matchCase ? content : content.toLowerCase();
    const matches: { index: number; length: number }[] = [];
    let startIdx = 0;

    while (startIdx < contentStr.length) {
      const idx = contentStr.indexOf(searchStr, startIdx);
      if (idx === -1) break;
      matches.push({ index: idx, length: text.length });
      startIdx = idx + 1;
    }

    setSearchMatches(matches);
    if (matches.length > 0) {
      setCurrentMatchIndex(0);
      highlightMatches(matches, 0);
      quill.setSelection(matches[0].index, matches[0].length);
    } else {
      setCurrentMatchIndex(-1);
      clearSearchHighlights();
    }
  }, []);

  const clearSearchHighlights = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const len = quill.getLength();
    quill.formatText(0, len, 'background', false, 'silent');
  };

  const highlightMatches = (matches: { index: number; length: number }[], activeIdx: number) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    // 先清除所有高亮
    const len = quill.getLength();
    quill.formatText(0, len, 'background', false, 'silent');
    // 高亮所有匹配
    matches.forEach((m, i) => {
      quill.formatText(m.index, m.length, 'background', i === activeIdx ? '#ff9632' : '#fff3b0', 'silent');
    });
  };

  const goToMatch = (direction: 'next' | 'prev') => {
    if (searchMatches.length === 0) return;
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    let newIdx: number;
    if (direction === 'next') {
      newIdx = (currentMatchIndex + 1) % searchMatches.length;
    } else {
      newIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    }
    setCurrentMatchIndex(newIdx);
    highlightMatches(searchMatches, newIdx);
    const m = searchMatches[newIdx];
    quill.setSelection(m.index, m.length);
    // 滚动到视图
    const bounds = quill.getBounds(m.index);
    if (bounds && quill.root.parentElement) {
      quill.root.parentElement.scrollTop = Math.max(0, bounds.top - 150);
    }
  };

  const handleReplace = () => {
    if (searchMatches.length === 0 || currentMatchIndex < 0) return;
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const m = searchMatches[currentMatchIndex];
    quill.deleteText(m.index, m.length, 'user');
    quill.insertText(m.index, replaceText, 'user');
    // 重新搜索
    doSearch(searchText, caseSensitive);
  };

  const handleReplaceAll = () => {
    if (searchMatches.length === 0) return;
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    // 从后往前替换，避免索引偏移
    const sorted = [...searchMatches].sort((a, b) => b.index - a.index);
    sorted.forEach(m => {
      quill.deleteText(m.index, m.length, 'user');
      quill.insertText(m.index, replaceText, 'user');
    });
    message.success(`已替换 ${sorted.length} 处`);
    doSearch(searchText, caseSensitive);
  };

  const closeSearch = () => {
    setShowSearch(false);
    setShowReplace(false);
    setSearchText('');
    setReplaceText('');
    setSearchMatches([]);
    setCurrentMatchIndex(-1);
    clearSearchHighlights();
  };

  // searchText 变化时自动搜索
  useEffect(() => {
    if (showSearch) {
      doSearch(searchText, caseSensitive);
    }
  }, [searchText, caseSensitive, showSearch, doSearch]);

  // ============================================================================
  // 图片复制修复
  // ============================================================================
  useEffect(() => {
    const editor = editorContainerRef.current;
    if (!editor) return;

    const handleCopy = (e: ClipboardEvent) => {
      const quill = quillRef.current?.getEditor();
      if (!quill) return;

      const selection = quill.getSelection();
      if (!selection || selection.length === 0) return;

      // 获取选中内容的 HTML
      const contents = quill.getContents(selection.index, selection.length);
      let hasImage = false;
      contents.ops?.forEach((op: any) => {
        if (op.insert?.image) hasImage = true;
      });

      if (hasImage) {
        // 获取选中区域的 HTML
        const tempContainer = document.createElement('div');
        const tempQuill = new Quill(tempContainer);
        tempQuill.setContents(contents);
        const html = tempQuill.root.innerHTML;

        e.clipboardData?.setData('text/html', html);
        e.clipboardData?.setData('text/plain', quill.getText(selection.index, selection.length));
        e.preventDefault();
      }
    };

    editor.addEventListener('copy', handleCopy);
    return () => editor.removeEventListener('copy', handleCopy);
  }, []);

  // ============================================================================
  // 表格插入
  // ============================================================================
  const insertTable = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    
    // 使用简单的 HTML 表格插入
    const selection = quill.getSelection();
    const index = selection ? selection.index : quill.getLength();
    
    // 生成表格 HTML
    let tableHTML = '<table style="border-collapse: collapse; width: 100%; margin: 1em 0;">';
    for (let i = 0; i < tableRows; i++) {
      tableHTML += '<tr>';
      for (let j = 0; j < tableCols; j++) {
        const tag = i === 0 ? 'th' : 'td';
        tableHTML += `<${tag} style="border: 1px solid #ddd; padding: 8px 12px; min-width: 50px;">${i === 0 ? `列${j + 1}` : ''}</${tag}>`;
      }
      tableHTML += '</tr>';
    }
    tableHTML += '</table><p><br></p>';
    
    // 插入表格 - 使用 dangerouslyPasteHTML 避免 clipboard.convert 的递归问题
    try {
      quill.clipboard.dangerouslyPasteHTML(index, tableHTML, 'user');
      quill.setSelection(index + 1, 0);
    } catch (error) {
      console.error('Table insertion error:', error);
      message.error('表格插入失败');
      return;
    }
    
    setTablePopoverOpen(false);
    message.success(`已插入 ${tableRows}×${tableCols} 表格`);
  };

  // 插入长代码块
  const insertLongCodeBlock = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    
    // 保存当前光标位置
    const selection = quill.getSelection();
    const cursorPos = selection ? selection.index : quill.getLength();
    setSavedCursorPosition(cursorPos);
    
    setLongCodeContent('');
    setLongCodeLanguage('javascript');
    setLongCodeTitle('长代码块');
    setEditingLongCodeId(null);
    setLongCodeModalOpen(true);
  };

  // 保存长代码块
  const saveLongCode = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const lines = longCodeContent.split('\n').length;
    const codeId = editingLongCodeId || crypto.randomUUID();

    // 保存到 Map
    const newMap = new Map(longCodeMap);
    newMap.set(codeId, {
      content: longCodeContent,
      language: longCodeLanguage,
      title: longCodeTitle || '长代码块'
    });
    setLongCodeMap(newMap);

    // 保存到页面数据
    const longCodeBlocks: Record<string, { content: string; language: string; title: string }> = {};
    newMap.forEach((value, key) => {
      longCodeBlocks[key] = value;
    });
    onUpdatePage({ longCodeBlocks });

    if (editingLongCodeId) {
      // 更新现有代码块
      message.success('长代码块已更新');
    } else {
      // 插入新代码块 - 使用保存的光标位置
      const insertPos = savedCursorPosition !== null ? savedCursorPosition : quill.getLength();
      
      quill.insertEmbed(insertPos, 'longcode', {
        id: codeId,
        language: longCodeLanguage,
        title: longCodeTitle || '长代码块',
        lines: lines
      }, 'user');
      
      quill.insertText(insertPos + 1, '\n', 'user');
      quill.setSelection(insertPos + 2, 0);
      
      message.success(`已插入长代码块（${lines} 行）`);
    }

    setLongCodeModalOpen(false);
    setEditingLongCodeId(null);
    setSavedCursorPosition(null);
  };


  if (!page) {
    return (
      <Content style={{ 
        padding: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa'
      }}>
        <Empty 
          description="请选择或创建一个页面"
          style={{ fontSize: 16 }}
        />
      </Content>
    );
  }

  const addTag = () => {
    if (tagInput.trim() && !page.tags.includes(tagInput.trim())) {
      onUpdatePage({ tags: [...page.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    onUpdatePage({ tags: page.tags.filter(t => t !== tag) });
  };

  // 编辑器右键菜单操作
  const handleCopy = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    
    const selection = quill.getSelection();
    if (!selection || selection.length === 0) {
      message.info('请先选中要复制的内容');
      return;
    }
    
    const html = quill.root.innerHTML;
    const text = quill.getText(selection.index, selection.length);
    
    // 获取选中的HTML
    const tempDiv = document.createElement('div');
    const contents = quill.getContents(selection.index, selection.length);
    const tempQuill = new Quill(tempDiv, { modules: {} });
    tempQuill.setContents(contents);
    const selectedHtml = tempDiv.querySelector('.ql-editor')?.innerHTML || text;
    
    navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([selectedHtml], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      })
    ]).then(() => {
      message.success('已复制');
    }).catch(() => {
      // 降级到纯文本复制
      navigator.clipboard.writeText(text).then(() => {
        message.success('已复制');
      });
    });
  }, []);

  const handleCut = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    
    const selection = quill.getSelection();
    if (!selection || selection.length === 0) {
      message.info('请先选中要剪切的内容');
      return;
    }
    
    const text = quill.getText(selection.index, selection.length);
    
    // 获取选中的HTML
    const tempDiv = document.createElement('div');
    const contents = quill.getContents(selection.index, selection.length);
    const tempQuill = new Quill(tempDiv, { modules: {} });
    tempQuill.setContents(contents);
    const selectedHtml = tempDiv.querySelector('.ql-editor')?.innerHTML || text;
    
    navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([selectedHtml], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      })
    ]).then(() => {
      quill.deleteText(selection.index, selection.length);
      message.success('已剪切');
    }).catch(() => {
      navigator.clipboard.writeText(text).then(() => {
        quill.deleteText(selection.index, selection.length);
        message.success('已剪切');
      });
    });
  }, []);

  const handlePaste = useCallback(async () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        // 优先尝试HTML格式
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          const html = await blob.text();
          const selection = quill.getSelection() || { index: quill.getLength() - 1 };
          quill.clipboard.dangerouslyPasteHTML(selection.index, html);
          message.success('已粘贴');
          return;
        }
        // 降级到纯文本
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain');
          const text = await blob.text();
          const selection = quill.getSelection() || { index: quill.getLength() - 1 };
          quill.insertText(selection.index, text);
          message.success('已粘贴');
          return;
        }
      }
    } catch {
      // 降级方案
      const text = await navigator.clipboard.readText();
      const selection = quill.getSelection() || { index: quill.getLength() - 1 };
      quill.insertText(selection.index, text);
      message.success('已粘贴');
    }
  }, []);

  const handlePastePlainText = useCallback(async () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    
    try {
      const text = await navigator.clipboard.readText();
      const selection = quill.getSelection() || { index: quill.getLength() - 1 };
      quill.insertText(selection.index, text);
      message.success('已粘贴纯文本');
    } catch (err) {
      message.error('粘贴失败');
    }
  }, []);

  const handleRemoveFormat = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    
    const selection = quill.getSelection();
    if (!selection || selection.length === 0) {
      message.info('请先选中要清除格式的内容');
      return;
    }
    
    quill.removeFormat(selection.index, selection.length);
    message.success('已清除格式');
  }, []);

  // 右键菜单相关状态
  const [contextTarget, setContextTarget] = useState<{
    type: 'editor' | 'bookmark' | 'todo';
    bookmark?: Bookmark;
    todo?: TodoItem;
  } | null>(null);

  const editorMenuItems: ContextMenuItem[] = [
    {
      key: 'cut',
      label: '剪切',
      icon: <ScissorOutlined />,
      onClick: handleCut
    },
    {
      key: 'copy',
      label: '复制',
      icon: <CopyOutlined />,
      onClick: handleCopy
    },
    {
      key: 'paste',
      label: '粘贴',
      icon: <EditOutlined />,
      onClick: handlePaste
    },
    {
      key: 'pastePlain',
      label: '粘贴为纯文本',
      icon: <FileTextOutlined />,
      onClick: handlePastePlainText
    },
    { key: 'divider1', label: '', divider: true },
    {
      key: 'removeFormat',
      label: '清除格式',
      icon: <DeleteOutlined />,
      onClick: handleRemoveFormat
    }
  ];

  // 书签右键菜单
  const bookmarkMenuItems: ContextMenuItem[] = [
    {
      key: 'edit',
      label: '编辑书签',
      icon: <EditOutlined />,
      onClick: () => {
        if (contextTarget?.bookmark) {
          setEditingBookmark(contextTarget.bookmark);
          setBookmarkName(contextTarget.bookmark.name);
          setBookmarkNote(contextTarget.bookmark.note || '');
        }
      }
    },
    {
      key: 'jump',
      label: '跳转到书签',
      icon: <BookOutlined />,
      onClick: () => {
        if (contextTarget?.bookmark) {
          jumpToBookmark(contextTarget.bookmark.id);
        }
      }
    },
    { key: 'divider', label: '', divider: true },
    {
      key: 'delete',
      label: '删除书签',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => {
        if (contextTarget?.bookmark) {
          handleDeleteBookmark(contextTarget.bookmark.id);
        }
      }
    }
  ];

  // 待办右键菜单
  const todoMenuItems: ContextMenuItem[] = [
    {
      key: 'toggle',
      label: contextTarget?.todo?.completed ? '标记为未完成' : '标记为已完成',
      icon: <CheckSquareOutlined />,
      onClick: () => {
        if (contextTarget?.todo && onUpdateTodo) {
          onUpdateTodo(contextTarget.todo.id, { completed: !contextTarget.todo.completed });
        }
      }
    },
    {
      key: 'edit',
      label: '编辑待办',
      icon: <EditOutlined />,
      onClick: () => {
        if (contextTarget?.todo) {
          setEditingTodo(contextTarget.todo);
          setTodoTitle(contextTarget.todo.title);
          setTodoDescription(contextTarget.todo.description || '');
          setTodoPriority(contextTarget.todo.priority);
          setTodoCategory(contextTarget.todo.category || '');
          setTodoDueDate(contextTarget.todo.dueDate);
        }
      }
    },
    { key: 'divider', label: '', divider: true },
    {
      key: 'delete',
      label: '删除待办',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => {
        if (contextTarget?.todo && onDeleteTodo) {
          onDeleteTodo(contextTarget.todo.id);
        }
      }
    }
  ];

  // 获取当前应该显示的菜单项
  const getContextMenuItems = (): ContextMenuItem[] => {
    if (!contextTarget) return editorMenuItems;
    switch (contextTarget.type) {
      case 'bookmark':
        return bookmarkMenuItems;
      case 'todo':
        return todoMenuItems;
      default:
        return editorMenuItems;
    }
  };

  const addBookmark = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) {
      console.log('Quill editor not found');
      return;
    }

    // 获取选中的内容
    const selection = quill.getSelection();
    console.log('Selection:', selection);
    
    if (!selection || selection.length === 0) {
      message.warning('请先选中要添加书签的内容');
      return;
    }

    // 如果没有输入名字，使用默认名字
    const bookmarks = page.bookmarks || [];
    const defaultName = bookmarkInput.trim() || `书签${bookmarks.length + 1}`;

    const newBookmark: Bookmark = {
      id: crypto.randomUUID(),
      name: defaultName,
      position: selection.index,
      length: selection.length,
      createdAt: Date.now()
    };

    console.log('Adding bookmark:', newBookmark);

    // 给选中的文本添加书签格式，传递完整的书签信息
    quill.formatText(selection.index, selection.length, 'bookmark', {
      id: newBookmark.id,
      name: newBookmark.name
    });
    
    // 验证格式是否应用
    const format = quill.getFormat(selection.index, selection.length);
    console.log('Applied format:', format);

    onUpdatePage({ bookmarks: [...bookmarks, newBookmark] });
    setBookmarkInput('');
    setBookmarkPopoverOpen(false);
    message.success('书签已添加');
  };

  const jumpToBookmark = (bookmarkId: string) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    // 查找书签在文档中的实际位置
    const delta = quill.getContents();
    let index = 0;
    let found = false;
    let length = 0;

    delta.ops?.forEach((op: any) => {
      if (!found && op.attributes && op.attributes.bookmark === bookmarkId) {
        found = true;
        length = typeof op.insert === 'string' ? op.insert.length : 1;
      } else if (!found) {
        index += typeof op.insert === 'string' ? op.insert.length : 1;
      }
    });

    if (found) {
      quill.setSelection(index, length);
      // 滚动到视图
      const editor = quill.root;
      const selection = quill.getSelection();
      if (selection) {
        const bounds = quill.getBounds(selection.index);
        if (bounds) {
          editor.scrollTop = bounds.top - 100;
        }
      }
      message.success('已跳转到书签位置');
    } else {
      message.warning('未找到书签位置');
    }
  };

  const updateBookmarkNote = () => {
    if (!editingBookmark || !page) return;

    // 验证书签名称不能为空
    const trimmedName = bookmarkName.trim();
    if (!trimmedName) {
      message.warning('书签名称不能为空');
      return;
    }

    const bookmarks = page.bookmarks || [];
    const updatedBookmarks = bookmarks.map(b => 
      b.id === editingBookmark.id 
        ? { ...b, name: trimmedName, note: bookmarkNote }
        : b
    );

    onUpdatePage({ bookmarks: updatedBookmarks });
    
    // 更新书签格式的 title 属性
    const quill = quillRef.current?.getEditor();
    if (quill) {
      const delta = quill.getContents();
      let index = 0;
      delta.ops?.forEach((op: any) => {
        if (op.attributes && op.attributes.bookmark === editingBookmark.id) {
          const length = typeof op.insert === 'string' ? op.insert.length : 1;
          quill.formatText(index, length, 'bookmark', {
            id: editingBookmark.id,
            name: trimmedName,
            note: bookmarkNote
          });
        }
        index += typeof op.insert === 'string' ? op.insert.length : 1;
      });
    }

    message.success('书签已更新');
    setEditingBookmark(null);
    setBookmarkName('');
    setBookmarkNote('');
  };

  const toggleMarker = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    // 定位器标记符号
    const markerSymbol = '📍';

    // 如果已经有定位器，则删除
    if (page.markerPosition !== undefined) {
      // 查找并删除定位器图标
      const content = quill.getText();
      const markerIndex = content.indexOf(markerSymbol);
      if (markerIndex !== -1) {
        // emoji 占用 2 个字符位置，需要删除 2 个字符
        quill.deleteText(markerIndex, 2);
      }
      
      // 删除定位器时，保存当前滚动位置
      const scrollTop = quill.root.parentElement?.scrollTop || 0;
      onUpdatePage({ markerPosition: undefined, scrollPosition: scrollTop });
      message.success('定位器已删除');
    } else {
      // 添加定位器
      const selection = quill.getSelection();
      const position = selection ? selection.index : quill.getLength();

      // 在当前位置插入定位器图标
      quill.insertText(position, markerSymbol, 'user');
      
      // 添加定位器时，清除滚动位置（因为定位器优先）
      onUpdatePage({ markerPosition: position, scrollPosition: undefined });
      message.success('定位器已添加');
    }
  };

  const handleEditBookmark = (bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
    setBookmarkName(bookmark.name);
    setBookmarkNote(bookmark.note || '');
    setContextMenuVisible(false);
  };

  const handleDeleteBookmark = (bookmarkId: string) => {
    const bookmarks = page.bookmarks || [];
    const bookmark = bookmarks.find(b => b.id === bookmarkId);
    
    if (bookmark) {
      // 移除文本的书签格式
      const quill = quillRef.current?.getEditor();
      if (quill) {
        // 查找所有带有该书签ID的文本
        const delta = quill.getContents();
        let index = 0;
        delta.ops?.forEach((op: any) => {
          if (op.attributes && op.attributes.bookmark === bookmarkId) {
            const length = typeof op.insert === 'string' ? op.insert.length : 1;
            quill.formatText(index, length, 'bookmark', false);
          }
          index += typeof op.insert === 'string' ? op.insert.length : 1;
        });
      }
    }
    
    onUpdatePage({ bookmarks: bookmarks.filter(b => b.id !== bookmarkId) });
    setContextMenuVisible(false);
    message.success('书签已删除');
  };

  // 待办相关函数
  const openTodoPopover = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const selection = quill.getSelection();
    if (!selection || selection.length === 0) {
      message.warning('请先选中要关联的文本');
      return;
    }

    // 保存选中范围
    setSelectedRange({ index: selection.index, length: selection.length });
    
    // 获取选中的文本作为默认标题
    const selectedText = quill.getText(selection.index, selection.length).trim();
    setTodoTitle(selectedText.substring(0, 100)); // 限制长度
    setTodoDescription('');
    setTodoPriority('medium');
    setTodoCategory('');
    setTodoDueDate(undefined);
    setLinkExistingTodo(false);
    setSelectedExistingTodoId(undefined);
    setTodoPopoverOpen(true);
  };

  const addTodoFromEditor = () => {
    if (!selectedRange || !page) return;

    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    if (linkExistingTodo && selectedExistingTodoId) {
      // 关联已有待办
      const existingTodo = todos.find(t => t.id === selectedExistingTodoId);
      if (!existingTodo || !onUpdateTodo) return;

      // 更新待办的关联信息
      onUpdateTodo(existingTodo.id, {
        linkedPageId: page.id,
        linkedPosition: selectedRange.index,
        linkedLength: selectedRange.length
      });

      // 给选中的文本添加待办格式
      quill.formatText(selectedRange.index, selectedRange.length, 'todo', {
        id: existingTodo.id,
        title: existingTodo.title,
        completed: existingTodo.completed
      });

      message.success('已关联到现有待办');
    } else {
      // 创建新待办 - 先创建待办到侧边栏，获取返回的待办对象
      if (!todoTitle.trim() || !onAddTodo) return;

      // 创建待办（会立即显示在侧边栏）
      const newTodo = onAddTodo({
        title: todoTitle.trim(),
        description: todoDescription.trim() || undefined,
        completed: false,
        priority: todoPriority,
        category: todoCategory.trim() || undefined,
        dueDate: todoDueDate,
        linkedPageId: page.id,
        linkedPosition: selectedRange.index,
        linkedLength: selectedRange.length
      });

      // 如果待办创建成功，给选中的文本添加待办格式
      if (newTodo) {
        quill.formatText(selectedRange.index, selectedRange.length, 'todo', {
          id: newTodo.id,
          title: newTodo.title,
          completed: false
        });
        message.success('待办已添加到侧边栏并关联到文本');
      }
    }

    setTodoPopoverOpen(false);
    setSelectedRange(null);
  };

  // 获取当前页面关联的待办
  const pageTodos = todos.filter(t => t.linkedPageId === page?.id);

  const jumpToTodo = (todo: TodoItem) => {
    if (!todo.linkedPosition) return;
    
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    quill.setSelection(todo.linkedPosition, todo.linkedLength || 0);
    
    // 滚动到视图
    const bounds = quill.getBounds(todo.linkedPosition);
    if (bounds && quill.root.parentElement) {
      quill.root.parentElement.scrollTop = Math.max(0, bounds.top - 100);
    }
    
    setTodoPopoverOpen(false);
  };

  const updateTodoFromEditor = () => {
    if (!editingTodo || !todoTitle.trim() || !onUpdateTodo) return;

    onUpdateTodo(editingTodo.id, {
      title: todoTitle.trim(),
      description: todoDescription.trim() || undefined,
      priority: todoPriority,
      category: todoCategory.trim() || undefined,
      dueDate: todoDueDate
    });

    setEditingTodo(null);
    message.success('待办已更新');
  };

  // 处理选择对话框的选择
  const handleChoiceBookmark = () => {
    if (pendingBookmark) {
      setEditingBookmark(pendingBookmark);
      setBookmarkName(pendingBookmark.name);
      setBookmarkNote(pendingBookmark.note || '');
    }
    setShowChoiceModal(false);
    setPendingBookmark(null);
    setPendingTodo(null);
  };

  const handleChoiceTodo = () => {
    if (pendingTodo) {
      setEditingTodo(pendingTodo);
      setTodoTitle(pendingTodo.title);
      setTodoDescription(pendingTodo.description || '');
      setTodoPriority(pendingTodo.priority);
      setTodoCategory(pendingTodo.category || '');
      setTodoDueDate(pendingTodo.dueDate);
    }
    setShowChoiceModal(false);
    setPendingBookmark(null);
    setPendingTodo(null);
  };

  // 右键菜单项
  const contextMenuItems: MenuProps['items'] = [
    {
      key: 'edit',
      label: '编辑',
      icon: <EditOutlined />,
      onClick: () => contextMenuBookmark && handleEditBookmark(contextMenuBookmark)
    },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => contextMenuBookmark && handleDeleteBookmark(contextMenuBookmark.id)
    }
  ];

  const bookmarkContent = (
    <div style={{ width: 250 }}>
      <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
        <Input
          value={bookmarkInput}
          onChange={(e) => setBookmarkInput(e.target.value)}
          onPressEnter={addBookmark}
          placeholder="书签名称..."
          size="small"
        />
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={addBookmark}
          size="small"
        >
          添加
        </Button>
      </Space.Compact>

      <List
        size="small"
        dataSource={page.bookmarks || []}
        locale={{ emptyText: '暂无书签' }}
        renderItem={(bookmark) => (
          <List.Item
            style={{ 
              padding: '8px 0',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            actions={[
              <Popconfirm
                key="delete"
                title="确定删除此书签吗？"
                onConfirm={(e) => {
                  e?.stopPropagation();
                  handleDeleteBookmark(bookmark.id);
                }}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            ]}
            onClick={() => jumpToBookmark(bookmark.id)}
          >
            <List.Item.Meta
              title={<span style={{ fontSize: 13 }}>{bookmark.name}</span>}
              description={
                <span style={{ fontSize: 11 }}>
                  位置: {bookmark.position}
                </span>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'blue';
      default: return 'default';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '';
    }
  };

  const todoContent = (
    <div style={{ width: 350 }}>
      {selectedRange ? (
        // 添加待办表单
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 选择创建新待办或关联已有待办 */}
          <div>
            <Checkbox
              checked={linkExistingTodo}
              onChange={(e) => {
                setLinkExistingTodo(e.target.checked);
                if (e.target.checked) {
                  setSelectedExistingTodoId(undefined);
                }
              }}
            >
              关联已有待办
            </Checkbox>
          </div>

          {linkExistingTodo ? (
            // 选择已有待办
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>选择待办 *</div>
              <Select
                value={selectedExistingTodoId}
                onChange={setSelectedExistingTodoId}
                style={{ width: '100%' }}
                placeholder="选择一个待办..."
                showSearch
                optionFilterProp="children"
              >
                {todos
                  .filter(t => !t.linkedPageId || t.linkedPageId === page?.id)
                  .map(todo => (
                    <Select.Option key={todo.id} value={todo.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Checkbox checked={todo.completed} disabled />
                        <span style={{ 
                          flex: 1,
                          textDecoration: todo.completed ? 'line-through' : 'none'
                        }}>
                          {todo.title}
                        </span>
                        <Tag 
                          color={getPriorityColor(todo.priority)} 
                          style={{ margin: 0, fontSize: 11 }}
                        >
                          {getPriorityText(todo.priority)}
                        </Tag>
                      </div>
                    </Select.Option>
                  ))}
              </Select>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={addTodoFromEditor}
                disabled={!selectedExistingTodoId}
                block
                style={{ marginTop: 12 }}
              >
                关联待办
              </Button>
            </div>
          ) : (
            // 创建新待办表单
            <>
              <div>
                <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>标题 *</div>
                <Input
                  value={todoTitle}
                  onChange={(e) => setTodoTitle(e.target.value)}
                  placeholder="输入待办事项标题"
                  maxLength={100}
                />
              </div>

              <div>
                <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>描述</div>
                <TextArea
                  value={todoDescription}
                  onChange={(e) => setTodoDescription(e.target.value)}
                  placeholder="输入详细描述（可选）"
                  rows={2}
                  maxLength={500}
                />
              </div>

              <div>
                <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>优先级</div>
                <Select
                  value={todoPriority}
                  onChange={setTodoPriority}
                  style={{ width: '100%' }}
                  size="small"
                >
                  <Select.Option value="low">
                    <Tag color="blue" style={{ margin: 0 }}>低优先级</Tag>
                  </Select.Option>
                  <Select.Option value="medium">
                    <Tag color="orange" style={{ margin: 0 }}>中优先级</Tag>
                  </Select.Option>
                  <Select.Option value="high">
                    <Tag color="red" style={{ margin: 0 }}>高优先级</Tag>
                  </Select.Option>
                </Select>
              </div>

              <div>
                <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>分类</div>
                <Input
                  value={todoCategory}
                  onChange={(e) => setTodoCategory(e.target.value)}
                  placeholder="输入分类标签（可选）"
                  maxLength={20}
                  size="small"
                />
              </div>

              <div>
                <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>截止日期</div>
                <DatePicker
                  value={todoDueDate ? dayjs(todoDueDate) : null}
                  onChange={(date) => setTodoDueDate(date ? date.valueOf() : undefined)}
                  style={{ width: '100%' }}
                  placeholder="选择截止日期（可选）"
                  format="YYYY-MM-DD"
                  size="small"
                />
              </div>

              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={addTodoFromEditor}
                disabled={!todoTitle.trim()}
                block
              >
                添加待办
              </Button>
            </>
          )}
        </div>
      ) : (
        // 显示当前页面的待办列表
        <div>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>本页待办 ({pageTodos.length})</span>
            <Button 
              type="primary" 
              size="small"
              icon={<PlusOutlined />}
              onClick={openTodoPopover}
            >
              添加
            </Button>
          </div>

          <List
            size="small"
            dataSource={pageTodos}
            locale={{ emptyText: '暂无待办事项，选中文本后点击添加' }}
            renderItem={(todo) => (
              <List.Item
                style={{ 
                  padding: '8px 0',
                  opacity: todo.completed ? 0.6 : 1
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
                  <Checkbox
                    checked={todo.completed}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (onUpdateTodo) {
                        onUpdateTodo(todo.id, { completed: !todo.completed });
                      }
                    }}
                    style={{ marginTop: 2 }}
                  />
                  <div 
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => jumpToTodo(todo)}
                  >
                    <List.Item.Meta
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ 
                            fontSize: 13,
                            textDecoration: todo.completed ? 'line-through' : 'none'
                          }}>
                            {todo.title}
                          </span>
                          <Tag 
                            color={getPriorityColor(todo.priority)} 
                            icon={<FlagOutlined />}
                            style={{ margin: 0, fontSize: 11 }}
                          >
                            {getPriorityText(todo.priority)}
                          </Tag>
                        </div>
                      }
                      description={
                        <span style={{ fontSize: 11 }}>
                          {todo.completed ? '已完成' : '进行中'}
                          {todo.dueDate && ` · ${dayjs(todo.dueDate).format('MM-DD')}`}
                        </span>
                      }
                    />
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* 右键菜单 */}
      <Dropdown
        menu={{ items: contextMenuItems }}
        open={contextMenuVisible}
        onOpenChange={setContextMenuVisible}
      >
        <div
          style={{
            position: 'fixed',
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            width: 0,
            height: 0,
            pointerEvents: 'none'
          }}
        />
      </Dropdown>

      <Modal
        title="编辑书签"
        open={!!editingBookmark}
        onOk={updateBookmarkNote}
        onCancel={() => {
          setEditingBookmark(null);
          setBookmarkName('');
          setBookmarkNote('');
        }}
        okText="保存"
        cancelText="取消"
        width={700}
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>
              书签名称：
            </div>
            <Input
              value={bookmarkName}
              onChange={(e) => setBookmarkName(e.target.value)}
              placeholder="输入书签名称..."
              maxLength={50}
              showCount
            />
          </div>
          
          <div>
            <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>
              书签标注（可选）：
            </div>
            <div style={{ border: '1px solid #d9d9d9', borderRadius: 8 }}>
              <ReactQuill
                value={bookmarkNote}
                onChange={setBookmarkNote}
                theme="snow"
                placeholder="在这里添加书签的标注内容..."
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['link'],
                    ['clean']
                  ]
                }}
                style={{ 
                  minHeight: 200,
                  background: '#fff'
                }}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* 编辑待办对话框 */}
      <Modal
        title="编辑待办事项"
        open={!!editingTodo}
        onOk={updateTodoFromEditor}
        onCancel={() => {
          setEditingTodo(null);
          setTodoTitle('');
          setTodoDescription('');
          setTodoPriority('medium');
          setTodoCategory('');
          setTodoDueDate(undefined);
        }}
        okText="保存"
        cancelText="取消"
        width={500}
      >
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
              标题 *
            </Text>
            <Input
              placeholder="输入待办事项标题"
              value={todoTitle}
              onChange={(e) => setTodoTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
              描述
            </Text>
            <TextArea
              placeholder="输入详细描述（可选）"
              value={todoDescription}
              onChange={(e) => setTodoDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          <div>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
              优先级
            </Text>
            <Select
              value={todoPriority}
              onChange={setTodoPriority}
              style={{ width: '100%' }}
            >
              <Select.Option value="low">
                <Tag color="blue" style={{ margin: 0 }}>低优先级</Tag>
              </Select.Option>
              <Select.Option value="medium">
                <Tag color="orange" style={{ margin: 0 }}>中优先级</Tag>
              </Select.Option>
              <Select.Option value="high">
                <Tag color="red" style={{ margin: 0 }}>高优先级</Tag>
              </Select.Option>
            </Select>
          </div>

          <div>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
              分类
            </Text>
            <Input
              placeholder="输入分类标签（可选）"
              value={todoCategory}
              onChange={(e) => setTodoCategory(e.target.value)}
              maxLength={20}
            />
          </div>

          <div>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
              截止日期
            </Text>
            <DatePicker
              value={todoDueDate ? dayjs(todoDueDate) : null}
              onChange={(date) => setTodoDueDate(date ? date.valueOf() : undefined)}
              style={{ width: '100%' }}
              placeholder="选择截止日期（可选）"
              format="YYYY-MM-DD"
            />
          </div>

          {editingTodo?.completed && (
            <div style={{ 
              padding: '8px 12px', 
              background: '#f0f0f0', 
              borderRadius: 6,
              fontSize: 12,
              color: '#666'
            }}>
              ✓ 此待办已完成
            </div>
          )}
        </div>
      </Modal>

      {/* 长代码块编辑对话框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 32 }}>
            <span>{editingLongCodeId ? "编辑长代码块" : "插入长代码块"}</span>
            <Button
              type="text"
              icon={<ExpandOutlined />}
              onClick={() => {
                setLongCodeModalOpen(false);
                setLongCodeSidebarOpen(true);
              }}
              title="在侧边栏打开"
              style={{ marginLeft: 8 }}
            >
              侧边栏
            </Button>
          </div>
        }
        open={longCodeModalOpen}
        onOk={saveLongCode}
        onCancel={() => {
          setLongCodeModalOpen(false);
          setEditingLongCodeId(null);
        }}
        okText="保存"
        cancelText="取消"
        width={1000}
        style={{ top: 20 }}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}
      >
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
                代码标题
              </Text>
              <Input
                value={longCodeTitle}
                onChange={(e) => setLongCodeTitle(e.target.value)}
                placeholder="长代码块"
                maxLength={50}
              />
            </div>
            <div>
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
                编程语言
              </Text>
              <Select
                value={longCodeLanguage}
                onChange={setLongCodeLanguage}
                style={{ width: 180 }}
                options={[
                  { label: 'JavaScript', value: 'javascript' },
                  { label: 'TypeScript', value: 'typescript' },
                  { label: 'Python', value: 'python' },
                  { label: 'Java', value: 'java' },
                  { label: 'C++', value: 'cpp' },
                  { label: 'C#', value: 'csharp' },
                  { label: 'Go', value: 'go' },
                  { label: 'Rust', value: 'rust' },
                  { label: 'PHP', value: 'php' },
                  { label: 'Ruby', value: 'ruby' },
                  { label: 'HTML', value: 'html' },
                  { label: 'CSS', value: 'css' },
                  { label: 'SQL', value: 'sql' },
                  { label: 'Shell', value: 'shell' },
                  { label: 'JSON', value: 'json' },
                  { label: 'XML', value: 'xml' },
                  { label: 'Markdown', value: 'markdown' },
                  { label: '纯文本', value: 'text' }
                ]}
              />
            </div>
          </div>
          
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 12, color: '#666' }}>
                代码内容
              </Text>
              <Text style={{ fontSize: 12, color: '#999' }}>
                {longCodeContent.split('\n').length} 行 / {Math.round(longCodeContent.length / 1024)}KB
              </Text>
            </div>
            
            {/* 带行号的代码编辑器 */}
            <div style={{
              display: 'flex',
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              overflow: 'hidden',
              background: '#fafafa',
              minHeight: '400px'
            }}>
              {/* 行号列 */}
              <div style={{
                padding: '4px 8px',
                background: '#f5f5f5',
                borderRight: '1px solid #d9d9d9',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: 13,
                lineHeight: 1.5,
                color: '#8c8c8c',
                textAlign: 'right',
                userSelect: 'none',
                minWidth: '40px'
              }}>
                {longCodeContent.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              
              {/* 代码输入区 */}
              <TextArea
                value={longCodeContent}
                onChange={(e) => setLongCodeContent(e.target.value)}
                placeholder="粘贴或输入代码..."
                bordered={false}
                autoSize={{ minRows: 25 }}
                style={{
                  flex: 1,
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: 13,
                  lineHeight: 1.5,
                  resize: 'none',
                  background: '#fff',
                  padding: '4px 8px',
                  overflow: 'hidden'
                }}
                spellCheck={false}
              />
            </div>
          </div>
          
          <div style={{
            padding: '8px 12px',
            background: '#e6f4ff',
            border: '1px solid #91caff',
            borderRadius: 4,
            fontSize: 12,
            color: '#0958d9'
          }}>
            💡 长代码块以占位符形式显示，不会影响编辑器性能。双击占位符可查看/编辑完整代码。
          </div>
        </div>
      </Modal>

      {/* 选择对话框（当同时是书签和待办时） */}
      <Modal
        title="选择操作"
        open={showChoiceModal}
        onCancel={() => {
          setShowChoiceModal(false);
          setPendingBookmark(null);
          setPendingTodo(null);
        }}
        footer={null}
        width={400}
      >
        <div style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 14, color: '#666', display: 'block', marginBottom: 16 }}>
            此文字同时标记了书签和待办，请选择要打开的内容：
          </Text>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Button
              size="large"
              icon={<BookOutlined />}
              onClick={handleChoiceBookmark}
              style={{
                height: 'auto',
                padding: '16px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
                  编辑书签
                </div>
                <div style={{ fontSize: 13, color: '#666' }}>
                  {pendingBookmark?.name}
                </div>
              </div>
            </Button>
            
            <Button
              size="large"
              icon={<CheckSquareOutlined />}
              onClick={handleChoiceTodo}
              style={{
                height: 'auto',
                padding: '16px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
                  编辑待办
                </div>
                <div style={{ fontSize: 13, color: '#666' }}>
                  {pendingTodo?.title}
                </div>
              </div>
            </Button>
          </div>
        </div>
      </Modal>

      {/* 图片预览对话框 */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>图片预览</span>
            <span style={{ fontSize: 14, color: '#666', fontWeight: 'normal' }}>
              缩放: {(imageScale * 100).toFixed(0)}% (滚轮缩放)
            </span>
          </div>
        }
        open={imagePreviewVisible}
        onCancel={() => {
          setImagePreviewVisible(false);
          setImageScale(1);
        }}
        footer={null}
        width="90%"
        style={{ maxWidth: 1400, top: 20 }}
        centered
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          maxHeight: '75vh',
          overflow: 'auto',
          background: '#f5f5f5',
          borderRadius: 8,
          padding: 20
        }}>
          <img 
            src={previewImageUrl} 
            alt="预览" 
            style={{ 
              transform: `scale(${imageScale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.1s ease-out',
              maxWidth: '100%',
              maxHeight: '70vh',
              objectFit: 'contain',
              cursor: 'grab'
            }} 
          />
        </div>
      </Modal>

      <Content style={{ 
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#fff'
      }}>
      {/* 根据page.headerCollapsed决定是否显示标题栏 */}
      {!page?.headerCollapsed && (
        <div style={{ 
          padding: '16px 24px',
          borderBottom: '1px solid #e8e8e8',
          background: '#fafafa',
          transition: 'all 0.3s',
          position: 'relative'
        }}>
          {/* 右上角页面提交按钮 */}
          {noteId && syncConfig?.enabled && page && (
            <div style={{
              position: 'absolute',
              right: 8,
              top: 8,
              zIndex: 10
            }}>
              <PageCommitButton
                noteId={noteId}
                pageId={page.id}
                syncStatus={page.syncStatus}
                autoCommit={syncConfig.autoCommit}
                onCommitSuccess={() => {}}
              />
            </div>
          )}
          
          <Input
            value={page.title}
            onChange={(e) => onUpdatePage({ title: e.target.value })}
            placeholder="输入页面标题..."
            bordered={false}
            style={{ 
              fontSize: 20,
              fontWeight: 600,
              marginBottom: 12,
              padding: 0,
              paddingRight: 80
            }}
          />
          
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <div>
              <Space size={[8, 8]} wrap>
                {page.tags.filter(tag => tag).map(tag => (
                  <Tag 
                    key={tag} 
                    color="blue"
                    closable
                    onClose={() => removeTag(tag)}
                    style={{ fontSize: 13, padding: '4px 8px' }}
                  >
                    {tag}
                  </Tag>
                ))}
              </Space>
            </div>
            
            <Space.Compact style={{ maxWidth: 280 }}>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onPressEnter={addTag}
                placeholder="添加标签..."
                size="small"
              />
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={addTag}
                size="small"
              >
                添加
              </Button>
            </Space.Compact>
          </Space>
        </div>
      )}

      <div 
        ref={editorContainerRef}
        style={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '16px 24px',
          position: 'relative'
        }}
      >
        <div id="toolbar-container">
          <div className="ql-formats">
            <select className="ql-header" defaultValue="">
              <option value="1">标题 1</option>
              <option value="2">标题 2</option>
              <option value="3">标题 3</option>
              <option value="">正文</option>
            </select>
          </div>
          <div className="ql-formats">
            <button className="ql-bold"></button>
            <button className="ql-italic"></button>
            <button className="ql-underline"></button>
            <button className="ql-strike"></button>
          </div>
          <div className="ql-formats">
            <button className="ql-list" value="ordered"></button>
            <button className="ql-list" value="bullet"></button>
          </div>
          <div className="ql-formats">
            <select className="ql-color"></select>
            <select className="ql-background"></select>
          </div>
          <div className="ql-formats">
            <select className="ql-align"></select>
          </div>
          <div className="ql-formats">
            <button className="ql-link"></button>
            <button className="ql-image"></button>
          </div>
          <div className="ql-formats">
            <button className="ql-code-block"></button>
          </div>
          <div className="ql-formats">
            <button 
              type="button"
              onClick={insertLongCodeBlock}
              title="插入长代码/长文本"
              className="custom-longcode-btn"
            >
              <svg viewBox="0 0 18 18" style={{ width: '18px', height: '18px' }}>
                {/* 文件图标 + 代码符号，区别于普通代码块 */}
                <rect x="3" y="1" width="12" height="16" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="6" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1"/>
                <line x1="6" y1="9" x2="12" y2="9" stroke="currentColor" strokeWidth="1"/>
                <line x1="6" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1"/>
              </svg>
            </button>
          </div>
          <div className="ql-formats">
            <button className="ql-clean"></button>
          </div>
          <div className="ql-formats" id="bookmark-container">
            <Popover
              content={bookmarkContent}
              title="书签管理"
              trigger="click"
              open={bookmarkPopoverOpen}
              onOpenChange={setBookmarkPopoverOpen}
              placement="bottom"
            >
              <button 
                type="button"
                style={{
                  width: 'auto',
                  padding: '0 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <BookOutlined />
                <span style={{ fontSize: '12px' }}>
                  {page.bookmarks && page.bookmarks.length > 0 ? `(${page.bookmarks.length})` : ''}
                </span>
              </button>
            </Popover>
          </div>
          <div className="ql-formats" id="todo-container">
            <Popover
              content={todoContent}
              title="待办事项"
              trigger="click"
              open={todoPopoverOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setSelectedRange(null);
                }
                setTodoPopoverOpen(open);
              }}
              placement="bottom"
            >
              <button 
                type="button"
                title="待办事项"
                style={{
                  width: 'auto',
                  padding: '0 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <CheckSquareOutlined />
                <span style={{ fontSize: '12px' }}>
                  {pageTodos.length > 0 ? `(${pageTodos.length})` : ''}
                </span>
              </button>
            </Popover>
          </div>
          <div className="ql-formats">
            <button 
              type="button"
              onClick={toggleMarker}
              title={page.markerPosition !== undefined ? "删除定位器" : "添加定位器"}
              style={{
                width: 'auto',
                padding: '0 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: page.markerPosition !== undefined ? '#e6f4ff' : 'transparent',
                color: page.markerPosition !== undefined ? '#1677ff' : '#595959'
              }}
            >
              {page.markerPosition !== undefined ? <PushpinFilled /> : <PushpinOutlined />}
            </button>
          </div>
          {/* 表格插入 */}
          <div className="ql-formats">
            <Popover
              content={
                <div style={{ width: 200 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 13 }}>行:</span>
                    <InputNumber min={1} max={20} value={tableRows} onChange={v => setTableRows(v || 3)} size="small" style={{ width: 60 }} />
                    <span style={{ fontSize: 13 }}>列:</span>
                    <InputNumber min={1} max={10} value={tableCols} onChange={v => setTableCols(v || 3)} size="small" style={{ width: 60 }} />
                  </div>
                  <Button type="primary" size="small" block onClick={insertTable}>
                    插入 {tableRows}×{tableCols} 表格
                  </Button>
                </div>
              }
              title="插入表格"
              trigger="click"
              open={tablePopoverOpen}
              onOpenChange={setTablePopoverOpen}
              placement="bottom"
            >
              <button type="button" title="插入表格" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#595959', height: 24, padding: '0 8px', borderRadius: 4, fontSize: 14 }}>
                <TableOutlined />
              </button>
            </Popover>
          </div>
          {/* 搜索按钮 */}
          <div className="ql-formats">
            <button
              type="button"
              title="搜索替换 (Ctrl+F / Ctrl+H)"
              onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#595959', height: 24, padding: '0 8px', borderRadius: 4, fontSize: 14 }}
            >
              <SearchOutlined />
            </button>
          </div>
        </div>

        {/* 搜索替换浮动栏 */}
        {showSearch && (
          <div className="editor-search-bar">
            <div className="search-row">
              <input
                ref={searchInputRef}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.shiftKey ? goToMatch('prev') : goToMatch('next'); }
                  if (e.key === 'Escape') closeSearch();
                }}
                placeholder="搜索..."
              />
              <span className="search-count">
                {searchMatches.length > 0 ? `${currentMatchIndex + 1}/${searchMatches.length}` : '无结果'}
              </span>
              <button onClick={() => goToMatch('prev')} title="上一个 (Shift+Enter)"><UpOutlined /></button>
              <button onClick={() => goToMatch('next')} title="下一个 (Enter)"><DownOutlined /></button>
              <button
                onClick={() => setCaseSensitive(!caseSensitive)}
                title="区分大小写"
                style={{ fontWeight: caseSensitive ? 700 : 400, color: caseSensitive ? '#1677ff' : undefined, borderColor: caseSensitive ? '#1677ff' : undefined }}
              >Aa</button>
              <button onClick={() => setShowReplace(!showReplace)} title="替换">
                {showReplace ? '收起' : '替换'}
              </button>
              <button onClick={closeSearch} title="关闭"><CloseOutlined /></button>
            </div>
            {showReplace && (
              <div className="search-row">
                <input
                  value={replaceText}
                  onChange={e => setReplaceText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleReplace(); if (e.key === 'Escape') closeSearch(); }}
                  placeholder="替换为..."
                />
                <button onClick={handleReplace} title="替换当前">替换</button>
                <button className="primary" onClick={handleReplaceAll} title="全部替换">全部</button>
              </div>
            )}
          </div>
        )}
        
        {/* 编辑器区域 - 支持分屏 */}
        <div style={{ 
          display: 'flex', 
          flex: 1, 
          minHeight: 0,
          gap: longCodeSidebarOpen ? 1 : 0
        }}>
          {/* 左侧：富文本编辑器 */}
          <div 
            style={{ 
              flex: longCodeSidebarOpen ? 1 : 1, 
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column'
            }}
            onContextMenu={(e) => {
              // 检查是否点击在编辑器内容区域
              const target = e.target as HTMLElement;
              if (target.closest('.ql-editor') || target.classList.contains('ql-editor')) {
                e.preventDefault();
                
                // 检查是否点击在书签上
                const bookmarkEl = target.closest('.ql-bookmark') as HTMLElement;
                if (bookmarkEl) {
                  const bookmarkId = bookmarkEl.getAttribute('data-bookmark-id');
                  const bookmark = page?.bookmarks?.find(b => b.id === bookmarkId);
                  if (bookmark) {
                    setContextTarget({ type: 'bookmark', bookmark });
                    editorContextMenu.show(e);
                    return;
                  }
                }
                
                // 检查是否点击在待办上
                const todoEl = target.closest('.ql-todo') as HTMLElement;
                if (todoEl) {
                  const todoId = todoEl.getAttribute('data-todo-id');
                  const todo = todos?.find(t => t.id === todoId);
                  if (todo) {
                    setContextTarget({ type: 'todo', todo });
                    editorContextMenu.show(e);
                    return;
                  }
                }
                
                // 普通编辑器区域
                setContextTarget({ type: 'editor' });
                editorContextMenu.show(e);
              }
            }}
          >
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={page.content}
              onChange={(content) => onUpdatePage({ content })}
              modules={{
                toolbar: {
                  container: '#toolbar-container'
                },
                clipboard: {
                  matchVisual: false
                },
                history: {
                  delay: 1000,
                  maxStack: 100,
                  userOnly: true  // 只记录用户操作，忽略 'silent' 和 'api' 源的操作
                }
              }}
              style={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                border: 'none'
              }}
              bounds="#toolbar-container"
              preserveWhitespace={true}
            />
          </div>
          
          {/* 右侧：长代码块分屏编辑器 */}
          {longCodeSidebarOpen && (
            <div style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid #e8e8e8',
              background: '#fff'
            }}>
              {/* 分屏标题栏 */}
              <div style={{
                padding: '8px 12px',
                borderBottom: '1px solid #e8e8e8',
                background: '#fafafa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500 }}>
                    {editingLongCodeId ? "编辑长代码块" : "插入长代码块"}
                  </span>
                  <Button
                    type="text"
                    size="small"
                    icon={<CompressOutlined />}
                    onClick={() => {
                      setLongCodeSidebarOpen(false);
                      setLongCodeModalOpen(true);
                    }}
                    title="在弹窗打开"
                  />
                </div>
                <Space size="small">
                  <Button size="small" onClick={() => {
                    setLongCodeSidebarOpen(false);
                    setEditingLongCodeId(null);
                  }}>取消</Button>
                  <Button type="primary" size="small" onClick={() => {
                    saveLongCode();
                    setLongCodeSidebarOpen(false);
                  }}>保存</Button>
                </Space>
              </div>
              
              {/* 分屏内容 */}
              <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>标题</Text>
                    <Input
                      size="small"
                      value={longCodeTitle}
                      onChange={(e) => setLongCodeTitle(e.target.value)}
                      placeholder="长代码块"
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>语言</Text>
                    <Select
                      size="small"
                      value={longCodeLanguage}
                      onChange={setLongCodeLanguage}
                      style={{ width: 120 }}
                      options={[
                        { label: 'JavaScript', value: 'javascript' },
                        { label: 'TypeScript', value: 'typescript' },
                        { label: 'Python', value: 'python' },
                        { label: 'Java', value: 'java' },
                        { label: 'C++', value: 'cpp' },
                        { label: 'C#', value: 'csharp' },
                        { label: 'Go', value: 'go' },
                        { label: 'Rust', value: 'rust' },
                        { label: 'HTML', value: 'html' },
                        { label: 'CSS', value: 'css' },
                        { label: 'SQL', value: 'sql' },
                        { label: 'Shell', value: 'shell' },
                        { label: 'JSON', value: 'json' },
                        { label: '纯文本', value: 'text' }
                      ]}
                    />
                  </div>
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: '#666' }}>代码内容</Text>
                    <Text style={{ fontSize: 12, color: '#999' }}>
                      {longCodeContent.split('\n').length} 行
                    </Text>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    border: '1px solid #d9d9d9',
                    borderRadius: 4,
                    overflow: 'hidden',
                    flex: 1,
                    minHeight: 0
                  }}>
                    <div style={{
                      padding: '4px 6px',
                      background: '#f5f5f5',
                      borderRight: '1px solid #d9d9d9',
                      fontFamily: 'Consolas, Monaco, monospace',
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: '#8c8c8c',
                      textAlign: 'right',
                      userSelect: 'none',
                      minWidth: '32px',
                      overflowY: 'auto'
                    }}>
                      {longCodeContent.split('\n').map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                    <TextArea
                      value={longCodeContent}
                      onChange={(e) => setLongCodeContent(e.target.value)}
                      placeholder="粘贴或输入代码..."
                      bordered={false}
                      style={{
                        flex: 1,
                        fontFamily: 'Consolas, Monaco, monospace',
                        fontSize: 12,
                        lineHeight: 1.5,
                        resize: 'none',
                        padding: '4px 6px'
                      }}
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Content>

    {/* 编辑器右键菜单 */}
    <ContextMenu
      visible={editorContextMenu.visible}
      x={editorContextMenu.x}
      y={editorContextMenu.y}
      items={getContextMenuItems()}
      onClose={() => {
        editorContextMenu.hide();
        setContextTarget(null);
      }}
    />
    </>
  );
});

Editor.displayName = 'Editor';

export default Editor;

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Layout, Input, Tag, Space, Button, Empty, Popover, List, Popconfirm, message, Modal, Dropdown, Select, DatePicker, Checkbox, Typography } from 'antd';
import { PlusOutlined, BookOutlined, DeleteOutlined, PushpinOutlined, PushpinFilled, EditOutlined, CheckSquareOutlined, FlagOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Page, Bookmark, TodoItem } from '../types';
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

interface EditorProps {
  page?: Page;
  onUpdatePage: (updates: Partial<Page>) => void;
  todos?: TodoItem[];
  onAddTodo?: (todo: Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt'>) => TodoItem | null;
  onUpdateTodo?: (id: string, updates: Partial<TodoItem>) => void;
  onDeleteTodo?: (id: string) => void;
  onJumpToPage?: (pageId: string, position: number) => void;
}

export interface EditorRef {
  jumpToBookmark: (bookmarkId: string) => void;
  jumpToPosition: (position: number) => void;
}

const Editor = forwardRef<EditorRef, EditorProps>(({ page, onUpdatePage, todos = [], onAddTodo, onUpdateTodo, onDeleteTodo, onJumpToPage }, ref) => {
  const [tagInput, setTagInput] = useState('');
  const [bookmarkInput, setBookmarkInput] = useState('');
  const [bookmarkPopoverOpen, setBookmarkPopoverOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [bookmarkName, setBookmarkName] = useState('');
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [contextMenuBookmark, setContextMenuBookmark] = useState<Bookmark | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  
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
      
      // 向上查找，检查是否点击在书签或待办上（支持嵌套元素）
      let bookmarkElement: HTMLElement | null = null;
      let todoElement: HTMLElement | null = null;
      
      let current: HTMLElement | null = target;
      while (current && current !== editorContainerRef.current) {
        if (current.classList.contains('ql-bookmark')) {
          bookmarkElement = current;
        }
        if (current.classList.contains('ql-todo')) {
          todoElement = current;
        }
        if (bookmarkElement || todoElement) break;
        current = current.parentElement;
      }
      
      const clickedElement = bookmarkElement || todoElement;
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
  }, [page?.id, todos?.length]); // 减少依赖项，只依赖 ID 和长度

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
  }, [page?.id]);



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
      <div style={{ 
        padding: headerCollapsed ? '8px 24px' : '16px 24px',
        borderBottom: '1px solid #e8e8e8',
        background: '#fafafa',
        transition: 'all 0.3s',
        position: 'relative'
      }}>
        {/* 折叠按钮 */}
        <Button
          type="text"
          size="small"
          onClick={() => setHeaderCollapsed(!headerCollapsed)}
          style={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 10,
            fontSize: 12,
            color: '#999'
          }}
          title={headerCollapsed ? '展开标题栏' : '折叠标题栏'}
        >
          {headerCollapsed ? '展开 ▼' : '折叠 ▲'}
        </Button>
        
        {headerCollapsed ? (
          // 折叠状态：只显示标题
          <div style={{ 
            fontSize: 16,
            fontWeight: 600,
            color: '#333',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            paddingRight: 80
          }}>
            {page.title || '未命名页面'}
          </div>
        ) : (
          // 展开状态：显示完整标题栏
          <>
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
                  {page.tags.map(tag => (
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
          </>
        )}
      </div>

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
        </div>
        
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={page.content}
          onChange={(content) => onUpdatePage({ content })}
          modules={{
            toolbar: {
              container: '#toolbar-container'
            }
          }}
          style={{ 
            height: 'calc(100% - 50px)',
            display: 'flex',
            flexDirection: 'column',
            border: 'none'
          }}
        />
      </div>
    </Content>
    </>
  );
});

Editor.displayName = 'Editor';

export default Editor;

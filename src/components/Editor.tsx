import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Layout, Input, Tag, Space, Button, Empty, Popover, List, Popconfirm, message, Modal, Dropdown } from 'antd';
import { PlusOutlined, BookOutlined, DeleteOutlined, PushpinOutlined, PushpinFilled, EditOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Page, Bookmark } from '../types';

const { Content } = Layout;

// 从 HTML 中提取纯文本
const stripHtml = (html: string): string => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

// 在组件外部注册自定义格式
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

// 注册自定义格式
Quill.register(BookmarkBlot);
console.log('✅ Bookmark format registered');

interface EditorProps {
  page?: Page;
  onUpdatePage: (updates: Partial<Page>) => void;
}

export interface EditorRef {
  jumpToBookmark: (bookmarkId: string) => void;
}

const Editor = forwardRef<EditorRef, EditorProps>(({ page, onUpdatePage }, ref) => {
  const [tagInput, setTagInput] = useState('');
  const [bookmarkInput, setBookmarkInput] = useState('');
  const [bookmarkPopoverOpen, setBookmarkPopoverOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [bookmarkName, setBookmarkName] = useState('');
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [contextMenuBookmark, setContextMenuBookmark] = useState<Bookmark | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const quillRef = useRef<ReactQuill>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // 暴露跳转方法给父组件
  useImperativeHandle(ref, () => ({
    jumpToBookmark: (bookmarkId: string) => {
      jumpToBookmark(bookmarkId);
    }
  }));

  // 监听书签双击和右键事件
  useEffect(() => {
    let clickTimer: NodeJS.Timeout | null = null;
    let clickCount = 0;

    const handleBookmarkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('ql-bookmark')) {
        const bookmarkId = target.getAttribute('data-bookmark-id');
        if (bookmarkId && page) {
          const bookmark = page.bookmarks?.find(b => b.id === bookmarkId);
          if (bookmark) {
            clickCount++;
            
            if (clickCount === 1) {
              // 第一次点击，等待可能的第二次点击
              clickTimer = setTimeout(() => {
                clickCount = 0;
              }, 300);
            } else if (clickCount === 2) {
              // 双击，打开编辑对话框
              if (clickTimer) clearTimeout(clickTimer);
              clickCount = 0;
              setEditingBookmark(bookmark);
              setBookmarkName(bookmark.name);
              setBookmarkNote(bookmark.note || '');
            }
          }
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
      editor.addEventListener('click', handleBookmarkClick);
      editor.addEventListener('contextmenu', handleBookmarkContextMenu);
      document.addEventListener('click', handleClickOutside);
      
      return () => {
        editor.removeEventListener('click', handleBookmarkClick);
        editor.removeEventListener('contextmenu', handleBookmarkContextMenu);
        document.removeEventListener('click', handleClickOutside);
        if (clickTimer) clearTimeout(clickTimer);
      };
    }
  }, [page]);

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

  // 页面加载时自动跳转到定位器位置
  useEffect(() => {
    if (!page || page.markerPosition === undefined) return;

    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    // 延迟跳转，确保内容已加载
    const timer = setTimeout(() => {
      const content = quill.getText();
      const markerIndex = content.indexOf('📍');
      
      if (markerIndex !== -1) {
        quill.setSelection(markerIndex, 0);
        const bounds = quill.getBounds(markerIndex);
        if (bounds) {
          quill.root.scrollTop = bounds.top - 100;
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [page?.id]); // 只在页面切换时触发

  // 监听内容变化，检测定位器是否被删除
  useEffect(() => {
    if (!page || page.markerPosition === undefined) return;

    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const handleTextChange = () => {
      const content = quill.getText();
      const markerIndex = content.indexOf('📍');
      
      // 如果定位器图标被删除，清除 markerPosition
      if (markerIndex === -1 && page.markerPosition !== undefined) {
        onUpdatePage({ markerPosition: undefined });
      }
    };

    quill.on('text-change', handleTextChange);
    return () => {
      quill.off('text-change', handleTextChange);
    };
  }, [page?.markerPosition]);

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

    // 如果已经有定位器，则删除
    if (page.markerPosition !== undefined) {
      // 查找并删除定位器图标
      const content = quill.getText();
      const markerIndex = content.indexOf('📍');
      if (markerIndex !== -1) {
        quill.deleteText(markerIndex, 1);
      }
      onUpdatePage({ markerPosition: undefined });
      message.success('定位器已删除');
    } else {
      // 添加定位器
      const selection = quill.getSelection();
      const position = selection ? selection.index : quill.getLength();

      // 在当前位置插入定位器图标
      quill.insertText(position, '📍', 'user');
      
      onUpdatePage({ markerPosition: position });
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

      <Content style={{ 
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#fff'
      }}>
      <div style={{ 
        padding: '24px 32px',
        borderBottom: '1px solid #e8e8e8',
        background: '#fafafa'
      }}>
        <Input
          value={page.title}
          onChange={(e) => onUpdatePage({ title: e.target.value })}
          placeholder="输入页面标题..."
          bordered={false}
          style={{ 
            fontSize: 24,
            fontWeight: 600,
            marginBottom: 16,
            padding: 0
          }}
        />
        
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
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
          
          <Space.Compact style={{ maxWidth: 300 }}>
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

      <div 
        ref={editorContainerRef}
        style={{ 
          flex: 1,
          overflow: 'auto',
          padding: '24px 32px',
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
            height: 'calc(100% - 42px)',
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

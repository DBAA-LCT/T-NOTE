import { useState } from 'react';
import { Typography, List, Empty, Button, Popconfirm, Collapse, Dropdown, Modal, Input, message } from 'antd';
import { BookOutlined, DeleteOutlined, RightOutlined, EditOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Page, Bookmark } from '../types';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const { Text } = Typography;
const { Panel } = Collapse;

// 从 HTML 中提取纯文本
const stripHtml = (html: string): string => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

interface BookmarkPanelProps {
  pages: Page[];
  currentPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onJumpToBookmark: (pageId: string, position: number, length: number) => void;
  onDeleteBookmark: (pageId: string, bookmarkId: string) => void;
  onUpdateBookmark?: (pageId: string, bookmarkId: string, updates: Partial<Bookmark>) => void;
}

export default function BookmarkPanel({
  pages,
  currentPageId,
  onSelectPage,
  onJumpToBookmark,
  onDeleteBookmark,
  onUpdateBookmark
}: BookmarkPanelProps) {
  // 获取所有包含书签的页面
  const pagesWithBookmarks = pages.filter(page => page.bookmarks && page.bookmarks.length > 0);

  // 默认展开当前页面
  const [activeKeys, setActiveKeys] = useState<string[]>(
    currentPageId && pages.find(p => p.id === currentPageId)?.bookmarks?.length 
      ? [currentPageId] 
      : []
  );

  // 编辑书签状态
  const [editingBookmark, setEditingBookmark] = useState<{ pageId: string; bookmark: Bookmark } | null>(null);
  const [bookmarkName, setBookmarkName] = useState('');
  const [bookmarkNote, setBookmarkNote] = useState('');

  // 右键菜单状态
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuBookmark, setContextMenuBookmark] = useState<{ pageId: string; bookmark: Bookmark } | null>(null);

  const handleEditBookmark = (pageId: string, bookmark: Bookmark) => {
    setEditingBookmark({ pageId, bookmark });
    setBookmarkName(bookmark.name);
    setBookmarkNote(bookmark.note || '');
    setContextMenuVisible(false);
  };

  const handleUpdateBookmark = () => {
    if (!editingBookmark) return;

    const trimmedName = bookmarkName.trim();
    if (!trimmedName) {
      message.warning('书签名称不能为空');
      return;
    }

    if (onUpdateBookmark) {
      onUpdateBookmark(editingBookmark.pageId, editingBookmark.bookmark.id, {
        name: trimmedName,
        note: bookmarkNote
      });
    }

    message.success('书签已更新');
    setEditingBookmark(null);
    setBookmarkName('');
    setBookmarkNote('');
  };

  const getContextMenuItems = (pageId: string, bookmark: Bookmark): MenuProps['items'] => [
    {
      key: 'edit',
      label: '编辑',
      icon: <EditOutlined />,
      onClick: () => handleEditBookmark(pageId, bookmark)
    },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => onDeleteBookmark(pageId, bookmark.id)
    }
  ];

  return (
    <>
      {/* 编辑书签对话框 */}
      <Modal
        title="编辑书签"
        open={!!editingBookmark}
        onOk={handleUpdateBookmark}
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

      <div style={{ 
        height: '100%',
        overflow: 'auto',
        padding: '16px'
      }}>
        <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 16 }}>
          所有书签
        </Text>

        {pagesWithBookmarks.length === 0 ? (
          <Empty 
            image={<BookOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
            description="暂无书签"
            style={{ marginTop: 60 }}
          />
        ) : (
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(keys as string[])}
            expandIcon={({ isActive }) => <RightOutlined rotate={isActive ? 90 : 0} />}
            ghost
            style={{ background: 'transparent' }}
          >
            {pagesWithBookmarks.map(page => (
              <Panel
                key={page.id}
                header={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text 
                      strong 
                      style={{ 
                        color: currentPageId === page.id ? '#1677ff' : '#262626',
                        flex: 1
                      }}
                      ellipsis
                    >
                      {page.title}
                    </Text>
                    <Text 
                      type="secondary" 
                      style={{ 
                        fontSize: 12,
                        marginLeft: 8
                      }}
                    >
                      {page.bookmarks?.length || 0}
                    </Text>
                  </div>
                }
                style={{
                  marginBottom: 8,
                  background: '#fff',
                  borderRadius: 8,
                  border: currentPageId === page.id ? '1px solid #1677ff' : '1px solid #e8e8e8',
                  overflow: 'hidden'
                }}
              >
                <List
                  size="small"
                  dataSource={page.bookmarks || []}
                  renderItem={(bookmark) => (
                    <Dropdown
                      menu={{ items: getContextMenuItems(page.id, bookmark) }}
                      trigger={['contextMenu']}
                    >
                      <List.Item
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: 'none',
                          transition: 'background 0.3s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f5f5f5';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                        actions={[
                          <Button
                            key="edit"
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditBookmark(page.id, bookmark);
                            }}
                          />,
                          <Popconfirm
                            key="delete"
                            title="确定删除此书签吗？"
                            onConfirm={(e) => {
                              e?.stopPropagation();
                              onDeleteBookmark(page.id, bookmark.id);
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
                        onDoubleClick={() => {
                          if (currentPageId !== page.id) {
                            onSelectPage(page.id);
                          }
                          setTimeout(() => {
                            onJumpToBookmark(page.id, bookmark.position, bookmark.length);
                          }, 100);
                        }}
                      >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <BookOutlined style={{ color: '#fa8c16', fontSize: 12, flexShrink: 0 }} />
                          <Text style={{ fontSize: 13 }} ellipsis>{bookmark.name}</Text>
                        </div>
                        {bookmark.note && (
                          <div style={{ 
                            fontSize: 12, 
                            color: '#8c8c8c',
                            marginBottom: 4,
                            padding: '4px 8px',
                            background: '#f5f5f5',
                            borderRadius: 4,
                            maxHeight: 60,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            wordBreak: 'break-word'
                          }}>
                            {stripHtml(bookmark.note)}
                          </div>
                        )}
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          位置: {bookmark.position}
                        </Text>
                      </div>
                    </List.Item>
                    </Dropdown>
                  )}
                />
              </Panel>
            ))}
          </Collapse>
        )}
      </div>
    </>
  );
}

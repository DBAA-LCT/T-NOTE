import { useState } from 'react';
import { Button, List, Tag, Typography, Space, Tooltip, message } from 'antd';
import { PlusOutlined, DeleteOutlined, BookOutlined, EditOutlined, CopyOutlined, ExportOutlined } from '@ant-design/icons';
import { Page } from '../types';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import { useContextMenu } from '../hooks/useContextMenu';

const { Text } = Typography;

interface PagesPanelProps {
  pages: Page[];
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onDeletePage: (id: string) => void;
  onDuplicatePage?: (id: string) => void;
  onRenamePage?: (id: string) => void;
}

export default function PagesPanel({
  pages, currentPageId, onSelectPage, onAddPage, onDeletePage, onDuplicatePage, onRenamePage
}: PagesPanelProps) {
  const contextMenu = useContextMenu();
  const [contextPage, setContextPage] = useState<Page | null>(null);

  const handleContextMenu = (e: React.MouseEvent, page: Page) => {
    e.preventDefault();
    e.stopPropagation();
    setContextPage(page);
    contextMenu.show(e);
  };

  const menuItems: ContextMenuItem[] = [
    {
      key: 'open',
      label: '打开',
      icon: <BookOutlined />,
      onClick: () => contextPage && onSelectPage(contextPage.id)
    },
    {
      key: 'rename',
      label: '重命名',
      icon: <EditOutlined />,
      onClick: () => {
        if (contextPage && onRenamePage) {
          onRenamePage(contextPage.id);
        } else {
          message.info('请在编辑器中修改标题');
        }
      }
    },
    {
      key: 'duplicate',
      label: '复制页面',
      icon: <CopyOutlined />,
      onClick: () => {
        if (contextPage && onDuplicatePage) {
          onDuplicatePage(contextPage.id);
        } else {
          message.info('暂不支持复制页面');
        }
      }
    },
    { key: 'divider1', label: '', divider: true },
    {
      key: 'export',
      label: '导出',
      icon: <ExportOutlined />,
      onClick: () => message.info('导出功能开发中')
    },
    { key: 'divider2', label: '', divider: true },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => contextPage && onDeletePage(contextPage.id)
    }
  ];

  return (
    <div style={{ 
      height: '100%',
      overflow: 'auto',
      padding: '16px'
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>页面列表</Text>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={onAddPage}
            size="small"
          >
            新建
          </Button>
        </div>

        <List
          dataSource={pages}
          locale={{ emptyText: '暂无页面' }}
          renderItem={(page) => (
            <List.Item
              key={page.id}
              onClick={() => onSelectPage(page.id)}
              onContextMenu={(e) => handleContextMenu(e, page)}
              style={{
                cursor: 'pointer',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '8px',
                background: currentPageId === page.id ? '#e6f4ff' : '#fff',
                border: currentPageId === page.id ? '1px solid #1677ff' : '1px solid #e8e8e8',
                transition: 'all 0.3s'
              }}
            >
              <div style={{ width: '100%' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 8
                }}>
                  <Text strong ellipsis style={{ flex: 1 }}>
                    {page.title}
                  </Text>
                  <Space size={4}>
                    {page.bookmarks && page.bookmarks.length > 0 && (
                      <Tooltip title={`${page.bookmarks.length} 个书签`}>
                        <Tag 
                          icon={<BookOutlined />} 
                          color="orange"
                          style={{ margin: 0, fontSize: 12 }}
                        >
                          {page.bookmarks.length}
                        </Tag>
                      </Tooltip>
                    )}
                  </Space>
                </div>
                
                {page.tags.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {page.tags.map(tag => (
                      <Tag key={tag} color="blue" style={{ marginBottom: 4 }}>
                        {tag}
                      </Tag>
                    ))}
                  </div>
                )}
                
                {page.bookmarks && page.bookmarks.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {page.bookmarks.slice(0, 3).map(bookmark => (
                      <Tag 
                        key={bookmark.id} 
                        icon={<BookOutlined />}
                        color="orange"
                        style={{ marginBottom: 4, fontSize: 11 }}
                      >
                        {bookmark.name}
                      </Tag>
                    ))}
                    {page.bookmarks.length > 3 && (
                      <Tag color="orange" style={{ marginBottom: 4, fontSize: 11 }}>
                        +{page.bookmarks.length - 3}
                      </Tag>
                    )}
                  </div>
                )}
                
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(page.updatedAt).toLocaleString('zh-CN')}
                </Text>
              </div>
            </List.Item>
          )}
        />

        <ContextMenu
          visible={contextMenu.visible}
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={contextMenu.hide}
        />
    </div>
  );
}

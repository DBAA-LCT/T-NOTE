import { useState } from 'react';
import { Layout, Button, Input, List, Tag, Space, Typography, Divider } from 'antd';
import { 
  PlusOutlined, 
  SaveOutlined, 
  FolderOpenOutlined, 
  DeleteOutlined,
  FileTextOutlined,
  SearchOutlined,
  SaveFilled,
  EditOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { Page } from '../types';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import { useContextMenu } from '../hooks/useContextMenu';

const { Sider } = Layout;
const { Search } = Input;
const { Title, Text } = Typography;

interface SidebarProps {
  pages: Page[];
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onDeletePage: (id: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpen: () => void;
  searchTag: string;
  onSearchTagChange: (tag: string) => void;
  noteName: string;
  onUpdateNoteName: (name: string) => void;
}

export default function Sidebar({
  pages, currentPageId, onSelectPage, onAddPage, onDeletePage,
  onSave, onSaveAs, onOpen, searchTag, onSearchTagChange, noteName, onUpdateNoteName
}: SidebarProps) {
  const contextMenu = useContextMenu();
  const [contextPage, setContextPage] = useState<Page | null>(null);

  const handlePageContextMenu = (e: React.MouseEvent, page: Page) => {
    e.preventDefault();
    e.stopPropagation();
    setContextPage(page);
    contextMenu.show(e);
  };

  const pageMenuItems: ContextMenuItem[] = [
    {
      key: 'open',
      label: '打开',
      icon: <FileTextOutlined />,
      onClick: () => contextPage && onSelectPage(contextPage.id)
    },
    {
      key: 'edit',
      label: '编辑标题',
      icon: <EditOutlined />,
      onClick: () => contextPage && onSelectPage(contextPage.id)
    },
    { key: 'divider', label: '', divider: true },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => contextPage && onDeletePage(contextPage.id)
    }
  ];

  return (
    <Sider 
      width={280} 
      style={{ 
        background: '#fff',
        borderRight: '1px solid #f0f0f0',
        height: '100vh',
        overflow: 'auto'
      }}
    >
      <div style={{ padding: '16px' }}>
        <Title level={4} style={{ margin: '0 0 16px 0' }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          {noteName}
        </Title>
        
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Space.Compact style={{ width: '100%' }}>
            <Button icon={<FolderOpenOutlined />} onClick={onOpen} style={{ flex: 1 }}>
              打开
            </Button>
            <Button icon={<SaveOutlined />} onClick={onSave} type="primary" style={{ flex: 1 }}>
              保存
            </Button>
          </Space.Compact>
          
          <Button 
            icon={<SaveFilled />} 
            onClick={onSaveAs} 
            style={{ width: '100%' }}
          >
            另存为
          </Button>
        </Space>

        <Divider style={{ margin: '16px 0' }} />

        <Button 
          type="dashed" 
          icon={<PlusOutlined />} 
          onClick={onAddPage}
          block
          style={{ marginBottom: 12 }}
        >
          新建页面
        </Button>

        <Search
          placeholder="按标签搜索..."
          value={searchTag}
          onChange={(e) => onSearchTagChange(e.target.value)}
          prefix={<SearchOutlined />}
          allowClear
          style={{ marginBottom: 12 }}
        />

        <List
          dataSource={pages}
          locale={{ emptyText: '暂无页面' }}
          renderItem={(page) => (
            <List.Item
              key={page.id}
              onClick={() => onSelectPage(page.id)}
              onContextMenu={(e) => handlePageContextMenu(e, page)}
              style={{
                cursor: 'pointer',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '8px',
                background: currentPageId === page.id ? '#e6f4ff' : '#fafafa',
                border: currentPageId === page.id ? '1px solid #1677ff' : '1px solid #f0f0f0',
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
                </div>
                
                {page.tags.length > 0 && (
                  <div>
                    {page.tags.map(tag => (
                      <Tag key={tag} color="blue" style={{ marginBottom: 4 }}>
                        {tag}
                      </Tag>
                    ))}
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
          items={pageMenuItems}
          onClose={contextMenu.hide}
        />
      </div>
    </Sider>
  );
}

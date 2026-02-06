import { Layout, Button, List, Tag, Popconfirm, Typography, Space, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, BookOutlined } from '@ant-design/icons';
import { Page } from '../types';

const { Sider } = Layout;
const { Text } = Typography;

interface PagesPanelProps {
  pages: Page[];
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onDeletePage: (id: string) => void;
}

export default function PagesPanel({
  pages, currentPageId, onSelectPage, onAddPage, onDeletePage
}: PagesPanelProps) {
  return (
    <Sider 
      width={280} 
      style={{ 
        background: '#fafafa',
        borderRight: '1px solid #e8e8e8',
        height: '100vh',
        overflow: 'auto'
      }}
    >
      <div style={{ padding: '16px' }}>
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
                    <Popconfirm
                      title="确定删除这个页面吗？"
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        onDeletePage(page.id);
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
      </div>
    </Sider>
  );
}

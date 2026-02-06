import { Layout, Input, List, Tag, Typography, Tooltip } from 'antd';
import { SearchOutlined, BookOutlined } from '@ant-design/icons';
import { Page } from '../types';

const { Sider } = Layout;
const { Search } = Input;
const { Text } = Typography;

interface SearchPanelProps {
  pages: Page[];
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
  searchTag: string;
  onSearchTagChange: (tag: string) => void;
}

export default function SearchPanel({
  pages, currentPageId, onSelectPage, searchTag, onSearchTagChange
}: SearchPanelProps) {
  const filteredPages = searchTag
    ? pages.filter(p => p.tags.some(t => t.includes(searchTag)))
    : pages;

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
        <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 16 }}>
          搜索页面
        </Text>

        <Search
          placeholder="按标签搜索..."
          value={searchTag}
          onChange={(e) => onSearchTagChange(e.target.value)}
          prefix={<SearchOutlined />}
          allowClear
          style={{ marginBottom: 16 }}
        />

        <List
          dataSource={filteredPages}
          locale={{ emptyText: searchTag ? '未找到匹配的页面' : '输入标签进行搜索' }}
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
                <Text strong ellipsis style={{ display: 'block', marginBottom: 8 }}>
                  {page.title}
                  {page.bookmarks && page.bookmarks.length > 0 && (
                    <Tooltip title={`${page.bookmarks.length} 个书签`}>
                      <Tag 
                        icon={<BookOutlined />} 
                        color="orange"
                        style={{ marginLeft: 8, fontSize: 11 }}
                      >
                        {page.bookmarks.length}
                      </Tag>
                    </Tooltip>
                  )}
                </Text>
                
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
                    {page.bookmarks.slice(0, 2).map(bookmark => (
                      <Tag 
                        key={bookmark.id} 
                        icon={<BookOutlined />}
                        color="orange"
                        style={{ marginBottom: 4, fontSize: 11 }}
                      >
                        {bookmark.name}
                      </Tag>
                    ))}
                    {page.bookmarks.length > 2 && (
                      <Tag color="orange" style={{ marginBottom: 4, fontSize: 11 }}>
                        +{page.bookmarks.length - 2}
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

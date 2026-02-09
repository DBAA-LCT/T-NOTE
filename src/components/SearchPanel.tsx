import { useState } from 'react';
import { Input, List, Tag, Typography, Select, Space, Empty } from 'antd';
import { SearchOutlined, FileTextOutlined, TagOutlined, AlignLeftOutlined, BookOutlined } from '@ant-design/icons';
import { Page } from '../types';

const { Search } = Input;
const { Text } = Typography;

interface SearchResult {
  page: Page;
  matchType: 'title' | 'tag' | 'content' | 'bookmark';
  matchText?: string;
  contentPosition?: number;
  bookmarkId?: string;
}

interface SearchPanelProps {
  pages: Page[];
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
  onJumpToPosition?: (pageId: string, position: number) => void;
  onJumpToBookmark?: (pageId: string, position: number, length: number) => void;
  searchTag: string;
  onSearchTagChange: (tag: string) => void;
}

// 从 HTML 中提取纯文本
const stripHtml = (html: string): string => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

export default function SearchPanel({
  pages, currentPageId, onSelectPage, onJumpToPosition, onJumpToBookmark, searchTag, onSearchTagChange
}: SearchPanelProps) {
  const [searchText, setSearchText] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'title' | 'tag' | 'content' | 'bookmark'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // 获取所有标签
  const allTags = Array.from(new Set(pages.flatMap(p => p.tags))).sort();

  // 搜索逻辑
  const searchResults: SearchResult[] = [];
  
  if (searchText.trim()) {
    const query = searchText.toLowerCase();
    
    pages.forEach(page => {
      // 搜索标题
      if ((searchType === 'all' || searchType === 'title') && page.title.toLowerCase().includes(query)) {
        searchResults.push({
          page,
          matchType: 'title',
          matchText: page.title
        });
        return;
      }
      
      // 搜索标签
      if ((searchType === 'all' || searchType === 'tag') && page.tags.some(t => t.toLowerCase().includes(query))) {
        const matchedTag = page.tags.find(t => t.toLowerCase().includes(query));
        searchResults.push({
          page,
          matchType: 'tag',
          matchText: matchedTag
        });
        return;
      }
      
      // 搜索书签
      if ((searchType === 'all' || searchType === 'bookmark') && page.bookmarks && page.bookmarks.length > 0) {
        const matchedBookmark = page.bookmarks.find(b => b.name.toLowerCase().includes(query));
        if (matchedBookmark) {
          searchResults.push({
            page,
            matchType: 'bookmark',
            matchText: matchedBookmark.name,
            contentPosition: matchedBookmark.position,
            bookmarkId: matchedBookmark.id
          });
          return;
        }
      }
      
      // 搜索内容
      if (searchType === 'all' || searchType === 'content') {
        const content = stripHtml(page.content).toLowerCase();
        const position = content.indexOf(query);
        if (position !== -1) {
          // 提取匹配位置周围的文本作为预览
          const start = Math.max(0, position - 30);
          const end = Math.min(content.length, position + query.length + 30);
          const preview = content.substring(start, end);
          searchResults.push({
            page,
            matchType: 'content',
            matchText: preview,
            contentPosition: position
          });
        }
      }
    });
  }

  // 按标签筛选
  const tagFilteredPages = selectedTag 
    ? pages.filter(p => p.tags.includes(selectedTag))
    : [];

  const handleResultClick = (result: SearchResult) => {
    onSelectPage(result.page.id);
    
    // 如果是书签匹配，跳转到书签位置
    if (result.matchType === 'bookmark' && result.contentPosition !== undefined && onJumpToBookmark) {
      const bookmark = result.page.bookmarks?.find(b => b.id === result.bookmarkId);
      if (bookmark) {
        setTimeout(() => {
          onJumpToBookmark(result.page.id, bookmark.position, bookmark.length);
        }, 100);
      }
    }
    // 如果是内容匹配，跳转到内容位置
    else if (result.matchType === 'content' && result.contentPosition !== undefined && onJumpToPosition) {
      setTimeout(() => {
        onJumpToPosition(result.page.id, result.contentPosition!);
      }, 100);
    }
  };

  const getMatchIcon = (type: 'title' | 'tag' | 'content' | 'bookmark') => {
    switch (type) {
      case 'title': return <FileTextOutlined style={{ color: '#1677ff' }} />;
      case 'tag': return <TagOutlined style={{ color: '#52c41a' }} />;
      case 'content': return <AlignLeftOutlined style={{ color: '#faad14' }} />;
      case 'bookmark': return <BookOutlined style={{ color: '#fa8c16' }} />;
    }
  };

  const getMatchLabel = (type: 'title' | 'tag' | 'content' | 'bookmark') => {
    switch (type) {
      case 'title': return '标题';
      case 'tag': return '标签';
      case 'content': return '内容';
      case 'bookmark': return '书签';
    }
  };

  // 高亮匹配的文本
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;
    
    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);
    
    return (
      <>
        {before}
        <span style={{ background: '#fff566', fontWeight: 600 }}>{match}</span>
        {after}
      </>
    );
  };

  return (
    <div style={{ 
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
        <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 12 }}>
          搜索
        </Text>

        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Select
            value={searchType}
            onChange={setSearchType}
            style={{ width: '100%' }}
            size="small"
            options={[
              { label: '全部', value: 'all' },
              { label: '标题', value: 'title' },
              { label: '标签', value: 'tag' },
              { label: '内容', value: 'content' },
              { label: '书签', value: 'bookmark' }
            ]}
          />
          
          <Search
            placeholder={`搜索${searchType === 'all' ? '全部' : getMatchLabel(searchType as any)}...`}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
            allowClear
            size="small"
          />

          <Select
            placeholder="按标签筛选..."
            value={selectedTag}
            onChange={setSelectedTag}
            style={{ width: '100%' }}
            size="small"
            allowClear
            options={allTags.map(tag => ({
              label: `${tag} (${pages.filter(p => p.tags.includes(tag)).length})`,
              value: tag
            }))}
          />
        </Space>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {searchText.trim() ? (
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
              找到 {searchResults.length} 个结果
            </Text>
            
            {searchResults.length > 0 ? (
              <List
                dataSource={searchResults}
                renderItem={(result) => (
                  <List.Item
                    key={`${result.page.id}-${result.matchType}-${result.bookmarkId || ''}`}
                    onClick={() => handleResultClick(result)}
                    style={{
                      cursor: 'pointer',
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      background: currentPageId === result.page.id ? '#e6f4ff' : '#fff',
                      border: currentPageId === result.page.id ? '1px solid #1677ff' : '1px solid #e8e8e8',
                      transition: 'all 0.3s'
                    }}
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        {getMatchIcon(result.matchType)}
                        <Tag color="default" style={{ margin: 0, fontSize: 11 }}>
                          {getMatchLabel(result.matchType)}
                        </Tag>
                        <Text strong ellipsis style={{ flex: 1 }}>
                          {result.page.title}
                        </Text>
                      </div>
                      
                      {result.matchText && (
                        <Text 
                          style={{ 
                            fontSize: 12, 
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: '#595959'
                          }}
                        >
                          {result.matchType === 'content' ? '...' : ''}
                          {highlightText(result.matchText, searchText)}
                          {result.matchType === 'content' ? '...' : ''}
                        </Text>
                      )}
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="未找到匹配结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        ) : selectedTag ? (
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
              标签 "{selectedTag}" 的页面 ({tagFilteredPages.length})
            </Text>
            
            <List
              dataSource={tagFilteredPages}
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
                    </Text>
                    
                    <div style={{ marginBottom: 8 }}>
                      {page.tags.map(tag => (
                        <Tag key={tag} color="blue" style={{ marginBottom: 4, fontSize: 11 }}>
                          {tag}
                        </Tag>
                      ))}
                    </div>
                    
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(page.updatedAt).toLocaleString('zh-CN')}
                    </Text>
                  </div>
                </List.Item>
              )}
            />
          </div>
        ) : (
          <Empty 
            description="输入关键词搜索或选择标签筛选" 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
          />
        )}
      </div>
    </div>
  );
}

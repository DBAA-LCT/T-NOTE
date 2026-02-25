import { List, Typography, Tag } from 'antd';
import { FileTextOutlined, BookOutlined, CheckSquareOutlined, RightOutlined } from '@ant-design/icons';
import { DeletedItem } from '../types';

const { Text } = Typography;

export type TrashCategory = 'page' | 'bookmark' | 'todo';

interface TrashCategoryPanelProps {
  trash: DeletedItem[];
  activeCategory: TrashCategory | null;
  onSelectCategory: (category: TrashCategory) => void;
  onClearAll: () => void;
}

export default function TrashCategoryPanel({ 
  trash, 
  activeCategory, 
  onSelectCategory, 
  onClearAll 
}: TrashCategoryPanelProps) {
  const groupedTrash = {
    page: trash.filter(item => item.type === 'page').length,
    bookmark: trash.filter(item => item.type === 'bookmark').length,
    todo: trash.filter(item => item.type === 'todo').length
  };

  const categories = [
    { key: 'page' as TrashCategory, label: '页面', icon: <FileTextOutlined style={{ fontSize: 20, color: '#1677ff' }} />, count: groupedTrash.page },
    { key: 'bookmark' as TrashCategory, label: '书签', icon: <BookOutlined style={{ fontSize: 20, color: '#fa8c16' }} />, count: groupedTrash.bookmark },
    { key: 'todo' as TrashCategory, label: '待办', icon: <CheckSquareOutlined style={{ fontSize: 20, color: '#52c41a' }} />, count: groupedTrash.todo }
  ];

  return (
    <div style={{ 
      height: '100%',
      overflow: 'auto',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ 
        padding: '16px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fafafa',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Text strong style={{ fontSize: 14, color: '#666' }}>回收站</Text>
        {trash.length > 0 && (
          <Tag 
            color="error" 
            style={{ cursor: 'pointer', margin: 0 }} 
            onClick={() => {
              if (window.confirm('确定清空回收站吗？')) {
                onClearAll();
              }
            }}
          >
            清空
          </Tag>
        )}
      </div>

      <List
        dataSource={categories}
        renderItem={(item) => (
          <List.Item
            key={item.key}
            onClick={() => onSelectCategory(item.key)}
            style={{
              cursor: 'pointer',
              padding: '16px',
              background: activeCategory === item.key ? '#e6f4ff' : 'transparent',
              borderLeft: activeCategory === item.key ? '3px solid #1677ff' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (activeCategory !== item.key) {
                e.currentTarget.style.background = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => {
              if (activeCategory !== item.key) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              width: '100%'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                {item.icon}
                <div style={{ flex: 1 }}>
                  <Text strong>{item.label}</Text>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    {item.count} 个项目
                  </Text>
                </div>
              </div>
              <RightOutlined style={{ color: '#999', fontSize: 12 }} />
            </div>
          </List.Item>
        )}
      />
    </div>
  );
}

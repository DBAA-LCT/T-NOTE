import { useState } from 'react';
import { Typography, Button, Empty, Tag, message } from 'antd';
import { DeleteOutlined, RollbackOutlined, FileTextOutlined, BookOutlined, CheckSquareOutlined, FlagOutlined, ClockCircleOutlined, TagOutlined } from '@ant-design/icons';
import { DeletedItem, Page, Bookmark, TodoItem } from '../types';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import { useContextMenu } from '../hooks/useContextMenu';
import type { TrashCategory } from './TrashCategoryPanel';
import './ReadOnlyEditor.css';
import dayjs from 'dayjs';

const { Text } = Typography;

interface TrashContentPanelProps {
  trash: DeletedItem[];
  activeCategory: TrashCategory | null;
  onRestore: (item: DeletedItem) => void;
  onPermanentDelete: (itemId: string) => void;
}

export default function TrashContentPanel({ 
  trash, 
  activeCategory, 
  onRestore, 
  onPermanentDelete 
}: TrashContentPanelProps) {
  const [selectedItem, setSelectedItem] = useState<DeletedItem | null>(null);
  const contextMenu = useContextMenu();
  const [contextItem, setContextItem] = useState<DeletedItem | null>(null);

  // 按类型分组
  const groupedTrash = {
    page: trash.filter(item => item.type === 'page').sort((a, b) => b.deletedAt - a.deletedAt),
    bookmark: trash.filter(item => item.type === 'bookmark').sort((a, b) => b.deletedAt - a.deletedAt),
    todo: trash.filter(item => item.type === 'todo').sort((a, b) => b.deletedAt - a.deletedAt)
  };

  const categoryLabels = {
    page: '页面',
    bookmark: '书签',
    todo: '待办'
  };

  const getItemTitle = (item: DeletedItem) => {
    switch (item.type) {
      case 'page': return (item.data as Page).title || '未命名页面';
      case 'bookmark': return (item.data as Bookmark).name || '未命名书签';
      case 'todo': return (item.data as TodoItem).title || '未命名待办';
      default: return '未知项目';
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: DeletedItem) => {
    e.preventDefault();
    setContextItem(item);
    contextMenu.show(e);
  };

  const handleRestore = (item: DeletedItem) => {
    onRestore(item);
    if (selectedItem?.id === item.id) setSelectedItem(null);
    message.success('已恢复');
  };

  const handleDelete = (item: DeletedItem) => {
    if (window.confirm('确定永久删除吗？此操作不可恢复。')) {
      onPermanentDelete(item.id);
      if (selectedItem?.id === item.id) setSelectedItem(null);
      message.success('已永久删除');
    }
  };

  const menuItems: ContextMenuItem[] = [
    { key: 'restore', label: '恢复', icon: <RollbackOutlined />, onClick: () => contextItem && handleRestore(contextItem) },
    { key: 'divider', label: '', divider: true },
    { key: 'delete', label: '永久删除', icon: <DeleteOutlined />, danger: true, onClick: () => contextItem && handleDelete(contextItem) }
  ];

  const getPriorityColor = (p: string) => p === 'high' ? 'red' : p === 'medium' ? 'orange' : 'blue';
  const getPriorityText = (p: string) => p === 'high' ? '高' : p === 'medium' ? '中' : '低';

  // 未选择分类时的提示
  if (!activeCategory) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#fafafa' 
      }}>
        <Empty description="请从左侧选择一个分类" />
      </div>
    );
  }

  const items = groupedTrash[activeCategory];

  // 项目列表面板
  const renderItemListPanel = () => (
    <div style={{ 
      width: 280, 
      borderRight: '1px solid #f0f0f0', 
      display: 'flex', 
      flexDirection: 'column', 
      background: '#fff' 
    }}>
      <div style={{ 
        padding: '16px', 
        borderBottom: '1px solid #f0f0f0', 
        background: '#fafafa' 
      }}>
        <Text strong style={{ fontSize: 14, color: '#666' }}>
          {categoryLabels[activeCategory]} ({items.length})
        </Text>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {items.length === 0 ? (
          <Empty description={`没有已删除的${categoryLabels[activeCategory]}`} style={{ marginTop: 60 }} />
        ) : (
          items.map(item => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              onContextMenu={(e) => handleContextMenu(e, item)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                background: selectedItem?.id === item.id ? '#e6f4ff' : '#fff',
                borderBottom: '1px solid #f5f5f5',
                borderLeft: selectedItem?.id === item.id ? '3px solid #1677ff' : '3px solid transparent',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { if (selectedItem?.id !== item.id) e.currentTarget.style.background = '#f5f5f5'; }}
              onMouseLeave={(e) => { if (selectedItem?.id !== item.id) e.currentTarget.style.background = '#fff'; }}
            >
              <Text ellipsis style={{ display: 'block', fontWeight: 500, marginBottom: 4 }}>{getItemTitle(item)}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(item.deletedAt).format('YYYY-MM-DD HH:mm')}</Text>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // 预览面板
  const renderPreviewPanel = () => {
    if (!selectedItem) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
          <Empty description="选择一个项目查看详情" />
        </div>
      );
    }

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {/* 顶部操作栏 */}
        <div style={{ 
          padding: '12px 24px', 
          borderBottom: '1px solid #e8e8e8', 
          background: '#fafafa', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          gap: 12
        }}>
          <Button type="primary" icon={<RollbackOutlined />} onClick={() => handleRestore(selectedItem)}>恢复</Button>
          <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(selectedItem)}>永久删除</Button>
        </div>
        {/* 内容预览 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {selectedItem.type === 'page' && renderPagePreview(selectedItem.data as Page)}
          {selectedItem.type === 'bookmark' && renderBookmarkPreview(selectedItem.data as Bookmark)}
          {selectedItem.type === 'todo' && renderTodoPreview(selectedItem.data as TodoItem)}
        </div>
      </div>
    );
  };

  const renderPagePreview = (page: Page) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #e8e8e8', background: '#fafafa' }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{page.title || '未命名页面'}</div>
        {page.tags?.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{page.tags.filter(t => t).map(t => <Tag key={t} color="blue">{t}</Tag>)}</div>}
      </div>
      <div className="readonly-content ql-editor" style={{ flex: 1, padding: '16px 24px', overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: page.content || '<p style="color:#999">暂无内容</p>' }} />
    </div>
  );

  const renderBookmarkPreview = (bm: Bookmark) => (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <BookOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
        <Text strong style={{ fontSize: 18 }}>{bm.name}</Text>
      </div>
      <div style={{ marginBottom: 12, color: '#666' }}><ClockCircleOutlined /> <Text type="secondary">创建时间：{dayjs(bm.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text></div>
      <div style={{ marginBottom: 12, color: '#666' }}><FileTextOutlined /> <Text type="secondary">位置：第 {bm.position} 字符，长度 {bm.length}</Text></div>
      {bm.note && (
        <div style={{ marginTop: 24 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>书签备注：</Text>
          <div className="readonly-content ql-editor" style={{ padding: 16, background: '#fafafa', borderRadius: 8, border: '1px solid #e8e8e8' }} dangerouslySetInnerHTML={{ __html: bm.note }} />
        </div>
      )}
    </div>
  );

  const renderTodoPreview = (todo: TodoItem) => (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <CheckSquareOutlined style={{ fontSize: 24, color: '#52c41a' }} />
        <Text strong style={{ fontSize: 18, textDecoration: todo.completed ? 'line-through' : 'none' }}>{todo.title}</Text>
        {todo.completed && <Tag color="success">已完成</Tag>}
      </div>
      <div style={{ marginBottom: 12 }}><FlagOutlined /> <Text type="secondary">优先级：</Text><Tag color={getPriorityColor(todo.priority)}>{getPriorityText(todo.priority)}</Tag></div>
      {todo.category && <div style={{ marginBottom: 12, color: '#666' }}><TagOutlined /> <Text type="secondary">分类：{todo.category}</Text></div>}
      {todo.dueDate && <div style={{ marginBottom: 12, color: '#666' }}><ClockCircleOutlined /> <Text type="secondary">截止日期：{dayjs(todo.dueDate).format('YYYY-MM-DD')}</Text></div>}
      <div style={{ marginBottom: 12, color: '#666' }}><ClockCircleOutlined /> <Text type="secondary">创建时间：{dayjs(todo.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text></div>
      {todo.description && (
        <div style={{ marginTop: 24 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>描述：</Text>
          <div style={{ padding: 16, background: '#fafafa', borderRadius: 8, border: '1px solid #e8e8e8', lineHeight: 1.6 }}>{todo.description}</div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex' }}>
      {renderItemListPanel()}
      {renderPreviewPanel()}
      <ContextMenu visible={contextMenu.visible} x={contextMenu.x} y={contextMenu.y} items={menuItems} onClose={contextMenu.hide} />
    </div>
  );
}

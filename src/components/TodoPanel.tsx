import { useState } from 'react';
import { Typography, Button, Input, Select, Checkbox, Modal, Space, Tag, Empty, DatePicker, Collapse, message } from 'antd';
import { 
  CheckSquareOutlined, 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  FlagOutlined,
  SortAscendingOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  FileTextOutlined,
  InboxOutlined,
  CheckOutlined
} from '@ant-design/icons';
import { TodoItem, Page } from '../types';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import { useContextMenu } from '../hooks/useContextMenu';
import dayjs from 'dayjs';

const { Text } = Typography;
const { TextArea } = Input;

interface TodoPanelProps {
  todos: TodoItem[];
  pages: Page[];
  onAddTodo: (todo: Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTodo: (id: string, updates: Partial<TodoItem>) => void;
  onDeleteTodo: (id: string) => void;
  onJumpToPage?: (pageId: string, position: number) => void;
}

export default function TodoPanel({ todos, pages, onAddTodo, onUpdateTodo, onDeleteTodo, onJumpToPage }: TodoPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState<number | undefined>();
  const [linkedPageId, setLinkedPageId] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate'>('priority');
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
  const [groupBy, setGroupBy] = useState<'page' | 'category' | 'priority'>('page');
  
  // 右键菜单
  const contextMenu = useContextMenu();
  const [contextTodo, setContextTodo] = useState<TodoItem | null>(null);

  const handleTodoContextMenu = (e: React.MouseEvent, todo: TodoItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextTodo(todo);
    contextMenu.show(e);
  };

  const todoMenuItems: ContextMenuItem[] = [
    {
      key: 'toggle',
      label: contextTodo?.completed ? '标记为未完成' : '标记为已完成',
      icon: <CheckOutlined />,
      onClick: () => contextTodo && onUpdateTodo(contextTodo.id, { completed: !contextTodo.completed })
    },
    {
      key: 'edit',
      label: '编辑',
      icon: <EditOutlined />,
      onClick: () => contextTodo && openEditModal(contextTodo)
    },
    { key: 'divider', label: '', divider: true },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => contextTodo && onDeleteTodo(contextTodo.id)
    }
  ];

  const openAddModal = () => {
    setEditingTodo(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategory('');
    setDueDate(undefined);
    setLinkedPageId(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (todo: TodoItem) => {
    setEditingTodo(todo);
    setTitle(todo.title);
    setDescription(todo.description || '');
    setPriority(todo.priority);
    setCategory(todo.category || '');
    setDueDate(todo.dueDate);
    setLinkedPageId(todo.linkedPageId);
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    if (editingTodo) {
      // 如果更改了页面关联，需要清除位置信息
      const updates: Partial<TodoItem> = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        category: category.trim() || undefined,
        dueDate,
        linkedPageId: linkedPageId
      };

      // 如果页面关联改变了，清除位置信息
      if (linkedPageId !== editingTodo.linkedPageId) {
        updates.linkedPosition = undefined;
        updates.linkedLength = undefined;
      }

      onUpdateTodo(editingTodo.id, updates);
    } else {
      onAddTodo({
        title: title.trim(),
        description: description.trim() || undefined,
        completed: false,
        priority,
        category: category.trim() || undefined,
        dueDate,
        linkedPageId: linkedPageId
      });
    }

    setIsModalOpen(false);
  };

  const toggleComplete = (todo: TodoItem) => {
    onUpdateTodo(todo.id, { completed: !todo.completed });
  };

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

  // 过滤TODO
  const filteredTodos = todos.filter(todo => {
    if (filterStatus === 'active' && todo.completed) return false;
    if (filterStatus === 'completed' && !todo.completed) return false;
    if (filterPriority !== 'all' && todo.priority !== filterPriority) return false;
    return true;
  });

  // 按优先级和完成状态排序
  const sortedTodos = [...filteredTodos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    
    if (sortBy === 'dueDate') {
      // 按截止时间排序
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate - b.dueDate;
    } else {
      // 按优先级排序
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
  });

  // 获取页面名称
  const getPageName = (pageId?: string) => {
    if (!pageId) return null;
    const page = pages.find(p => p.id === pageId);
    return page?.title || '未命名页面';
  };

  // 按页面分组
  const groupedTodos = sortedTodos.reduce((groups, todo) => {
    let key: string;
    
    if (groupBy === 'page') {
      key = todo.linkedPageId || 'unlinked';
    } else if (groupBy === 'category') {
      key = todo.category || 'uncategorized';
    } else if (groupBy === 'priority') {
      key = todo.priority;
    } else {
      key = 'default';
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(todo);
    return groups;
  }, {} as Record<string, TodoItem[]>);
  
  // 获取分组标题
  const getGroupTitle = (key: string) => {
    if (groupBy === 'page') {
      if (key === 'unlinked') return '未关联页面';
      return getPageName(key) || '未命名页面';
    } else if (groupBy === 'category') {
      if (key === 'uncategorized') return '未分类';
      return key;
    } else if (groupBy === 'priority') {
      return getPriorityText(key);
    }
    return key;
  };
  
  // 获取分组图标
  const getGroupIcon = (key: string) => {
    if (groupBy === 'page') {
      return key === 'unlinked' ? <InboxOutlined /> : <FileTextOutlined />;
    } else if (groupBy === 'category') {
      return <AppstoreOutlined />;
    } else if (groupBy === 'priority') {
      return <FlagOutlined />;
    }
    return <UnorderedListOutlined />;
  };
  
  // 获取分组颜色
  const getGroupColor = (key: string) => {
    if (groupBy === 'page') {
      return key === 'unlinked' ? '#8c8c8c' : '#1677ff';
    } else if (groupBy === 'priority') {
      return getPriorityColor(key);
    }
    return '#1677ff';
  };

  const stats = {
    total: todos.length,
    active: todos.filter(t => !t.completed).length,
    completed: todos.filter(t => t.completed).length
  };

  // 渲染单个待办项
  const renderTodoItem = (todo: TodoItem) => (
    <div
      key={todo.id}
      style={{
        padding: '12px',
        background: todo.completed ? '#fafafa' : '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 6,
        transition: 'all 0.2s',
        cursor: todo.linkedPageId && todo.linkedPosition !== undefined ? 'pointer' : 'default'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#1677ff';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#e8e8e8';
        e.currentTarget.style.boxShadow = 'none';
      }}
      onClick={() => {
        if (todo.linkedPageId && todo.linkedPosition !== undefined && onJumpToPage) {
          onJumpToPage(todo.linkedPageId, todo.linkedPosition);
        }
      }}
      onContextMenu={(e) => handleTodoContextMenu(e, todo)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Checkbox
          checked={todo.completed}
          onChange={() => toggleComplete(todo)}
          style={{ marginTop: 2 }}
          onClick={(e) => e.stopPropagation()}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontSize: 14, 
            fontWeight: 500,
            textDecoration: todo.completed ? 'line-through' : 'none',
            color: todo.completed ? '#999' : '#333',
            marginBottom: 4,
            wordBreak: 'break-word'
          }}>
            {todo.title}
          </div>
          {todo.description && (
            <div style={{ 
              fontSize: 12, 
              color: '#666',
              marginBottom: 6,
              wordBreak: 'break-word'
            }}>
              {todo.description}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            <Tag 
              color={getPriorityColor(todo.priority)} 
              icon={<FlagOutlined />}
              style={{ margin: 0, fontSize: 11 }}
            >
              {getPriorityText(todo.priority)}
            </Tag>
            {todo.category && (
              <Tag style={{ margin: 0, fontSize: 11 }}>
                {todo.category}
              </Tag>
            )}
            {todo.dueDate && (
              <Tag 
                color={todo.dueDate < Date.now() && !todo.completed ? 'red' : 'default'}
                style={{ margin: 0, fontSize: 11 }}
              >
                {dayjs(todo.dueDate).format('MM-DD')}
              </Tag>
            )}
            {viewMode === 'flat' && todo.linkedPageId && (
              <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                {getPageName(todo.linkedPageId)}
              </Tag>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(todo)}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ 
      height: '100%',
      overflow: 'auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text strong style={{ fontSize: 16 }}>
            待办事项
          </Text>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={openAddModal}
            size="small"
          >
            新建
          </Button>
        </div>

        {/* 统计信息 */}
        <div style={{ 
          display: 'flex', 
          gap: 8, 
          marginBottom: 12,
          padding: '8px 12px',
          background: '#f5f5f5',
          borderRadius: 6
        }}>
          <Text style={{ fontSize: 12 }}>
            总计: <Text strong>{stats.total}</Text>
          </Text>
          <Text style={{ fontSize: 12, color: '#1677ff' }}>
            进行中: <Text strong>{stats.active}</Text>
          </Text>
          <Text style={{ fontSize: 12, color: '#52c41a' }}>
            已完成: <Text strong>{stats.completed}</Text>
          </Text>
        </div>

        {/* 过滤器和控制按钮 */}
        <Space size="small" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <Select
            size="small"
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: 100 }}
          >
            <Select.Option value="all">全部</Select.Option>
            <Select.Option value="active">进行中</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
          </Select>
          <Select
            size="small"
            value={filterPriority}
            onChange={setFilterPriority}
            style={{ width: 100 }}
          >
            <Select.Option value="all">所有优先级</Select.Option>
            <Select.Option value="high">高优先级</Select.Option>
            <Select.Option value="medium">中优先级</Select.Option>
            <Select.Option value="low">低优先级</Select.Option>
          </Select>
          <Select
            size="small"
            value={sortBy}
            onChange={setSortBy}
            style={{ width: 110 }}
            suffixIcon={<SortAscendingOutlined />}
          >
            <Select.Option value="priority">按优先级</Select.Option>
            <Select.Option value="dueDate">按截止时间</Select.Option>
          </Select>
          <Button.Group size="small">
            <Button
              type={viewMode === 'flat' ? 'primary' : 'default'}
              icon={<UnorderedListOutlined />}
              onClick={() => setViewMode('flat')}
              title="列表视图"
            />
            <Button
              type={viewMode === 'grouped' ? 'primary' : 'default'}
              icon={<AppstoreOutlined />}
              onClick={() => setViewMode('grouped')}
              title="分组视图"
            />
          </Button.Group>
          {viewMode === 'grouped' && (
            <Select
              size="small"
              value={groupBy}
              onChange={setGroupBy}
              style={{ width: 100 }}
            >
              <Select.Option value="page">按页面</Select.Option>
              <Select.Option value="category">按分类</Select.Option>
              <Select.Option value="priority">按优先级</Select.Option>
            </Select>
          )}
        </Space>
      </div>

      {/* TODO列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {sortedTodos.length === 0 ? (
          <Empty 
            image={<CheckSquareOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
            description={
              filterStatus !== 'all' || filterPriority !== 'all' 
                ? '没有符合条件的待办事项' 
                : '还没有待办事项，点击上方按钮创建'
            }
            style={{ marginTop: 60 }}
          />
        ) : viewMode === 'flat' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedTodos.map(todo => renderTodoItem(todo))}
          </div>
        ) : (
          <Collapse
            ghost
            defaultActiveKey={Object.keys(groupedTodos)}
            style={{ background: 'transparent' }}
          >
            {Object.entries(groupedTodos).map(([key, todos]) => (
              <Collapse.Panel
                key={key}
                header={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, color: getGroupColor(key) }}>
                      {getGroupIcon(key)}
                    </span>
                    <Text strong>{getGroupTitle(key)}</Text>
                    <Tag style={{ margin: 0 }}>{todos.length}</Tag>
                  </div>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 24 }}>
                  {todos.map(todo => renderTodoItem(todo))}
                </div>
              </Collapse.Panel>
            ))}
          </Collapse>
        )}
      </div>

      {/* 添加/编辑模态框 */}
      <Modal
        title={editingTodo ? '编辑待办事项' : '新建待办事项'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        okText="确定"
        cancelText="取消"
        width={500}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
              标题 *
            </Text>
            <Input
              placeholder="输入待办事项标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
              描述
            </Text>
            <TextArea
              placeholder="输入详细描述（可选）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          <div>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
              优先级
            </Text>
            <Select
              value={priority}
              onChange={setPriority}
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
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={20}
            />
          </div>

          <div>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
              截止日期
            </Text>
            <DatePicker
              value={dueDate ? dayjs(dueDate) : null}
              onChange={(date) => setDueDate(date ? date.valueOf() : undefined)}
              style={{ width: '100%' }}
              placeholder="选择截止日期（可选）"
              format="YYYY-MM-DD"
            />
          </div>

          <div>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
              关联页面
            </Text>
            <Select
              value={linkedPageId}
              onChange={(value) => {
                setLinkedPageId(value);
                // 如果更改了页面关联，提示用户
                if (editingTodo && value !== editingTodo.linkedPageId && editingTodo.linkedPosition !== undefined) {
                  message.warning('更改页面关联将清除文本位置信息');
                }
              }}
              style={{ width: '100%' }}
              placeholder="选择关联页面（可选）"
              allowClear
            >
              {pages.map(page => (
                <Select.Option key={page.id} value={page.id}>
                  {page.title}
                </Select.Option>
              ))}
            </Select>
            {linkedPageId && editingTodo?.linkedPosition === undefined && (
              <Text style={{ fontSize: 11, color: '#999', marginTop: 4, display: 'block' }}>
                提示：在编辑器中选中文本并添加待办可以精确关联到文本位置
              </Text>
            )}
          </div>
        </div>
      </Modal>

      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        items={todoMenuItems}
        onClose={contextMenu.hide}
      />
    </div>
  );
}

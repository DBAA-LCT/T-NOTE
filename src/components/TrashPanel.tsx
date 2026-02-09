import { Typography, Button, Empty, List, Tag, Popconfirm, Space, message } from 'antd';
import { DeleteOutlined, RollbackOutlined, FileTextOutlined, BookOutlined, CheckSquareOutlined } from '@ant-design/icons';
import { DeletedItem } from '../types';
import dayjs from 'dayjs';

const { Text } = Typography;

interface TrashPanelProps {
  trash: DeletedItem[];
  onRestore: (item: DeletedItem) => void;
  onPermanentDelete: (itemId: string) => void;
  onClearAll: () => void;
}

export default function TrashPanel({ trash, onRestore, onPermanentDelete, onClearAll }: TrashPanelProps) {
  const getItemIcon = (type: string) => {
    switch (type) {
      case 'page': return <FileTextOutlined style={{ fontSize: 20, color: '#1677ff' }} />;
      case 'bookmark': return <BookOutlined style={{ fontSize: 20, color: '#52c41a' }} />;
      case 'todo': return <CheckSquareOutlined style={{ fontSize: 20, color: '#faad14' }} />;
      default: return null;
    }
  };

  const getItemTitle = (item: DeletedItem) => {
    switch (item.type) {
      case 'page': return (item.data as any).title || '未命名页面';
      case 'bookmark': return (item.data as any).name || '未命名书签';
      case 'todo': return (item.data as any).title || '未命名待办';
      default: return '未知项目';
    }
  };

  const getItemTypeText = (type: string) => {
    switch (type) {
      case 'page': return '页面';
      case 'bookmark': return '书签';
      case 'todo': return '待办';
      default: return '未知';
    }
  };

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
            回收站
          </Text>
          {trash.length > 0 && (
            <Popconfirm
              title="确定清空回收站吗？"
              description="此操作不可恢复，所有项目将被永久删除"
              onConfirm={onClearAll}
              okText="清空"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button 
                danger
                size="small"
              >
                清空回收站
              </Button>
            </Popconfirm>
          )}
        </div>

        <div style={{ 
          padding: '8px 12px',
          background: '#f5f5f5',
          borderRadius: 6,
          fontSize: 12
        }}>
          <Text>
            共 <Text strong>{trash.length}</Text> 个项目
          </Text>
        </div>
      </div>

      {trash.length === 0 ? (
        <Empty 
          image={<DeleteOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
          description="回收站是空的"
          style={{ marginTop: 60 }}
        />
      ) : (
        <List
          dataSource={[...trash].sort((a, b) => b.deletedAt - a.deletedAt)}
          renderItem={(item) => (
            <List.Item
              style={{
                padding: '12px',
                background: '#fff',
                border: '1px solid #e8e8e8',
                borderRadius: 6,
                marginBottom: 8
              }}
              actions={[
                <Button
                  key="restore"
                  type="primary"
                  size="small"
                  icon={<RollbackOutlined />}
                  onClick={() => onRestore(item)}
                >
                  恢复
                </Button>,
                <Popconfirm
                  key="delete"
                  title="确定永久删除吗？"
                  description="此操作不可恢复"
                  onConfirm={() => onPermanentDelete(item.id)}
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                  >
                    永久删除
                  </Button>
                </Popconfirm>
              ]}
            >
              <List.Item.Meta
                avatar={getItemIcon(item.type)}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text strong>{getItemTitle(item)}</Text>
                    <Tag color="default" style={{ fontSize: 11 }}>
                      {getItemTypeText(item.type)}
                    </Tag>
                  </div>
                }
                description={
                  <Space direction="vertical" size={2}>
                    <Text style={{ fontSize: 12, color: '#999' }}>
                      删除时间: {dayjs(item.deletedAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Text>
                    {item.type === 'page' && (
                      <Text style={{ fontSize: 12, color: '#999' }}>
                        标签: {(item.data as any).tags?.length || 0} 个
                      </Text>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
}

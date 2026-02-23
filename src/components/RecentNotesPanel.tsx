import { useState, useEffect } from 'react';
import { List, Typography, Space, Button, Tag, message, Modal, Empty } from 'antd';
import {
  HistoryOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  DeleteOutlined,
  ClearOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { RecentNoteItem } from '../types/onedrive-sync';

const { Text } = Typography;

interface RecentNotesPanelProps {
  onOpenInCurrentWindow: (filePath: string) => void;
  onCreateNew: () => void;
  onOpen: () => void;
}

export default function RecentNotesPanel({ onOpenInCurrentWindow, onCreateNew, onOpen }: RecentNotesPanelProps) {
  const [recentNotes, setRecentNotes] = useState<RecentNoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecentNotes = async () => {
    try {
      const notes = await window.electronAPI.recentNotes.get();
      setRecentNotes(notes);
    } catch {
      setRecentNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRecentNotes(); }, []);

  const handleClick = (note: RecentNoteItem) => {
    Modal.confirm({
      title: '打开笔记',
      content: `要如何打开「${note.name}」？`,
      okText: '当前窗口',
      cancelText: '新窗口',
      closable: true,
      onOk: () => {
        onOpenInCurrentWindow(note.filePath);
      },
      onCancel: async () => {
        try {
          await window.electronAPI.openNoteInNewWindow(note.filePath);
        } catch (error: any) {
          message.error(error.message || '打开新窗口失败');
        }
      },
    });
  };

  const handleRemove = async (e: React.MouseEvent, filePath: string) => {
    e.stopPropagation();
    await window.electronAPI.recentNotes.remove(filePath);
    loadRecentNotes();
  };

  const handleClearAll = () => {
    Modal.confirm({
      title: '清空最近笔记',
      content: '确定要清空最近笔记列表吗？这不会删除笔记文件。',
      okText: '清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await window.electronAPI.recentNotes.clear();
        loadRecentNotes();
      },
    });
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const shortenPath = (filePath: string): string => {
    const parts = filePath.replace(/\\/g, '/').split('/');
    if (parts.length <= 3) return filePath;
    return '.../' + parts.slice(-2).join('/');
  };

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Text strong style={{ fontSize: 16 }}>
            <HistoryOutlined style={{ marginRight: 8 }} />
            最近笔记
          </Text>
          <Tag color="blue">{recentNotes.length} 个</Tag>
        </Space>
        {recentNotes.length > 0 && (
          <Button icon={<ClearOutlined />} size="small" onClick={handleClearAll} danger>
            清空
          </Button>
        )}
      </div>

      {/* 操作按钮 */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Button icon={<PlusOutlined />} onClick={onCreateNew} style={{ flex: 1 }}>
          新建笔记
        </Button>
        <Button icon={<FolderOpenOutlined />} onClick={onOpen} style={{ flex: 1 }}>
          打开笔记
        </Button>
      </div>

      {recentNotes.length === 0 && !loading ? (
        <Empty description="暂无最近笔记" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          loading={loading}
          dataSource={recentNotes}
          renderItem={(note) => (
            <List.Item
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                marginBottom: '6px',
                background: '#fff',
                border: '1px solid #e8e8e8',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
              }}
              onClick={() => handleClick(note)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#1890ff';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                const del = e.currentTarget.querySelector('.recent-del') as HTMLElement;
                if (del) del.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e8e8e8';
                e.currentTarget.style.boxShadow = 'none';
                const del = e.currentTarget.querySelector('.recent-del') as HTMLElement;
                if (del) del.style.opacity = '0';
              }}
            >
              <div
                className="recent-del"
                style={{ position: 'absolute', top: 8, right: 8, opacity: 0, transition: 'opacity 0.2s' }}
                onClick={(e) => handleRemove(e, note.filePath)}
              >
                <DeleteOutlined style={{ fontSize: 12, color: '#999' }} />
              </div>
              <List.Item.Meta
                avatar={<FileTextOutlined style={{ fontSize: 20, color: '#1890ff' }} />}
                title={<Text strong style={{ fontSize: 13 }}>{note.name}</Text>}
                description={
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{shortenPath(note.filePath)}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{formatTime(note.openedAt)}</Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
}

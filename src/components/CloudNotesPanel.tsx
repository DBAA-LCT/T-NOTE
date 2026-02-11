import { useState, useEffect } from 'react';
import { List, Typography, Space, Button, Tag, Spin, Empty, message } from 'antd';
import { 
  CloudOutlined, 
  DownloadOutlined, 
  CheckCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { CloudNote } from '../types/onedrive-sync';

const { Text } = Typography;

interface CloudNotesPanelProps {
  onDownloadNote?: (cloudNoteId: string) => void;
}

export default function CloudNotesPanel({ onDownloadNote }: CloudNotesPanelProps) {
  const [cloudNotes, setCloudNotes] = useState<CloudNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthAndLoadNotes();
  }, []);

  const checkAuthAndLoadNotes = async () => {
    try {
      const authenticated = await window.electronAPI.onedrive.isAuthenticated();
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        await loadCloudNotes();
      }
    } catch (error) {
      console.error('检查认证状态失败:', error);
    }
  };

  const loadCloudNotes = async () => {
    setLoading(true);
    try {
      const notes = await window.electronAPI.onedrive.getCloudNotes();
      setCloudNotes(notes);
    } catch (error: any) {
      console.error('加载云笔记失败:', error);
      message.error(error.message || '加载云笔记失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (note: CloudNote) => {
    try {
      message.loading({ content: `正在下载 ${note.name}...`, key: 'download' });
      await window.electronAPI.onedrive.downloadNote(note.id);
      message.success({ content: `${note.name} 下载成功！`, key: 'download' });
      
      // 重新加载云笔记列表以更新状态
      await loadCloudNotes();
      
      if (onDownloadNote) {
        onDownloadNote(note.id);
      }
    } catch (error: any) {
      console.error('下载笔记失败:', error);
      message.error({ content: error.message || '下载笔记失败', key: 'download' });
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return `${diffDays} 天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ 
        height: '100%',
        overflow: 'auto',
        padding: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>
            <CloudOutlined style={{ marginRight: 8 }} />
            云笔记
          </Text>
        </div>
        
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="请先连接 OneDrive 账号"
          style={{ marginTop: 60 }}
        />
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100%',
      overflow: 'auto',
      padding: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Text strong style={{ fontSize: 16 }}>
            <CloudOutlined style={{ marginRight: 8 }} />
            云笔记
          </Text>
          <Tag color="blue">{cloudNotes.length} 个</Tag>
        </Space>
        <Button 
          icon={<ReloadOutlined />}
          size="small"
          onClick={loadCloudNotes}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      <Spin spinning={loading}>
        <List
          dataSource={cloudNotes}
          locale={{ emptyText: '云端暂无笔记' }}
          renderItem={(note) => (
            <List.Item
              key={note.id}
              style={{
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '8px',
                background: '#fff',
                border: '1px solid #e8e8e8',
                transition: 'all 0.3s'
              }}
            >
              <div style={{ width: '100%' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: 8
                }}>
                  <div style={{ flex: 1, marginRight: 8 }}>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong ellipsis style={{ flex: 1 }}>
                          {note.name}
                        </Text>
                        {note.existsLocally && (
                          <Tag 
                            icon={<CheckCircleOutlined />} 
                            color="success"
                            style={{ margin: 0, fontSize: 11 }}
                          >
                            已下载
                          </Tag>
                        )}
                      </div>
                      
                      <Space size={8} style={{ fontSize: 12 }}>
                        <Text type="secondary">
                          {formatDate(note.updatedAt)}
                        </Text>
                        <Text type="secondary">
                          {formatBytes(note.size)}
                        </Text>
                      </Space>
                    </Space>
                  </div>
                  
                  {!note.existsLocally && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownload(note)}
                    >
                      下载
                    </Button>
                  )}
                </div>
              </div>
            </List.Item>
          )}
        />
      </Spin>
    </div>
  );
}

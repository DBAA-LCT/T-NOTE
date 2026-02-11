import { useState, useEffect } from 'react';
import { List, Typography, Space, Button, Tag, Spin, Empty, message, Modal, Input } from 'antd';
import {
  CloudOutlined,
  DownloadOutlined,
  ReloadOutlined,
  FolderOutlined
} from '@ant-design/icons';
import type { CloudNote } from '../types/onedrive-sync';

const { Text } = Typography;

interface CloudNotesPanelProps {
  onNoteDownloaded?: () => void;
}

export default function CloudNotesPanel({ onNoteDownloaded }: CloudNotesPanelProps) {
  const [cloudNotes, setCloudNotes] = useState<CloudNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadDialog, setDownloadDialog] = useState<{
    visible: boolean;
    note?: CloudNote;
  }>({ visible: false });

  useEffect(() => {
    loadCloudNotes();
  }, []);

  const loadCloudNotes = async () => {
    setLoading(true);
    try {
      const notes = await window.electronAPI.onedrive.getCloudNotes();
      setCloudNotes(notes);
    } catch (error: any) {
      message.error(error.message || '加载云端笔记失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadNote = async (note: CloudNote) => {
    setDownloadDialog({
      visible: true,
      note
    });
  };

  const confirmDownload = async () => {
    if (!downloadDialog.note) return;

    try {
      // 让用户选择本地保存位置
      const filePath = await window.electronAPI.saveNote('', downloadDialog.note.name);
      
      if (!filePath) {
        message.info('已取消下载');
        return;
      }

      // 下载笔记到指定位置
      const result = await window.electronAPI.onedrive.downloadNote(downloadDialog.note.id, filePath);
      
      if (result.success) {
        message.success('笔记已下载到本地');
        setDownloadDialog({ visible: false });
        
        if (onNoteDownloaded) {
          onNoteDownloaded();
        }
        
        // 刷新列表
        loadCloudNotes();
      } else {
        message.error(result.error || '下载失败');
      }
    } catch (error: any) {
      message.error(error.message || '下载失败');
    }
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

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Text strong style={{ fontSize: 16 }}>
            <CloudOutlined style={{ marginRight: 8 }} />
            云端笔记
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
              style={{
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '8px',
                background: '#fff',
                border: '1px solid #e8e8e8',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#1890ff';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e8e8e8';
                e.currentTarget.style.boxShadow = 'none';
              }}
              actions={[
                <Button
                  key="download"
                  type="primary"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownloadNote(note)}
                  disabled={note.existsLocally}
                >
                  {note.existsLocally ? '已在本地' : '下载'}
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={<FolderOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                title={
                  <Space>
                    <Text strong>{note.name}</Text>
                    {note.existsLocally && <Tag color="green">本地已有</Tag>}
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      更新时间：{formatDate(note.updatedAt)}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      大小：{formatSize(note.size)}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Spin>

      <Modal
        title="下载云端笔记"
        open={downloadDialog.visible}
        onCancel={() => setDownloadDialog({ visible: false })}
        onOk={confirmDownload}
        okText="下载"
        cancelText="取消"
      >
        {downloadDialog.note && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text strong>笔记名称：</Text>
              <Text>{downloadDialog.note.name}</Text>
            </div>
            <div>
              <Text strong>更新时间：</Text>
              <Text>{new Date(downloadDialog.note.updatedAt).toLocaleString('zh-CN')}</Text>
            </div>
            <div>
              <Text strong>文件大小：</Text>
              <Text>{formatSize(downloadDialog.note.size)}</Text>
            </div>
            <div style={{
              padding: 12,
              background: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: 4
            }}>
              <Text type="secondary">
                点击"下载"后，请选择保存位置
              </Text>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Modal, Button, List, Spin, message, Space, Typography } from 'antd';
import { FolderOutlined, CloudOutlined } from '@ant-design/icons';
import type { FolderItem } from '../types/onedrive-sync';

const { Text } = Typography;

interface EnableSyncDialogProps {
  visible: boolean;
  noteId: string;
  noteName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EnableSyncDialog({
  visible,
  noteId,
  noteName,
  onClose,
  onSuccess
}: EnableSyncDialogProps) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (visible) {
      loadFolders();
    }
  }, [visible]);

  const loadFolders = async (path?: string) => {
    setLoading(true);
    try {
      const folderList = await window.electronAPI.onedrive.browseFolders(path);
      setFolders(folderList);
      setCurrentPath(path || '');
    } catch (error: any) {
      message.error(error.message || '加载文件夹失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFolder = async (folder: FolderItem) => {
    setEnabling(true);
    try {
      await window.electronAPI.onedrive.enableNoteSync(noteId, folder.path);
      message.success('同步已启用');
      onSuccess();
      onClose();
    } catch (error: any) {
      message.error(error.message || '启用同步失败');
    } finally {
      setEnabling(false);
    }
  };

  return (
    <Modal
      title={`为"${noteName}"启用同步`}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>
      ]}
      width={600}
    >
      <div style={{ marginBottom: 16 }}>
        <Text>选择 OneDrive 中用于存储此笔记的文件夹：</Text>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Text type="secondary">当前路径：</Text>
        <Text strong style={{ display: 'block', marginTop: 4 }}>
          {currentPath || '/ (根目录)'}
        </Text>
      </div>

      {currentPath && (
        <Button
          style={{ marginBottom: 12 }}
          onClick={() => {
            const parentPath = currentPath.split('/').slice(0, -1).join('/');
            loadFolders(parentPath || undefined);
          }}
        >
          返回上级
        </Button>
      )}

      <Spin spinning={loading || enabling}>
        <List
          dataSource={folders}
          locale={{ emptyText: '此文件夹为空' }}
          style={{ maxHeight: 400, overflow: 'auto' }}
          renderItem={(folder) => (
            <List.Item
              style={{
                cursor: 'pointer',
                padding: '12px',
                borderRadius: 8,
                transition: 'background 0.3s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ flex: 1 }} onClick={() => loadFolders(folder.path)}>
                <Space>
                  <FolderOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                  <div>
                    <Text strong>{folder.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                      {folder.childCount} 项
                    </Text>
                  </div>
                </Space>
              </div>
              <Button type="primary" size="small" onClick={() => handleSelectFolder(folder)}>
                选择
              </Button>
            </List.Item>
          )}
        />
      </Spin>
    </Modal>
  );
}

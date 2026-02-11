import { Modal, Button, Space, Typography, Divider, Switch, message } from 'antd';
import { 
  WarningOutlined, 
  CloudOutlined, 
  LaptopOutlined,
  SaveOutlined
} from '@ant-design/icons';
import { useState } from 'react';
import type { ConflictInfo, ConflictResolution } from '../types/onedrive-sync';

const { Text, Paragraph } = Typography;

interface ConflictResolutionDialogProps {
  conflict: ConflictInfo | null;
  visible: boolean;
  onClose: () => void;
  onResolve: (resolution: ConflictResolution) => Promise<void>;
}

export default function ConflictResolutionDialog({
  conflict,
  visible,
  onClose,
  onResolve
}: ConflictResolutionDialogProps) {
  const [saveConflictCopy, setSaveConflictCopy] = useState(true);
  const [resolving, setResolving] = useState(false);

  if (!conflict) return null;

  const handleResolve = async (action: 'keep_local' | 'use_cloud') => {
    setResolving(true);
    try {
      await onResolve({
        action,
        saveConflictCopy
      });
      message.success('冲突已解决');
      onClose();
    } catch (error: any) {
      console.error('解决冲突失败:', error);
      message.error(error.message || '解决冲突失败');
    } finally {
      setResolving(false);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getContentPreview = (content: string, maxLength: number = 200): string => {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  };

  return (
    <Modal
      title={
        <Space>
          <WarningOutlined style={{ color: '#faad14', fontSize: 20 }} />
          <span>解决同步冲突</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
    >
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ fontSize: 16 }}>{conflict.noteName}</Text>
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          本地版本和云端版本都有修改，请选择要保留的版本
        </Text>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {/* 本地版本 */}
        <div style={{ 
          flex: 1, 
          border: '2px solid #1677ff', 
          borderRadius: 8, 
          padding: 16,
          background: '#f0f5ff'
        }}>
          <Space style={{ marginBottom: 12 }}>
            <LaptopOutlined style={{ fontSize: 18, color: '#1677ff' }} />
            <Text strong style={{ fontSize: 15 }}>本地版本</Text>
          </Space>
          
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              最后修改时间
            </Text>
            <Text style={{ display: 'block', fontSize: 13 }}>
              {formatDate(conflict.localUpdatedAt)}
            </Text>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              内容预览
            </Text>
            <div style={{ 
              background: '#fff', 
              padding: 12, 
              borderRadius: 4,
              maxHeight: 200,
              overflow: 'auto',
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {getContentPreview(conflict.localVersion.content)}
            </div>
          </div>

          <Button
            type="primary"
            block
            style={{ marginTop: 16 }}
            onClick={() => handleResolve('keep_local')}
            loading={resolving}
          >
            保留本地版本
          </Button>
        </div>

        {/* 云端版本 */}
        <div style={{ 
          flex: 1, 
          border: '2px solid #52c41a', 
          borderRadius: 8, 
          padding: 16,
          background: '#f6ffed'
        }}>
          <Space style={{ marginBottom: 12 }}>
            <CloudOutlined style={{ fontSize: 18, color: '#52c41a' }} />
            <Text strong style={{ fontSize: 15 }}>云端版本</Text>
          </Space>
          
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              最后修改时间
            </Text>
            <Text style={{ display: 'block', fontSize: 13 }}>
              {formatDate(conflict.cloudUpdatedAt)}
            </Text>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              内容预览
            </Text>
            <div style={{ 
              background: '#fff', 
              padding: 12, 
              borderRadius: 4,
              maxHeight: 200,
              overflow: 'auto',
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {getContentPreview(conflict.cloudVersion.content)}
            </div>
          </div>

          <Button
            type="primary"
            block
            style={{ marginTop: 16, background: '#52c41a', borderColor: '#52c41a' }}
            onClick={() => handleResolve('use_cloud')}
            loading={resolving}
          >
            使用云端版本
          </Button>
        </div>
      </div>

      <div style={{ 
        background: '#fafafa', 
        padding: 16, 
        borderRadius: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Space>
          <SaveOutlined />
          <Text>保存被覆盖版本的副本</Text>
        </Space>
        <Switch 
          checked={saveConflictCopy}
          onChange={setSaveConflictCopy}
        />
      </div>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Button onClick={onClose} disabled={resolving}>
          取消
        </Button>
      </div>
    </Modal>
  );
}

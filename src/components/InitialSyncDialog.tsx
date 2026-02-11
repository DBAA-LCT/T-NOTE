import { Modal, Radio, Space, Typography, Button, message, Progress } from 'antd';
import { 
  CloudUploadOutlined, 
  CloudDownloadOutlined, 
  SyncOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useState } from 'react';
import type { InitialSyncStrategy } from '../types/onedrive-sync';

const { Text, Paragraph } = Typography;

interface InitialSyncDialogProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (strategy: InitialSyncStrategy) => Promise<void>;
  hasLocalNotes: boolean;
  hasCloudNotes: boolean;
}

export default function InitialSyncDialog({
  visible,
  onClose,
  onConfirm,
  hasLocalNotes,
  hasCloudNotes
}: InitialSyncDialogProps) {
  const [strategy, setStrategy] = useState<InitialSyncStrategy>('smart_merge');
  const [syncing, setSyncing] = useState(false);

  const handleConfirm = async () => {
    setSyncing(true);
    try {
      await onConfirm(strategy);
      message.success('初次同步完成！');
      onClose();
    } catch (error: any) {
      console.error('初次同步失败:', error);
      message.error(error.message || '初次同步失败');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Modal
      title="初次同步配置"
      open={visible}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={syncing}>
          取消
        </Button>,
        <Button 
          key="confirm" 
          type="primary" 
          onClick={handleConfirm}
          loading={syncing}
        >
          开始同步
        </Button>
      ]}
    >
      <div style={{ marginBottom: 24 }}>
        <Space style={{ marginBottom: 16 }}>
          <InfoCircleOutlined style={{ color: '#1677ff', fontSize: 20 }} />
          <Text strong style={{ fontSize: 15 }}>
            检测到本地和云端都有笔记数据
          </Text>
        </Space>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          为避免数据丢失，请选择初次同步策略。系统将根据您的选择处理本地和云端的笔记。
        </Paragraph>
      </div>

      <Radio.Group 
        value={strategy} 
        onChange={(e) => setStrategy(e.target.value)}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* 上传本地 */}
          <div 
            style={{ 
              border: strategy === 'upload_local' ? '2px solid #1677ff' : '1px solid #d9d9d9',
              borderRadius: 8,
              padding: 16,
              cursor: 'pointer',
              background: strategy === 'upload_local' ? '#f0f5ff' : '#fff',
              transition: 'all 0.3s'
            }}
            onClick={() => setStrategy('upload_local')}
          >
            <Radio value="upload_local">
              <Space>
                <CloudUploadOutlined style={{ fontSize: 18, color: '#1677ff' }} />
                <Text strong>上传本地笔记到云端</Text>
              </Space>
            </Radio>
            <Paragraph 
              type="secondary" 
              style={{ marginLeft: 24, marginTop: 8, marginBottom: 0, fontSize: 13 }}
            >
              将所有本地笔记上传到 OneDrive，云端现有笔记将被覆盖。
              {hasLocalNotes && <Text type="warning" style={{ display: 'block', marginTop: 4 }}>
                ⚠️ 云端现有笔记可能会被覆盖
              </Text>}
            </Paragraph>
          </div>

          {/* 下载云端 */}
          <div 
            style={{ 
              border: strategy === 'download_cloud' ? '2px solid #52c41a' : '1px solid #d9d9d9',
              borderRadius: 8,
              padding: 16,
              cursor: 'pointer',
              background: strategy === 'download_cloud' ? '#f6ffed' : '#fff',
              transition: 'all 0.3s'
            }}
            onClick={() => setStrategy('download_cloud')}
          >
            <Radio value="download_cloud">
              <Space>
                <CloudDownloadOutlined style={{ fontSize: 18, color: '#52c41a' }} />
                <Text strong>下载云端笔记到本地</Text>
              </Space>
            </Radio>
            <Paragraph 
              type="secondary" 
              style={{ marginLeft: 24, marginTop: 8, marginBottom: 0, fontSize: 13 }}
            >
              将 OneDrive 中的所有笔记下载到本地，本地现有笔记将被覆盖。
              {hasCloudNotes && <Text type="warning" style={{ display: 'block', marginTop: 4 }}>
                ⚠️ 本地现有笔记可能会被覆盖
              </Text>}
            </Paragraph>
          </div>

          {/* 智能合并 */}
          <div 
            style={{ 
              border: strategy === 'smart_merge' ? '2px solid #722ed1' : '1px solid #d9d9d9',
              borderRadius: 8,
              padding: 16,
              cursor: 'pointer',
              background: strategy === 'smart_merge' ? '#f9f0ff' : '#fff',
              transition: 'all 0.3s'
            }}
            onClick={() => setStrategy('smart_merge')}
          >
            <Radio value="smart_merge">
              <Space>
                <SyncOutlined style={{ fontSize: 18, color: '#722ed1' }} />
                <Text strong>智能合并（推荐）</Text>
              </Space>
            </Radio>
            <Paragraph 
              type="secondary" 
              style={{ marginLeft: 24, marginTop: 8, marginBottom: 0, fontSize: 13 }}
            >
              根据笔记的最后修改时间自动选择较新的版本，保留最新数据。
              <Text type="success" style={{ display: 'block', marginTop: 4 }}>
                ✓ 推荐选项，最大程度保留数据
              </Text>
            </Paragraph>
          </div>
        </Space>
      </Radio.Group>

      <div style={{ 
        marginTop: 24, 
        padding: 12, 
        background: '#fff7e6', 
        border: '1px solid #ffd591',
        borderRadius: 8 
      }}>
        <Space>
          <InfoCircleOutlined style={{ color: '#fa8c16' }} />
          <Text style={{ fontSize: 13 }}>
            建议在同步前备份重要数据，以防意外情况发生。
          </Text>
        </Space>
      </div>
    </Modal>
  );
}

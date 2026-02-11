import { Modal, Button, Space, Checkbox, Typography } from 'antd';
import { SyncOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Text, Paragraph } = Typography;

interface StartupSyncPromptProps {
  visible: boolean;
  onConfirm: (dontShowAgain: boolean) => void;
  onCancel: (dontShowAgain: boolean) => void;
}

export default function StartupSyncPrompt({
  visible,
  onConfirm,
  onCancel
}: StartupSyncPromptProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleConfirm = () => {
    onConfirm(dontShowAgain);
  };

  const handleCancel = () => {
    onCancel(dontShowAgain);
  };

  return (
    <Modal
      title={
        <Space>
          <SyncOutlined style={{ color: '#1677ff', fontSize: 20 }} />
          <span>同步检查</span>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      width={480}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          跳过
        </Button>,
        <Button 
          key="confirm" 
          type="primary" 
          icon={<SyncOutlined />}
          onClick={handleConfirm}
        >
          立即同步
        </Button>
      ]}
    >
      <div style={{ marginBottom: 24 }}>
        <Space style={{ marginBottom: 16 }}>
          <InfoCircleOutlined style={{ color: '#1677ff', fontSize: 18 }} />
          <Text strong style={{ fontSize: 15 }}>
            是否执行同步检查？
          </Text>
        </Space>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          检测到您已连接 OneDrive 账号，是否要检查并同步笔记？
          这将确保您的本地笔记与云端保持一致。
        </Paragraph>
      </div>

      <div style={{ 
        padding: 12, 
        background: '#f5f5f5', 
        borderRadius: 8,
        marginBottom: 16
      }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          同步操作将：
        </Text>
        <ul style={{ 
          marginTop: 8, 
          marginBottom: 0, 
          paddingLeft: 20,
          fontSize: 13,
          color: '#666'
        }}>
          <li>上传本地新增或修改的笔记</li>
          <li>下载云端新增或修改的笔记</li>
          <li>检测并提示需要解决的冲突</li>
        </ul>
      </div>

      <Checkbox 
        checked={dontShowAgain}
        onChange={(e) => setDontShowAgain(e.target.checked)}
      >
        <Text type="secondary" style={{ fontSize: 13 }}>
          不再显示此提示
        </Text>
      </Checkbox>
    </Modal>
  );
}

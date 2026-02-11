import { useState } from 'react';
import { Button, Tag, Space, message } from 'antd';
import {
  CloudUploadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  CloudDownloadOutlined
} from '@ant-design/icons';
import type { Page } from '../types';

interface PageCommitButtonProps {
  noteId: string;
  pageId: string;
  syncStatus?: Page['syncStatus'];
  autoCommit: boolean;
  onCommitSuccess?: () => void;
}

export default function PageCommitButton({
  noteId,
  pageId,
  syncStatus,
  autoCommit,
  onCommitSuccess
}: PageCommitButtonProps) {
  const [committing, setCommitting] = useState(false);

  const handleCommit = async () => {
    setCommitting(true);
    try {
      const result = await window.electronAPI.onedrive.commitPage(noteId, pageId);
      if (result.success) {
        if (result.skipped) {
          message.info('页面内容未变化');
        } else {
          message.success('页面已提交到云端');
        }
        if (onCommitSuccess) {
          onCommitSuccess();
        }
      }
    } catch (error: any) {
      message.error(error.message || '提交失败');
    } finally {
      setCommitting(false);
    }
  };

  if (autoCommit) {
    return (
      <Tag
        icon={<SyncOutlined spin={syncStatus?.status === 'syncing'} />}
        color="blue"
        style={{ margin: 0 }}
      >
        自动同步
      </Tag>
    );
  }

  const getStatusTag = () => {
    switch (syncStatus?.status) {
      case 'synced':
        return (
          <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>
            已同步
          </Tag>
        );
      case 'pending':
      case 'local_newer':
        return (
          <Tag icon={<ExclamationCircleOutlined />} color="warning" style={{ margin: 0 }}>
            未提交
          </Tag>
        );
      case 'syncing':
        return (
          <Tag icon={<SyncOutlined spin />} color="processing" style={{ margin: 0 }}>
            提交中
          </Tag>
        );
      case 'error':
        return (
          <Tag icon={<CloseCircleOutlined />} color="error" style={{ margin: 0 }}>
            提交失败
          </Tag>
        );
      case 'cloud_newer':
        return (
          <Tag icon={<CloudDownloadOutlined />} color="orange" style={{ margin: 0 }}>
            云端较新
          </Tag>
        );
      default:
        return (
          <Tag style={{ margin: 0 }}>
            未同步
          </Tag>
        );
    }
  };

  const showCommitButton =
    syncStatus?.status !== 'synced' && syncStatus?.status !== 'syncing';

  return (
    <Space size="small">
      {getStatusTag()}
      {showCommitButton && (
        <Button
          type="primary"
          size="small"
          icon={<CloudUploadOutlined />}
          onClick={handleCommit}
          loading={committing}
        >
          提交到云端
        </Button>
      )}
    </Space>
  );
}

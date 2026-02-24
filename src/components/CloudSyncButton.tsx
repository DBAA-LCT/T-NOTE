/**
 * 通用云同步按钮组件
 * 
 * 支持 OneDrive 和百度网盘
 */

import { Button, Tooltip, Progress, message } from 'antd';
import { 
  CloudSyncOutlined, 
  CloudUploadOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { CloudProvider } from '../types/cloud';
import { useCloudSync } from '../hooks/useCloudSync';

interface CloudSyncButtonProps {
  provider: CloudProvider;
  onSyncComplete?: () => void;
  getNoteData?: () => { noteContent: string; noteName: string; noteId: string } | null;
  mode?: 'full-sync' | 'upload-only';
}

export default function CloudSyncButton({ 
  provider, 
  onSyncComplete,
  getNoteData,
  mode = 'full-sync'
}: CloudSyncButtonProps) {
  const {
    isAuthenticated,
    isSyncing,
    syncProgress,
    lastSyncTime,
    startSync,
  } = useCloudSync(provider);

  const providerName = provider === 'onedrive' ? 'OneDrive' : '百度网盘';

  const handleSync = async () => {
    if (!isAuthenticated) {
      message.warning(`请先连接 ${providerName}`);
      return;
    }

    if (mode === 'upload-only' && getNoteData) {
      const data = getNoteData();
      if (!data) {
        message.warning('没有可上传的笔记');
        return;
      }

      try {
        if (provider === 'onedrive') {
          await window.electronAPI.onedrive.uploadNoteContent(data);
        } else {
          await window.electronAPI.baidupan.uploadNote(data);
        }
        message.success(`已上传到${providerName}`);
        onSyncComplete?.();
      } catch (error) {
        message.error(`上传失败: ${(error as Error).message}`);
      }
      return;
    }

    try {
      await startSync();
      message.success(`${providerName}同步完成`);
      onSyncComplete?.();
    } catch (error) {
      message.error(`同步失败: ${(error as Error).message}`);
    }
  };

  const getIcon = () => {
    if (isSyncing) return <LoadingOutlined />;
    if (lastSyncTime && Date.now() - lastSyncTime < 3000) return <CheckCircleOutlined />;
    return mode === 'upload-only' ? <CloudUploadOutlined /> : <CloudSyncOutlined />;
  };

  const getTooltip = () => {
    if (!isAuthenticated) return `未连接${providerName}`;
    if (isSyncing) return '同步中...';
    if (lastSyncTime) {
      const elapsed = Math.floor((Date.now() - lastSyncTime) / 1000);
      if (elapsed < 60) return `${elapsed}秒前同步`;
      if (elapsed < 3600) return `${Math.floor(elapsed / 60)}分钟前同步`;
      return `${Math.floor(elapsed / 3600)}小时前同步`;
    }
    return mode === 'upload-only' ? `上传到${providerName}` : `同步${providerName}`;
  };

  return (
    <Tooltip title={getTooltip()}>
      <Button
        type="text"
        icon={getIcon()}
        onClick={handleSync}
        disabled={!isAuthenticated || isSyncing}
        style={{ color: isAuthenticated ? '#1890ff' : '#999' }}
      >
        {syncProgress && (
          <Progress
            type="circle"
            percent={Math.round((syncProgress.current / syncProgress.total) * 100)}
            width={20}
            strokeWidth={8}
          />
        )}
      </Button>
    </Tooltip>
  );
}

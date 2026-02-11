import { Tooltip } from 'antd';
import { 
  CheckCircleOutlined, 
  SyncOutlined, 
  ExclamationCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import type { SyncStatus } from '../types/onedrive-sync';

interface SyncStatusIconProps {
  status: SyncStatus;
  lastSyncAt?: number | null;
  error?: string | null;
}

export default function SyncStatusIcon({ status, lastSyncAt, error }: SyncStatusIconProps) {
  const getIcon = () => {
    switch (status) {
      case 'synced':
        return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 14 }} />;
      case 'syncing':
        return <SyncOutlined spin style={{ color: '#1677ff', fontSize: 14 }} />;
      case 'conflict':
        return <WarningOutlined style={{ color: '#faad14', fontSize: 14 }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 14 }} />;
      case 'not_synced':
      default:
        return <ExclamationCircleOutlined style={{ color: '#d9d9d9', fontSize: 14 }} />;
    }
  };

  const getTooltipTitle = () => {
    switch (status) {
      case 'synced':
        if (lastSyncAt) {
          const timeStr = new Date(lastSyncAt).toLocaleString('zh-CN');
          return `已同步 - ${timeStr}`;
        }
        return '已同步';
      case 'syncing':
        return '同步中...';
      case 'conflict':
        return '存在冲突，需要手动解决';
      case 'error':
        return error || '同步失败';
      case 'not_synced':
      default:
        return '未同步';
    }
  };

  return (
    <Tooltip title={getTooltipTitle()}>
      {getIcon()}
    </Tooltip>
  );
}

import { useState, useEffect } from 'react';
import { Button, Tooltip, Progress, message, Modal } from 'antd';
import { 
  CloudSyncOutlined, 
  CloudOutlined,
  WifiOutlined,
  DisconnectOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import type { NetworkStatus, IPCSyncProgress, IPCSyncComplete, IPCSyncError } from '../types/onedrive-sync';

interface OneDriveSyncButtonProps {
  onSyncComplete?: () => void;
}

export default function OneDriveSyncButton({ onSyncComplete }: OneDriveSyncButtonProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({ online: true, connectionType: 'unknown' });
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  useEffect(() => {
    checkAuthStatus();
    checkNetworkStatus();
    
    // 监听网络状态变化
    const removeNetworkListener = window.electronAPI.onedrive.onNetworkStatusChange((data) => {
      setNetworkStatus(data.status);
    });

    // 监听同步进度
    const removeProgressListener = window.electronAPI.onedrive.onSyncProgress((progress: IPCSyncProgress) => {
      setSyncProgress({ current: progress.current, total: progress.total });
    });

    // 监听同步完成
    const removeCompleteListener = window.electronAPI.onedrive.onSyncComplete((data: IPCSyncComplete) => {
      setIsSyncing(false);
      setSyncProgress(null);
      setLastSyncTime(Date.now());
      
      const { result } = data;
      const successCount = result.uploaded + result.downloaded;
      const hasErrors = result.errors.length > 0;
      const hasConflicts = result.conflicts.length > 0;

      if (hasErrors) {
        message.error(`同步完成，但有 ${result.errors.length} 个错误`);
      } else if (hasConflicts) {
        message.warning(`同步完成，但有 ${result.conflicts.length} 个冲突需要处理`);
      } else if (successCount > 0) {
        message.success(`同步成功！上传 ${result.uploaded} 个，下载 ${result.downloaded} 个`);
      } else {
        message.info('同步完成，所有笔记已是最新');
      }

      if (onSyncComplete) {
        onSyncComplete();
      }
    });

    // 监听同步错误
    const removeErrorListener = window.electronAPI.onedrive.onSyncError((error: IPCSyncError) => {
      setIsSyncing(false);
      setSyncProgress(null);
      message.error(error.error || '同步失败');
    });

    return () => {
      removeNetworkListener();
      removeProgressListener();
      removeCompleteListener();
      removeErrorListener();
    };
  }, [onSyncComplete]);

  const checkAuthStatus = async () => {
    try {
      const authenticated = await window.electronAPI.onedrive.isAuthenticated();
      setIsAuthenticated(authenticated);
    } catch (error) {
      console.error('检查认证状态失败:', error);
    }
  };

  const checkNetworkStatus = async () => {
    try {
      const status = await window.electronAPI.onedrive.getNetworkStatus();
      setNetworkStatus(status);
    } catch (error) {
      console.error('检查网络状态失败:', error);
    }
  };

  const handleSync = async () => {
    if (!isAuthenticated) {
      message.warning('请先连接 OneDrive 账号');
      return;
    }

    if (!networkStatus.online) {
      message.error('网络未连接，无法同步');
      return;
    }

    // 检查 WiFi 设置
    try {
      const settings = await window.electronAPI.onedrive.getSyncSettings();
      if (settings.wifiOnly) {
        const isWifi = await window.electronAPI.onedrive.isWifi();
        if (!isWifi) {
          message.warning('当前不是 WiFi 网络，已设置仅在 WiFi 下同步');
          return;
        }
      }
    } catch (error) {
      console.error('检查同步设置失败:', error);
    }

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: 0 });

    try {
      await window.electronAPI.onedrive.sync();
    } catch (error: any) {
      setIsSyncing(false);
      setSyncProgress(null);
      message.error(error.message || '同步失败');
    }
  };

  const handleCancelSync = () => {
    Modal.confirm({
      title: '取消同步',
      content: '确定要取消正在进行的同步操作吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await window.electronAPI.onedrive.cancelSync();
          setIsSyncing(false);
          setSyncProgress(null);
          message.info('已取消同步');
        } catch (error: any) {
          message.error(error.message || '取消同步失败');
        }
      }
    });
  };

  const getButtonIcon = () => {
    if (isSyncing) {
      return <LoadingOutlined spin />;
    }
    if (!networkStatus.online) {
      return <DisconnectOutlined />;
    }
    if (!isAuthenticated) {
      return <CloudOutlined />;
    }
    return <CloudSyncOutlined />;
  };

  const getButtonText = () => {
    if (isSyncing && syncProgress) {
      return `同步中 ${syncProgress.current}/${syncProgress.total}`;
    }
    if (isSyncing) {
      return '同步中...';
    }
    return '同步';
  };

  const getTooltipTitle = () => {
    if (!isAuthenticated) {
      return '未连接 OneDrive';
    }
    if (!networkStatus.online) {
      return '网络未连接';
    }
    if (lastSyncTime) {
      const timeStr = new Date(lastSyncTime).toLocaleString('zh-CN');
      return `上次同步: ${timeStr}`;
    }
    return '同步笔记到 OneDrive';
  };

  const isDisabled = !isAuthenticated || !networkStatus.online;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {!networkStatus.online && (
        <Tooltip title="网络未连接">
          <DisconnectOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
        </Tooltip>
      )}
      
      {networkStatus.online && networkStatus.connectionType === 'wifi' && (
        <Tooltip title="WiFi 网络">
          <WifiOutlined style={{ color: '#52c41a', fontSize: 16 }} />
        </Tooltip>
      )}

      <Tooltip title={getTooltipTitle()}>
        {isSyncing ? (
          <Button
            icon={getButtonIcon()}
            onClick={handleCancelSync}
            danger
          >
            {getButtonText()}
          </Button>
        ) : (
          <Button
            type={isAuthenticated ? 'default' : 'dashed'}
            icon={getButtonIcon()}
            onClick={handleSync}
            disabled={isDisabled}
          >
            {getButtonText()}
          </Button>
        )}
      </Tooltip>

      {isSyncing && syncProgress && syncProgress.total > 0 && (
        <div style={{ width: 100 }}>
          <Progress 
            percent={Math.round((syncProgress.current / syncProgress.total) * 100)} 
            size="small"
            showInfo={false}
          />
        </div>
      )}
    </div>
  );
}

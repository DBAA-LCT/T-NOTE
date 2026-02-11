import { Tag, Tooltip } from 'antd';
import { DisconnectOutlined, WifiOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import type { NetworkStatus } from '../types/onedrive-sync';

export default function OfflineModeIndicator() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({ 
    online: true, 
    connectionType: 'unknown' 
  });

  useEffect(() => {
    // 初始加载网络状态
    loadNetworkStatus();

    // 监听网络状态变化
    const removeListener = window.electronAPI.onedrive.onNetworkStatusChange((data) => {
      setNetworkStatus(data.status);
    });

    return () => {
      removeListener();
    };
  }, []);

  const loadNetworkStatus = async () => {
    try {
      const status = await window.electronAPI.onedrive.getNetworkStatus();
      setNetworkStatus(status);
    } catch (error) {
      console.error('加载网络状态失败:', error);
    }
  };

  if (networkStatus.online) {
    return null; // 在线时不显示
  }

  return (
    <Tooltip title="网络未连接，同步功能已禁用。您仍可以正常创建和编辑笔记。">
      <Tag 
        icon={<DisconnectOutlined />} 
        color="error"
        style={{ 
          margin: 0,
          fontSize: 13,
          padding: '4px 12px',
          cursor: 'help'
        }}
      >
        离线模式
      </Tag>
    </Tooltip>
  );
}

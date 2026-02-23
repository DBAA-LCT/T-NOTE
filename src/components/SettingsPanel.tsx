import { List, Typography, Badge } from 'antd';
import { 
  CloudOutlined,
  RightOutlined,
  CheckCircleFilled
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import type { ElectronAPI } from '../types/window.d';

const { Text } = Typography;

export type SettingsItem = 'onedrive' | 'baidupan' | 'googledrive' | 'dropbox';

interface SettingsPanelProps {
  activeItem: SettingsItem | null;
  onSelectItem: (item: SettingsItem) => void;
}

interface CloudService {
  id: SettingsItem;
  name: string;
  icon: React.ReactNode;
  connected: boolean;
  description: string;
}

export default function SettingsPanel({ activeItem, onSelectItem }: SettingsPanelProps) {
  const [oneDriveConnected, setOneDriveConnected] = useState(false);
  const [baiduPanConnected, setBaiduPanConnected] = useState(false);

  useEffect(() => {
    // 检查 OneDrive 连接状态
    const checkOneDriveStatus = async () => {
      try {
        const api = window.electronAPI as any;
        if (api?.onedrive) {
          const authenticated = await api.onedrive.isAuthenticated();
          setOneDriveConnected(authenticated);
        }
      } catch (error) {
        console.error('检查 OneDrive 状态失败:', error);
      }
    };

    // 检查百度网盘连接状态
    const checkBaiduPanStatus = async () => {
      try {
        const api = window.electronAPI as any;
        if (api?.baidupan) {
          const authenticated = await api.baidupan.isAuthenticated();
          setBaiduPanConnected(authenticated);
        }
      } catch (error) {
        console.error('检查百度网盘状态失败:', error);
      }
    };

    checkOneDriveStatus();
    checkBaiduPanStatus();
    
    // 定期检查状态
    const interval = setInterval(() => {
      checkOneDriveStatus();
      checkBaiduPanStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const cloudServices: CloudService[] = [
    {
      id: 'onedrive',
      name: 'OneDrive',
      icon: <CloudOutlined style={{ fontSize: 20, color: '#0078D4' }} />,
      connected: oneDriveConnected,
      description: 'Microsoft OneDrive 云存储'
    },
    {
      id: 'baidupan',
      name: '百度网盘',
      icon: <CloudOutlined style={{ fontSize: 20, color: '#06a7ff' }} />,
      connected: baiduPanConnected,
      description: '百度网盘云存储'
    },
    // 预留其他网盘接口
    // {
    //   id: 'googledrive',
    //   name: 'Google Drive',
    //   icon: <CloudOutlined style={{ fontSize: 20, color: '#4285F4' }} />,
    //   connected: false,
    //   description: 'Google Drive 云存储'
    // },
    // {
    //   id: 'dropbox',
    //   name: 'Dropbox',
    //   icon: <CloudOutlined style={{ fontSize: 20, color: '#0061FF' }} />,
    //   connected: false,
    //   description: 'Dropbox 云存储'
    // }
  ];

  return (
    <div style={{ 
      height: '100%',
      overflow: 'auto',
      background: '#fff'
    }}>
      <div style={{ 
        padding: '16px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fafafa'
      }}>
        <Text strong style={{ fontSize: 14, color: '#666' }}>
          云存储设置
        </Text>
      </div>

      <List
        dataSource={cloudServices}
        renderItem={(service) => (
          <List.Item
            key={service.id}
            onClick={() => onSelectItem(service.id)}
            style={{
              cursor: 'pointer',
              padding: '16px',
              background: activeItem === service.id ? '#e6f4ff' : 'transparent',
              borderLeft: activeItem === service.id ? '3px solid #1677ff' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (activeItem !== service.id) {
                e.currentTarget.style.background = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => {
              if (activeItem !== service.id) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              width: '100%'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                {service.icon}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text strong>{service.name}</Text>
                    {service.connected && (
                      <CheckCircleFilled style={{ color: '#52c41a', fontSize: 14 }} />
                    )}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    {service.description}
                  </Text>
                </div>
              </div>
              <RightOutlined style={{ color: '#999', fontSize: 12 }} />
            </div>
          </List.Item>
        )}
      />

      <div style={{ 
        padding: '16px',
        borderTop: '1px solid #f0f0f0',
        marginTop: 'auto'
      }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          后续将接入更多网盘
        </Text>
      </div>
    </div>
  );
}

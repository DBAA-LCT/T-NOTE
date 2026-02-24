import { List, Typography } from 'antd';
import { 
  CloudOutlined,
  RightOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

const { Text } = Typography;

export type SettingsItem = 'cloud-storage' | 'about';

interface SettingsPanelProps {
  activeItem: SettingsItem | null;
  onSelectItem: (item: SettingsItem) => void;
}

export default function SettingsPanel({ activeItem, onSelectItem }: SettingsPanelProps) {
  const settingsItems = [
    {
      id: 'cloud-storage' as SettingsItem,
      name: '云存储设置',
      icon: <CloudOutlined style={{ fontSize: 20, color: '#1677ff' }} />,
      description: '管理云端账号和同步设置'
    },
    {
      id: 'about' as SettingsItem,
      name: '关于 T-Note',
      icon: <InfoCircleOutlined style={{ fontSize: 20, color: '#1677ff' }} />,
      description: '版本信息和应用更新'
    }
  ];

  return (
    <div style={{ 
      height: '100%',
      overflow: 'auto',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ 
        padding: '16px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fafafa'
      }}>
        <Text strong style={{ fontSize: 14, color: '#666' }}>
          设置
        </Text>
      </div>

      <List
        dataSource={settingsItems}
        renderItem={(item) => (
          <List.Item
            key={item.id}
            onClick={() => onSelectItem(item.id)}
            style={{
              cursor: 'pointer',
              padding: '16px',
              background: activeItem === item.id ? '#e6f4ff' : 'transparent',
              borderLeft: activeItem === item.id ? '3px solid #1677ff' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (activeItem !== item.id) {
                e.currentTarget.style.background = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => {
              if (activeItem !== item.id) {
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
                {item.icon}
                <div style={{ flex: 1 }}>
                  <Text strong>{item.name}</Text>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    {item.description}
                  </Text>
                </div>
              </div>
              <RightOutlined style={{ color: '#999', fontSize: 12 }} />
            </div>
          </List.Item>
        )}
      />
    </div>
  );
}

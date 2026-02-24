/**
 * 远程账号管理面板
 * 支持多账号管理：添加、删除、切换账号
 */

import { useState, useEffect } from 'react';
import { List, Button, Modal, Select, Input, Space, Typography, Tag, Popconfirm, message, Empty } from 'antd';
import {
  CloudOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckCircleFilled,
  DisconnectOutlined,
  StarOutlined,
  StarFilled,
  SettingOutlined,
} from '@ant-design/icons';
import type { RemoteAccount, RemoteProvider } from '../types/remote-account';
import CloudStoragePanel from './CloudStoragePanel';
import type { CloudStorageAdapter } from './CloudStoragePanel';

const { Text, Title } = Typography;

interface ProviderOption {
  value: RemoteProvider;
  label: string;
  color: string;
  icon: React.ReactNode;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    value: 'onedrive',
    label: 'OneDrive',
    color: '#0078D4',
    icon: <CloudOutlined />,
  },
  {
    value: 'baidupan',
    label: '百度网盘',
    color: '#06a7ff',
    icon: <CloudOutlined />,
  },
];

export default function RemoteAccountsPanel() {
  const [accounts, setAccounts] = useState<RemoteAccount[]>([]);
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<RemoteProvider>('onedrive');
  const [accountName, setAccountName] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<RemoteAccount | null>(null);
  const [loading, setLoading] = useState(false);

  // 加载账号列表
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const result = await window.electronAPI.remoteAccounts.getAll();
      setAccounts(result.accounts);
      setDefaultAccountId(result.defaultAccountId);
    } catch (error) {
      console.error('加载账号列表失败:', error);
      // 如果加载失败，设置为空列表
      setAccounts([]);
      setDefaultAccountId(null);
    }
  };

  const handleAddAccount = () => {
    setAccountName('');
    setSelectedProvider('onedrive');
    setShowAddDialog(true);
  };

  const handleConfirmAdd = async () => {
    if (!accountName.trim()) {
      message.warning('请输入账号名称');
      return;
    }

    setLoading(true);
    try {
      const newAccount = await window.electronAPI.remoteAccounts.create({
        provider: selectedProvider,
        displayName: accountName.trim(),
      });
      
      message.success('账号已添加');
      setShowAddDialog(false);
      await loadAccounts();
      
      // 自动打开新账号的设置面板进行认证
      setSelectedAccount(newAccount);
    } catch (error: any) {
      message.error(error.message || '添加账号失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      await window.electronAPI.remoteAccounts.delete(accountId);
      message.success('账号已删除');
      await loadAccounts();
      if (selectedAccount?.id === accountId) {
        setSelectedAccount(null);
      }
    } catch (error: any) {
      message.error(error.message || '删除账号失败');
    }
  };

  const handleSetDefault = async (accountId: string) => {
    try {
      await window.electronAPI.remoteAccounts.setDefault(accountId);
      setDefaultAccountId(accountId);
      message.success('已设为默认账号');
    } catch (error: any) {
      message.error(error.message || '设置失败');
    }
  };

  const getProviderInfo = (provider: RemoteProvider) => {
    return PROVIDER_OPTIONS.find(p => p.value === provider)!;
  };

  // 如果选中了账号，显示账号详情面板
  if (selectedAccount) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Space>
            <Button
              type="text"
              size="small"
              onClick={() => setSelectedAccount(null)}
            >
              ← 返回
            </Button>
            <Text strong>{selectedAccount.displayName}</Text>
            <Tag color={getProviderInfo(selectedAccount.provider).color}>
              {getProviderInfo(selectedAccount.provider).label}
            </Tag>
          </Space>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <CloudStoragePanel
            adapter={createAdapter(selectedAccount)}
            onAuthChange={loadAccounts}
          />
        </div>
      </div>
    );
  }

  // 账号列表视图
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Text strong style={{ fontSize: 14, color: '#666' }}>
          远程账号管理
        </Text>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={handleAddAccount}
        >
          添加账号
        </Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {accounts.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="还没有添加任何远程账号"
            style={{ marginTop: 60 }}
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddAccount}>
              添加第一个账号
            </Button>
          </Empty>
        ) : (
          <List
            dataSource={accounts}
            renderItem={(account) => {
              const providerInfo = getProviderInfo(account.provider);
              const isDefault = account.id === defaultAccountId;
              
              return (
                <List.Item
                  key={account.id}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    background: '#fff',
                    border: '1px solid #e8e8e8',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = providerInfo.color;
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e8e8e8';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={() => setSelectedAccount(account)}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Space>
                        <CloudOutlined style={{ fontSize: 20, color: providerInfo.color }} />
                        <Text strong>{account.displayName}</Text>
                        {account.connected && (
                          <CheckCircleFilled style={{ color: '#52c41a', fontSize: 14 }} />
                        )}
                        {!account.connected && (
                          <DisconnectOutlined style={{ color: '#999', fontSize: 14 }} />
                        )}
                        {isDefault && (
                          <Tag color="gold" icon={<StarFilled />}>默认</Tag>
                        )}
                      </Space>
                      <Space size="small" onClick={(e) => e.stopPropagation()}>
                        {!isDefault && account.connected && (
                          <Button
                            type="text"
                            size="small"
                            icon={<StarOutlined />}
                            onClick={() => handleSetDefault(account.id)}
                            title="设为默认"
                          />
                        )}
                        <Popconfirm
                          title="删除账号"
                          description="确定要删除这个账号吗？"
                          onConfirm={() => handleDeleteAccount(account.id)}
                          okText="删除"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            title="删除"
                          />
                        </Popconfirm>
                      </Space>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag color={providerInfo.color}>{providerInfo.label}</Tag>
                      {account.userInfo && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {account.userInfo.email || account.userInfo.name || account.userInfo.userId}
                        </Text>
                      )}
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </div>

      <Modal
        title="添加远程账号"
        open={showAddDialog}
        onCancel={() => setShowAddDialog(false)}
        onOk={handleConfirmAdd}
        okText="添加"
        cancelText="取消"
        confirmLoading={loading}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>选择云盘类型：</Text>
            <Select
              value={selectedProvider}
              onChange={setSelectedProvider}
              style={{ width: '100%' }}
              options={PROVIDER_OPTIONS.map(p => ({
                value: p.value,
                label: (
                  <Space>
                    {p.icon}
                    <span>{p.label}</span>
                  </Space>
                ),
              }))}
            />
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>账号名称：</Text>
            <Input
              placeholder="例如：工作账号、个人账号"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              onPressEnter={handleConfirmAdd}
            />
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              用于区分不同的账号，可以随时修改
            </Text>
          </div>
        </Space>
      </Modal>
    </div>
  );
}

// 为账号创建适配器
function createAdapter(account: RemoteAccount): CloudStorageAdapter {
  if (account.provider === 'onedrive') {
    return {
      name: `OneDrive - ${account.displayName}`,
      themeColor: '#0078D4',
      accountId: account.id,
      
      isAuthenticated: () => window.electronAPI.remoteAccounts.isAuthenticated(account.id),
      
      authenticate: async () => {
        const info = await window.electronAPI.remoteAccounts.authenticate(account.id);
        return { displayName: info.displayName, secondaryInfo: `邮箱：${info.email}` };
      },
      
      disconnect: () => window.electronAPI.remoteAccounts.disconnect(account.id),
      
      getUserInfo: async () => {
        const info = await window.electronAPI.remoteAccounts.getUserInfo(account.id);
        return { displayName: info.displayName, secondaryInfo: `邮箱：${info.email}` };
      },
      
      getQuota: async () => {
        const q = await window.electronAPI.remoteAccounts.getQuota(account.id);
        return { used: q.used, total: q.total };
      },
      
      getSyncFolder: () => window.electronAPI.remoteAccounts.getSyncFolder(account.id),
      setSyncFolder: (path: string) => window.electronAPI.remoteAccounts.setSyncFolder(account.id, path),
      
      browseFolders: async (parentPath?: string) => {
        const folders = await window.electronAPI.remoteAccounts.browseFolders(account.id, parentPath);
        return folders.map(f => ({ name: f.name, path: f.path, childCount: f.childCount }));
      },
      
      createFolder: async (name: string, parentPath?: string) => {
        const f = await window.electronAPI.remoteAccounts.createFolder(account.id, name, parentPath);
        return { name: f.name, path: f.path, childCount: f.childCount };
      },
      
      getSyncSettings: async () => {
        const s = await window.electronAPI.remoteAccounts.getSyncSettings(account.id);
        return [
          {
            key: 'wifiOnly',
            label: '仅 WiFi 下同步',
            description: '启用后，仅在 WiFi 网络下执行同步操作',
            icon: <></>,
            value: s.wifiOnly ?? false,
          },
          {
            key: 'saveConflictCopy',
            label: '保存冲突副本',
            description: '解决冲突时，自动保存被覆盖版本的副本',
            icon: <></>,
            value: s.saveConflictCopy ?? true,
          },
        ];
      },
      
      updateSyncSetting: async (key: string, value: boolean) => {
        await window.electronAPI.remoteAccounts.updateSyncSetting(account.id, key, value);
      },
    };
  } else {
    // BaiduPan
    return {
      name: `百度网盘 - ${account.displayName}`,
      themeColor: '#06a7ff',
      accountId: account.id,
      
      isAuthenticated: () => window.electronAPI.remoteAccounts.isAuthenticated(account.id),
      
      authenticate: async () => {
        const info = await window.electronAPI.remoteAccounts.authenticate(account.id);
        return { displayName: info.displayName, secondaryInfo: `用户ID：${info.userId}` };
      },
      
      disconnect: () => window.electronAPI.remoteAccounts.disconnect(account.id),
      
      getUserInfo: async () => {
        const info = await window.electronAPI.remoteAccounts.getUserInfo(account.id);
        return { displayName: info.displayName, secondaryInfo: `用户ID：${info.userId}` };
      },
      
      getQuota: async () => {
        const q = await window.electronAPI.remoteAccounts.getQuota(account.id);
        return { used: q.used, total: q.total };
      },
      
      getSyncFolder: () => window.electronAPI.remoteAccounts.getSyncFolder(account.id),
      setSyncFolder: (path: string) => window.electronAPI.remoteAccounts.setSyncFolder(account.id, path),
      
      browseFolders: async (parentPath?: string) => {
        const folders = await window.electronAPI.remoteAccounts.browseFolders(account.id, parentPath);
        return folders.map(f => ({ name: f.name, path: f.path, childCount: f.childCount || 0 }));
      },
      
      createFolder: async (name: string, parentPath?: string) => {
        const folderPath = parentPath ? `${parentPath}/${name}` : `/${name}`;
        await window.electronAPI.remoteAccounts.createFolder(account.id, name, parentPath);
        return { name, path: folderPath, childCount: 0 };
      },
      
      getSyncSettings: async () => {
        const s = await window.electronAPI.remoteAccounts.getSyncSettings(account.id);
        return [
          {
            key: 'wifiOnly',
            label: '仅 WiFi 下同步',
            description: '启用后，仅在 WiFi 网络下执行同步操作',
            icon: <></>,
            value: s.wifiOnly ?? false,
          },
          {
            key: 'saveConflictCopy',
            label: '保存冲突副本',
            description: '解决冲突时，自动保存被覆盖版本的副本',
            icon: <></>,
            value: s.saveConflictCopy ?? true,
          },
        ];
      },
      
      updateSyncSetting: async (key: string, value: boolean) => {
        await window.electronAPI.remoteAccounts.updateSyncSetting(account.id, key, value);
      },
    };
  }
}

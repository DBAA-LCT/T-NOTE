import { useState, useEffect } from 'react';
import { Button, Typography, Space, Switch, Divider, message, Modal, List, Spin, Progress, Tag, Input } from 'antd';
import { 
  CloudOutlined, 
  DisconnectOutlined, 
  FolderOutlined,
  FolderAddOutlined,
  UserOutlined,
  SettingOutlined,
  WifiOutlined,
  SaveOutlined
} from '@ant-design/icons';
import type { UserInfo, SyncSettings, FolderItem, StorageQuota } from '../types/onedrive-sync';

const { Text, Title } = Typography;

interface OneDriveSettingsPanelProps {
  // Props will be added as needed
}

export default function OneDriveSettingsPanel({}: OneDriveSettingsPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    wifiOnly: false,
    saveConflictCopy: true,
    syncFolder: null
  });
  const [storageQuota, setStorageQuota] = useState<StorageQuota | null>(null);
  const [loading, setLoading] = useState(false);
  const [folderBrowserVisible, setFolderBrowserVisible] = useState(false);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // 加载初始数据
  useEffect(() => {
    loadAuthStatus();
    loadSyncSettings();
  }, []);

  // 当认证状态改变时，加载用户信息和存储配额
  useEffect(() => {
    if (isAuthenticated) {
      loadUserInfo();
      loadStorageQuota();
    }
  }, [isAuthenticated]);

  const loadAuthStatus = async () => {
    try {
      const authenticated = await window.electronAPI.onedrive.isAuthenticated();
      setIsAuthenticated(authenticated);
    } catch (error) {
      console.error('加载认证状态失败:', error);
    }
  };

  const loadUserInfo = async () => {
    try {
      const info = await window.electronAPI.onedrive.getUserInfo();
      setUserInfo(info);
    } catch (error) {
      console.error('加载用户信息失败:', error);
      message.error('加载用户信息失败');
    }
  };

  const loadSyncSettings = async () => {
    try {
      const settings = await window.electronAPI.onedrive.getSyncSettings();
      setSyncSettings(settings);
    } catch (error) {
      console.error('加载同步设置失败:', error);
    }
  };

  const loadStorageQuota = async () => {
    try {
      const quota = await window.electronAPI.onedrive.getStorageQuota();
      setStorageQuota(quota);
    } catch (error) {
      console.error('加载存储配额失败:', error);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const info = await window.electronAPI.onedrive.authenticate();
      setUserInfo(info);
      setIsAuthenticated(true);
      message.success('OneDrive 连接成功！');
      
      // 连接成功后，提示选择同步文件夹
      Modal.info({
        title: '选择同步文件夹',
        content: '请选择 OneDrive 中用于存储笔记的文件夹',
        onOk: () => setFolderBrowserVisible(true)
      });
    } catch (error: any) {
      console.error('连接 OneDrive 失败:', error);
      message.error(error.message || '连接 OneDrive 失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    Modal.confirm({
      title: '确认解绑',
      content: '解绑后将删除所有同步配置，但本地笔记数据会保留。确定要解绑吗？',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await window.electronAPI.onedrive.disconnect();
          setIsAuthenticated(false);
          setUserInfo(null);
          setSyncSettings({
            wifiOnly: false,
            saveConflictCopy: true,
            syncFolder: null
          });
          setStorageQuota(null);
          message.success('已解绑 OneDrive 账号');
        } catch (error: any) {
          console.error('解绑失败:', error);
          message.error(error.message || '解绑失败');
        }
      }
    });
  };

  const handleUpdateSetting = async (key: keyof SyncSettings, value: any) => {
    try {
      const newSettings = { ...syncSettings, [key]: value };
      await window.electronAPI.onedrive.updateSyncSettings({ [key]: value });
      setSyncSettings(newSettings);
      message.success('设置已更新');
    } catch (error: any) {
      console.error('更新设置失败:', error);
      message.error(error.message || '更新设置失败');
    }
  };

  const handleBrowseFolders = async (path?: string) => {
    setLoadingFolders(true);
    try {
      const folderList = await window.electronAPI.onedrive.browseFolders(path);
      setFolders(folderList);
      setCurrentPath(path || '');
    } catch (error: any) {
      console.error('浏览文件夹失败:', error);
      message.error(error.message || '浏览文件夹失败');
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleSelectFolder = async (folder: FolderItem) => {
    try {
      await window.electronAPI.onedrive.setSyncFolder(folder.path);
      setSyncSettings(prev => ({ ...prev, syncFolder: folder.path }));
      setFolderBrowserVisible(false);
      message.success(`已选择同步文件夹: ${folder.name}`);
    } catch (error: any) {
      console.error('设置同步文件夹失败:', error);
      message.error(error.message || '设置同步文件夹失败');
    }
  };

  const handleChangeSyncFolder = () => {
    setFolderBrowserVisible(true);
    handleBrowseFolders();
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('请输入文件夹名称');
      return;
    }

    setCreatingFolder(true);
    try {
      const folder = await window.electronAPI.onedrive.createFolder(newFolderName.trim(), currentPath || undefined);
      message.success(`文件夹 "${folder.name}" 创建成功！`);
      setNewFolderName('');
      setCreateFolderVisible(false);
      // 刷新文件夹列表
      await handleBrowseFolders(currentPath || undefined);
    } catch (error: any) {
      console.error('创建文件夹失败:', error);
      message.error(error.message || '创建文件夹失败');
    } finally {
      setCreatingFolder(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const storagePercent = storageQuota 
    ? Math.round((storageQuota.used / storageQuota.total) * 100)
    : 0;

  return (
    <div style={{ 
      height: '100%',
      overflow: 'auto',
      padding: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text strong style={{ fontSize: 16 }}>
          <CloudOutlined style={{ marginRight: 8 }} />
          OneDrive 同步
        </Text>
      </div>

      {!isAuthenticated ? (
        // 未连接状态
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <CloudOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 24 }} />
          <Title level={4} style={{ marginBottom: 16 }}>未连接 OneDrive</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
            连接 OneDrive 以同步您的笔记到云端
          </Text>
          <Button 
            type="primary" 
            icon={<CloudOutlined />}
            size="large"
            loading={loading}
            onClick={handleConnect}
          >
            连接 OneDrive
          </Button>
        </div>
      ) : (
        // 已连接状态
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 账号信息 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>
              <UserOutlined style={{ marginRight: 8 }} />
              账号信息
            </Text>
            <div style={{ 
              background: '#f5f5f5', 
              padding: 12, 
              borderRadius: 8,
              marginBottom: 12
            }}>
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">用户名：</Text>
                <Text strong>{userInfo?.displayName || '加载中...'}</Text>
              </div>
              <div>
                <Text type="secondary">邮箱：</Text>
                <Text>{userInfo?.email || '加载中...'}</Text>
              </div>
            </div>
            <Button 
              danger
              icon={<DisconnectOutlined />}
              onClick={handleDisconnect}
              block
            >
              解绑账号
            </Button>
          </div>

          <Divider style={{ margin: 0 }} />

          {/* 同步文件夹 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>
              <FolderOutlined style={{ marginRight: 8 }} />
              同步文件夹
            </Text>
            <div style={{ 
              background: '#f5f5f5', 
              padding: 12, 
              borderRadius: 8,
              marginBottom: 12
            }}>
              <Text type="secondary">当前路径：</Text>
              <Text strong style={{ display: 'block', marginTop: 4 }}>
                {syncSettings.syncFolder || '未设置'}
              </Text>
            </div>
            <Button 
              icon={<FolderOutlined />}
              onClick={handleChangeSyncFolder}
              block
            >
              更改文件夹
            </Button>
          </div>

          <Divider style={{ margin: 0 }} />

          {/* 同步设置 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>
              <SettingOutlined style={{ marginRight: 8 }} />
              同步设置
            </Text>
            
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <WifiOutlined />
                  <Text>仅 WiFi 下同步</Text>
                </Space>
                <Switch 
                  checked={syncSettings.wifiOnly}
                  onChange={(checked) => handleUpdateSetting('wifiOnly', checked)}
                />
              </div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                启用后，仅在 WiFi 网络下执行同步操作
              </Text>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <SaveOutlined />
                  <Text>保存冲突副本</Text>
                </Space>
                <Switch 
                  checked={syncSettings.saveConflictCopy}
                  onChange={(checked) => handleUpdateSetting('saveConflictCopy', checked)}
                />
              </div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                解决冲突时，自动保存被覆盖版本的副本
              </Text>
            </div>
          </div>

          <Divider style={{ margin: 0 }} />

          {/* 存储空间 */}
          {storageQuota && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 12 }}>
                存储空间
              </Text>
              <div style={{ marginBottom: 8 }}>
                <Progress 
                  percent={storagePercent} 
                  status={storagePercent > 90 ? 'exception' : 'normal'}
                  strokeColor={storagePercent > 90 ? '#ff4d4f' : '#1677ff'}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">
                  已使用 {formatBytes(storageQuota.used)}
                </Text>
                <Text type="secondary">
                  共 {formatBytes(storageQuota.total)}
                </Text>
              </div>
            </div>
          )}
        </Space>
      )}

      {/* 文件夹浏览器对话框 */}
      <Modal
        title="选择同步文件夹"
        open={folderBrowserVisible}
        onCancel={() => setFolderBrowserVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">当前路径：</Text>
          <Text strong style={{ display: 'block', marginTop: 4 }}>
            {currentPath || '/ (根目录)'}
          </Text>
        </div>

        <Space style={{ marginBottom: 12, width: '100%' }}>
          {currentPath && (
            <Button 
              onClick={() => {
                const parentPath = currentPath.split('/').slice(0, -1).join('/');
                handleBrowseFolders(parentPath || undefined);
              }}
            >
              返回上级
            </Button>
          )}
          <Button 
            type="primary"
            icon={<FolderAddOutlined />}
            onClick={() => setCreateFolderVisible(true)}
          >
            新建文件夹
          </Button>
        </Space>

        <Spin spinning={loadingFolders}>
          <List
            dataSource={folders}
            locale={{ emptyText: '此文件夹为空' }}
            renderItem={(folder) => (
              <List.Item
                style={{ cursor: 'pointer', padding: '12px', borderRadius: 8 }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div 
                  style={{ flex: 1 }}
                  onClick={() => handleBrowseFolders(folder.path)}
                >
                  <Space>
                    <FolderOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                    <div>
                      <Text strong>{folder.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                        {folder.childCount} 项
                      </Text>
                    </div>
                  </Space>
                </div>
                <Button 
                  type="primary"
                  size="small"
                  onClick={() => handleSelectFolder(folder)}
                >
                  选择
                </Button>
              </List.Item>
            )}
          />
        </Spin>
      </Modal>

      {/* 新建文件夹对话框 */}
      <Modal
        title="新建文件夹"
        open={createFolderVisible}
        onCancel={() => {
          setCreateFolderVisible(false);
          setNewFolderName('');
        }}
        onOk={handleCreateFolder}
        confirmLoading={creatingFolder}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">将在以下位置创建：</Text>
          <Text strong style={{ display: 'block', marginTop: 4 }}>
            {currentPath || '/ (根目录)'}
          </Text>
        </div>
        <Input
          placeholder="请输入文件夹名称"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onPressEnter={handleCreateFolder}
          maxLength={255}
          autoFocus
        />
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          文件夹名称不能包含以下字符：{'< > : " | ? * / \\'}
        </Text>
      </Modal>
    </div>
  );
}

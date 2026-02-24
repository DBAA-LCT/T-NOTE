/**
 * 通用云存储设置面板模板
 *
 * 通过 CloudStorageAdapter 接口适配不同网盘，
 * 新增网盘只需实现 adapter 即可复用整个 UI。
 */

import { useState, useEffect } from 'react';
import { Button, Typography, Space, Switch, Divider, message, Modal, List, Spin, Progress, Input } from 'antd';
import {
  CloudOutlined,
  DisconnectOutlined,
  FolderOutlined,
  FolderAddOutlined,
  UserOutlined,
  SettingOutlined,
  WifiOutlined,
  SaveOutlined,
  CloudDownloadOutlined,
  ReloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Popconfirm } from 'antd';

const { Text, Title } = Typography;

// ============================================================================
// 适配器接口 — 每个网盘实现这个接口
// ============================================================================

/** 账号信息（通用） */
export interface CloudUserInfo {
  displayName: string;
  /** 第二行信息，如邮箱、会员状态等 */
  secondaryInfo?: string;
}

/** 存储配额（通用） */
export interface CloudQuota {
  used: number;
  total: number;
}

/** 文件夹项（用于文件夹浏览器） */
export interface CloudFolderItem {
  name: string;
  path: string;
  childCount?: number;
}

/** 云端笔记项 */
export interface CloudNoteItem {
  id: string | number;
  name: string;
  size: number;
  updatedAt: number;
  /** 用于删除等操作的路径 */
  path?: string;
}

/** 同步设置项 */
export interface CloudSyncSetting {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  value: boolean;
}

export interface CloudStorageAdapter {
  /** 网盘名称，如 "OneDrive"、"百度网盘" */
  name: string;
  /** 主题色 */
  themeColor: string;
  /** 账号 ID（可选，用于多账号管理） */
  accountId?: string;

  // ---- 认证 ----
  isAuthenticated: () => Promise<boolean>;
  authenticate: () => Promise<CloudUserInfo>;
  disconnect: () => Promise<void>;
  getUserInfo: () => Promise<CloudUserInfo>;

  // ---- 存储 ----
  getQuota: () => Promise<CloudQuota>;

  // ---- 同步文件夹（可选，有的网盘是固定路径） ----
  getSyncFolder?: () => Promise<string | null>;
  /** 如果不提供 browseFolders，则同步文件夹只读展示 */
  browseFolders?: (parentPath?: string) => Promise<CloudFolderItem[]>;
  setSyncFolder?: (folderPath: string) => Promise<void>;
  createFolder?: (name: string, parentPath?: string) => Promise<CloudFolderItem>;
  /** 固定路径（不可更改时使用） */
  fixedSyncFolder?: string;

  // ---- 同步设置（可选） ----
  getSyncSettings?: () => Promise<CloudSyncSetting[]>;
  updateSyncSetting?: (key: string, value: boolean) => Promise<void>;

  // ---- 云端笔记（可选） ----
  getCloudNotes?: () => Promise<CloudNoteItem[]>;
  downloadNote?: (id: string | number) => Promise<{ success: boolean; content: string }>;
  deleteNote?: (item: CloudNoteItem) => Promise<void>;
}

// ============================================================================
// 通用面板组件
// ============================================================================

interface CloudStoragePanelProps {
  adapter: CloudStorageAdapter;
  onAuthChange?: () => void;
}

export default function CloudStoragePanel({ adapter, onAuthChange }: CloudStoragePanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<CloudUserInfo | null>(null);
  const [quota, setQuota] = useState<CloudQuota | null>(null);
  const [syncFolder, setSyncFolder] = useState<string | null>(null);
  const [syncSettings, setSyncSettings] = useState<CloudSyncSetting[]>([]);
  const [cloudNotes, setCloudNotes] = useState<CloudNoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // 文件夹浏览器
  const [folderBrowserVisible, setFolderBrowserVisible] = useState(false);
  const [folders, setFolders] = useState<CloudFolderItem[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    loadAuthStatus();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadUserInfo();
      loadQuota();
      loadSyncFolder();
      if (adapter.getSyncSettings) loadSyncSettings();
      if (adapter.getCloudNotes) loadCloudNotes();
    }
  }, [isAuthenticated]);

  const loadAuthStatus = async () => {
    try {
      const authed = await adapter.isAuthenticated();
      setIsAuthenticated(authed);
    } catch (e) { console.error('检查认证状态失败:', e); }
  };

  const loadUserInfo = async () => {
    try { setUserInfo(await adapter.getUserInfo()); }
    catch (e) { console.error('加载用户信息失败:', e); }
  };

  const loadQuota = async () => {
    try { setQuota(await adapter.getQuota()); }
    catch (e) { console.error('加载存储配额失败:', e); }
  };

  const loadSyncFolder = async () => {
    if (adapter.fixedSyncFolder) {
      setSyncFolder(adapter.fixedSyncFolder);
    } else if (adapter.getSyncFolder) {
      try { setSyncFolder(await adapter.getSyncFolder()); }
      catch (e) { console.error('加载同步文件夹失败:', e); }
    }
  };

  const loadSyncSettings = async () => {
    if (!adapter.getSyncSettings) return;
    try { setSyncSettings(await adapter.getSyncSettings()); }
    catch (e) { console.error('加载同步设置失败:', e); }
  };

  const loadCloudNotes = async () => {
    if (!adapter.getCloudNotes) return;
    setLoadingNotes(true);
    try { setCloudNotes(await adapter.getCloudNotes()); }
    catch (e) { console.error('获取云端笔记失败:', e); }
    finally { setLoadingNotes(false); }
  };

  // ---- 操作 ----

  const handleConnect = async () => {
    setLoading(true);
    try {
      const info = await adapter.authenticate();
      setUserInfo(info);
      setIsAuthenticated(true);
      message.success(`${adapter.name} 连接成功！`);
      onAuthChange?.();
      if (adapter.browseFolders) {
        Modal.info({
          title: '选择同步文件夹',
          content: `请选择 ${adapter.name} 中用于存储笔记的文件夹`,
          onOk: () => { setFolderBrowserVisible(true); handleBrowseFolders(); },
        });
      }
    } catch (error: any) {
      message.error(error.message || `连接 ${adapter.name} 失败`);
    } finally { setLoading(false); }
  };

  const handleDisconnect = () => {
    Modal.confirm({
      title: '确认解绑',
      content: '解绑后将删除所有同步配置，但本地笔记数据会保留。确定要解绑吗？',
      okText: '确定', cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await adapter.disconnect();
          setIsAuthenticated(false);
          setUserInfo(null);
          setQuota(null);
          setSyncFolder(null);
          setSyncSettings([]);
          setCloudNotes([]);
          message.success(`已解绑 ${adapter.name} 账号`);
          onAuthChange?.();
        } catch (error: any) {
          message.error(error.message || '解绑失败');
        }
      },
    });
  };

  const handleToggleSetting = async (key: string, value: boolean) => {
    if (!adapter.updateSyncSetting) return;
    try {
      await adapter.updateSyncSetting(key, value);
      setSyncSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
      message.success('设置已更新');
    } catch (error: any) {
      message.error(error.message || '更新设置失败');
    }
  };

  const handleDownloadNote = async (item: CloudNoteItem) => {
    if (!adapter.downloadNote) return;
    try {
      const result = await adapter.downloadNote(item.id);
      if (result.success) message.success(`已下载: ${item.name}`);
    } catch (error: any) {
      message.error('下载失败: ' + (error.message || '未知错误'));
    }
  };

  const handleDeleteNote = async (item: CloudNoteItem) => {
    if (!adapter.deleteNote) return;
    try {
      await adapter.deleteNote(item);
      message.success('已删除');
      loadCloudNotes();
    } catch { message.error('删除失败'); }
  };

  // ---- 文件夹浏览器 ----

  const handleBrowseFolders = async (path?: string) => {
    if (!adapter.browseFolders) return;
    setLoadingFolders(true);
    try {
      setFolders(await adapter.browseFolders(path));
      setCurrentPath(path || '');
    } catch (error: any) {
      message.error(error.message || '浏览文件夹失败');
    } finally { setLoadingFolders(false); }
  };

  const handleSelectFolder = async (folder: CloudFolderItem) => {
    if (!adapter.setSyncFolder) return;
    try {
      await adapter.setSyncFolder(folder.path);
      setSyncFolder(folder.path);
      setFolderBrowserVisible(false);
      message.success(`已选择同步文件夹: ${folder.name}`);
    } catch (error: any) {
      message.error(error.message || '设置同步文件夹失败');
    }
  };

  const handleCreateFolder = async () => {
    if (!adapter.createFolder || !newFolderName.trim()) {
      if (!newFolderName.trim()) message.error('请输入文件夹名称');
      return;
    }
    setCreatingFolder(true);
    try {
      const folder = await adapter.createFolder(newFolderName.trim(), currentPath || undefined);
      message.success(`文件夹 "${folder.name}" 创建成功！`);
      setNewFolderName('');
      setCreateFolderVisible(false);
      await handleBrowseFolders(currentPath || undefined);
    } catch (error: any) {
      message.error(error.message || '创建文件夹失败');
    } finally { setCreatingFolder(false); }
  };

  // ---- 工具 ----

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const storagePercent = quota ? Math.round((quota.used / quota.total) * 100) : 0;
  const canBrowseFolders = !!adapter.browseFolders;
  const hasCloudNotes = !!adapter.getCloudNotes;

  // ============================================================================
  // 渲染
  // ============================================================================

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '16px' }}>
      {/* 标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text strong style={{ fontSize: 16 }}>
          <CloudOutlined style={{ marginRight: 8 }} />
          {adapter.name} 同步
        </Text>
      </div>

      {!isAuthenticated ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <CloudOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 24 }} />
          <Title level={4} style={{ marginBottom: 16 }}>未连接 {adapter.name}</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
            连接 {adapter.name} 以同步您的笔记到云端
          </Text>
          <Button type="primary" icon={<CloudOutlined />} size="large" loading={loading} onClick={handleConnect}>
            连接 {adapter.name}
          </Button>
        </div>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 账号信息 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>
              <UserOutlined style={{ marginRight: 8 }} />账号信息
            </Text>
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginBottom: 12 }}>
              <div style={{ marginBottom: userInfo?.secondaryInfo ? 8 : 0 }}>
                <Text type="secondary">用户名：</Text>
                <Text strong>{userInfo?.displayName || '加载中...'}</Text>
              </div>
              {userInfo?.secondaryInfo && (
                <div>
                  <Text type="secondary">{userInfo.secondaryInfo}</Text>
                </div>
              )}
            </div>
            <Button danger icon={<DisconnectOutlined />} onClick={handleDisconnect} block>
              解绑账号
            </Button>
          </div>

          <Divider style={{ margin: 0 }} />

          {/* 同步文件夹 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>
              <FolderOutlined style={{ marginRight: 8 }} />同步文件夹
            </Text>
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginBottom: canBrowseFolders ? 12 : 0 }}>
              <Text type="secondary">当前路径：</Text>
              <Text strong style={{ display: 'block', marginTop: 4 }}>
                {syncFolder || '未设置'}
              </Text>
            </div>
            {canBrowseFolders && (
              <Button icon={<FolderOutlined />} onClick={() => { setFolderBrowserVisible(true); handleBrowseFolders(); }} block>
                更改文件夹
              </Button>
            )}
          </div>

          {/* 同步设置 */}
          {syncSettings.length > 0 && (
            <>
              <Divider style={{ margin: 0 }} />
              <div>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  <SettingOutlined style={{ marginRight: 8 }} />同步设置
                </Text>
                {syncSettings.map((setting, idx) => (
                  <div key={setting.key} style={{ marginBottom: idx < syncSettings.length - 1 ? 16 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>{setting.icon}<Text>{setting.label}</Text></Space>
                      <Switch checked={setting.value} onChange={(v) => handleToggleSetting(setting.key, v)} />
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                      {setting.description}
                    </Text>
                  </div>
                ))}
              </div>
            </>
          )}

          <Divider style={{ margin: 0 }} />

          {/* 存储空间 */}
          {quota && (
            <>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>存储空间</Text>
                <div style={{ marginBottom: 8 }}>
                  <Progress
                    percent={storagePercent}
                    status={storagePercent > 90 ? 'exception' : 'normal'}
                    strokeColor={storagePercent > 90 ? '#ff4d4f' : adapter.themeColor}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">已使用 {formatBytes(quota.used)}</Text>
                  <Text type="secondary">共 {formatBytes(quota.total)}</Text>
                </div>
              </div>
              {hasCloudNotes && <Divider style={{ margin: 0 }} />}
            </>
          )}

          {/* 云端笔记 */}
          {hasCloudNotes && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text strong><CloudOutlined style={{ marginRight: 8 }} />云端笔记</Text>
                <Button size="small" icon={<ReloadOutlined />} onClick={loadCloudNotes} loading={loadingNotes}>刷新</Button>
              </div>
              <Spin spinning={loadingNotes}>
                <List
                  size="small"
                  dataSource={cloudNotes}
                  locale={{ emptyText: '暂无云端笔记' }}
                  renderItem={(item) => (
                    <List.Item
                      style={{ padding: '8px 0' }}
                      actions={[
                        adapter.downloadNote && (
                          <Button key="dl" size="small" type="link" icon={<CloudDownloadOutlined />} onClick={() => handleDownloadNote(item)}>下载</Button>
                        ),
                        adapter.deleteNote && (
                          <Popconfirm key="del" title="确定删除此云端笔记？" onConfirm={() => handleDeleteNote(item)} okText="删除" cancelText="取消">
                            <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
                          </Popconfirm>
                        ),
                      ].filter(Boolean)}
                    >
                      <List.Item.Meta
                        title={item.name}
                        description={`${formatBytes(item.size)} · ${new Date(item.updatedAt).toLocaleString()}`}
                      />
                    </List.Item>
                  )}
                />
              </Spin>
            </div>
          )}
        </Space>
      )}

      {/* 文件夹浏览器 */}
      <Modal title="选择同步文件夹" open={folderBrowserVisible} onCancel={() => setFolderBrowserVisible(false)} footer={null} width={600}>
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">当前路径：</Text>
          <Text strong style={{ display: 'block', marginTop: 4 }}>{currentPath || '/ (根目录)'}</Text>
        </div>
        <Space style={{ marginBottom: 12, width: '100%' }}>
          {currentPath && (
            <Button onClick={() => { const p = currentPath.split('/').slice(0, -1).join('/'); handleBrowseFolders(p || undefined); }}>返回上级</Button>
          )}
          {adapter.createFolder && (
            <Button type="primary" icon={<FolderAddOutlined />} onClick={() => setCreateFolderVisible(true)}>新建文件夹</Button>
          )}
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
                <div style={{ flex: 1 }} onClick={() => handleBrowseFolders(folder.path)}>
                  <Space>
                    <FolderOutlined style={{ fontSize: 20, color: adapter.themeColor }} />
                    <div>
                      <Text strong>{folder.name}</Text>
                      {folder.childCount !== undefined && (
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{folder.childCount} 项</Text>
                      )}
                    </div>
                  </Space>
                </div>
                <Button type="primary" size="small" onClick={() => handleSelectFolder(folder)}>选择</Button>
              </List.Item>
            )}
          />
        </Spin>
      </Modal>

      {/* 新建文件夹 */}
      <Modal
        title="新建文件夹"
        open={createFolderVisible}
        onCancel={() => { setCreateFolderVisible(false); setNewFolderName(''); }}
        onOk={handleCreateFolder}
        confirmLoading={creatingFolder}
        okText="创建" cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">将在以下位置创建：</Text>
          <Text strong style={{ display: 'block', marginTop: 4 }}>{currentPath || '/ (根目录)'}</Text>
        </div>
        <Input
          placeholder="请输入文件夹名称"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onPressEnter={handleCreateFolder}
          maxLength={255}
          autoFocus
        />
      </Modal>
    </div>
  );
}

/**
 * 云端笔记面板 - 支持多账号
 * 列表式展示所有已连接账号的云端笔记
 */

import { useState, useEffect } from 'react';
import { List, Typography, Space, Button, Tag, Progress, message, Modal, Empty, Collapse, Badge } from 'antd';
import {
  CloudOutlined,
  ReloadOutlined,
  FolderOutlined,
  SyncOutlined,
  DeleteOutlined,
  DownOutlined,
} from '@ant-design/icons';
import type { Note } from '../types';
import type { RemoteAccount } from '../types/remote-account';

const { Text } = Typography;
const { Panel } = Collapse;

interface CloudNoteItem {
  id: string | number;
  name: string;
  updatedAt: number;
  size: number;
  path?: string;
  accountId: string;
  provider: string;
}

/** 下载回调传递的完整信息 */
export interface CloudDownloadInfo {
  content: string;
  provider: string;
  cloudFileId: string | number;
  cloudPath?: string;
  cloudMtime: number;
}

interface CloudNotesPanelProps {
  onNoteDownloaded?: (info: CloudDownloadInfo) => void;
  onNoteDeleted?: (provider: string, cloudFileId: string | number) => void;
  currentNote?: Note | null;
}

export default function CloudNotesPanel({ onNoteDownloaded, onNoteDeleted, currentNote }: CloudNotesPanelProps) {
  const [accounts, setAccounts] = useState<RemoteAccount[]>([]);
  const [cloudNotesByAccount, setCloudNotesByAccount] = useState<Map<string, CloudNoteItem[]>>(new Map());
  const [loadingAccounts, setLoadingAccounts] = useState<Set<string>>(new Set());
  const [loadingNoteId, setLoadingNoteId] = useState<string | number | null>(null);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  // 加载所有已连接的账号
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const result = await window.electronAPI.remoteAccounts.getAll();
      const connectedAccounts = result.accounts.filter(a => a.connected);
      setAccounts(connectedAccounts);
      
      // 默认展开第一个账号
      if (connectedAccounts.length > 0 && activeKeys.length === 0) {
        setActiveKeys([connectedAccounts[0].id]);
        loadAccountNotes(connectedAccounts[0].id);
      }
    } catch (error) {
      console.error('加载账号列表失败:', error);
    }
  };

  const loadAccountNotes = async (accountId: string) => {
    setLoadingAccounts(prev => new Set(prev).add(accountId));
    try {
      const account = accounts.find(a => a.id === accountId);
      if (!account) return;

      // 使用统一的 remoteAccounts API
      const cloudNotes = await window.electronAPI.remoteAccounts.getCloudNotes(accountId);
      
      let notes: CloudNoteItem[] = [];
      
      if (account.provider === 'onedrive') {
        notes = cloudNotes.map((n: any) => ({
          id: n.id,
          name: n.name,
          updatedAt: n.updatedAt,
          size: n.size,
          accountId,
          provider: 'onedrive',
        }));
      } else if (account.provider === 'baidupan') {
        notes = cloudNotes.map((f: any) => ({
          id: f.fsId,
          name: f.filename,
          updatedAt: f.serverMtime * 1000,
          size: f.size,
          path: f.path,
          accountId,
          provider: 'baidupan',
        }));
      }

      setCloudNotesByAccount(prev => new Map(prev).set(accountId, notes));
    } catch (error: any) {
      message.error(`加载 ${accounts.find(a => a.id === accountId)?.displayName} 的笔记失败: ${error.message || '未知错误'}`);
    } finally {
      setLoadingAccounts(prev => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };

  const handlePanelChange = (keys: string | string[]) => {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    setActiveKeys(keyArray);
    
    // 加载新展开的账号的笔记
    keyArray.forEach(key => {
      if (!cloudNotesByAccount.has(key)) {
        loadAccountNotes(key);
      }
    });
  };

  const isCloudNewer = (note: CloudNoteItem): boolean => {
    if (!currentNote?.cloudSource) return false;
    const cs = currentNote.cloudSource;
    if (cs.provider !== note.provider) return false;
    if (String(cs.cloudFileId) !== String(note.id)) return false;
    return note.updatedAt > cs.cloudMtime;
  };

  const isCurrentSource = (note: CloudNoteItem): boolean => {
    if (!currentNote?.cloudSource) return false;
    const cs = currentNote.cloudSource;
    return cs.provider === note.provider && String(cs.cloudFileId) === String(note.id);
  };

  const handleDoubleClick = (note: CloudNoteItem) => {
    const currentNoteName = currentNote?.name;
    const noteBaseName = note.name.replace(/\.note$/, '');
    
    if (isCurrentSource(note) && !isCloudNewer(note)) return;

    if (currentNoteName && (currentNoteName === noteBaseName || currentNoteName === note.name) && !isCurrentSource(note)) {
      Modal.confirm({
        title: '替换当前笔记？',
        content: `当前正在编辑的笔记「${currentNoteName}」与云端笔记同名，切换后将替换编辑器中的内容。未保存的修改会丢失，确定继续吗？`,
        okText: '确定',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: () => doLoad(note),
      });
    } else {
      doLoad(note);
    }
  };

  const doLoad = async (note: CloudNoteItem) => {
    setLoadingNoteId(note.id);
    try {
      let result: { success: boolean; content?: string; error?: string };
      
      if (note.provider === 'onedrive') {
        result = await window.electronAPI.onedrive.downloadNote(String(note.id));
      } else {
        result = await window.electronAPI.baidupan.downloadNote(note.id as number);
      }

      if (result.success && result.content) {
        onNoteDownloaded?.({
          content: result.content,
          provider: note.provider,
          cloudFileId: note.id,
          cloudPath: note.path,
          cloudMtime: note.updatedAt,
        });
        loadAccountNotes(note.accountId);
      } else {
        message.error(result.error || '加载失败');
      }
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoadingNoteId(null);
    }
  };

  const handleDelete = async (note: CloudNoteItem) => {
    Modal.confirm({
      title: '删除云端笔记',
      content: '确定要删除这个云端笔记吗？此操作不可恢复。',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          if (note.provider === 'onedrive') {
            await window.electronAPI.onedrive.deleteNote(String(note.id));
          } else if (note.provider === 'baidupan' && note.path) {
            await window.electronAPI.baidupan.deleteFile([note.path]);
          }
          
          message.success('云端笔记已删除');
          
          if (isCurrentSource(note)) {
            onNoteDeleted?.(note.provider, note.id);
          }
          
          loadAccountNotes(note.accountId);
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      },
    });
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getProviderColor = (provider: string) => {
    return provider === 'onedrive' ? '#0078D4' : '#06a7ff';
  };

  const getProviderLabel = (provider: string) => {
    return provider === 'onedrive' ? 'OneDrive' : '百度网盘';
  };

  if (accounts.length === 0) {
    return (
      <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>
            <CloudOutlined style={{ marginRight: 8 }} />
            云端笔记
          </Text>
        </div>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="还没有连接任何云盘账号"
          style={{ marginTop: 60 }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            请先在设置中添加并连接云盘账号
          </Text>
        </Empty>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong style={{ fontSize: 16 }}>
          <CloudOutlined style={{ marginRight: 8 }} />
          云端笔记
        </Text>
        <Button
          icon={<ReloadOutlined />}
          size="small"
          onClick={() => {
            activeKeys.forEach(key => loadAccountNotes(key));
          }}
        >
          刷新
        </Button>
      </div>

      <Collapse
        activeKey={activeKeys}
        onChange={handlePanelChange}
        expandIcon={({ isActive }) => <DownOutlined rotate={isActive ? 180 : 0} />}
        style={{ background: 'transparent', border: 'none' }}
      >
        {accounts.map(account => {
          const notes = cloudNotesByAccount.get(account.id) || [];
          const isLoading = loadingAccounts.has(account.id);
          const providerColor = getProviderColor(account.provider);
          
          return (
            <Panel
              key={account.id}
              header={
                <Space>
                  <CloudOutlined style={{ color: providerColor }} />
                  <Text strong>{account.displayName}</Text>
                  <Tag color={providerColor} style={{ fontSize: 11 }}>
                    {getProviderLabel(account.provider)}
                  </Tag>
                  <Badge count={notes.length} showZero style={{ backgroundColor: '#52c41a' }} />
                </Space>
              }
              style={{
                marginBottom: 16,
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #e8e8e8',
              }}
            >
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <Progress
                    percent={100}
                    status="active"
                    showInfo={false}
                    strokeColor={{ from: '#1890ff', to: '#52c41a' }}
                  />
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                    加载中...
                  </Text>
                </div>
              ) : notes.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="云端暂无笔记"
                  style={{ padding: '20px 0' }}
                />
              ) : (
                <List
                  dataSource={notes}
                  renderItem={(note) => {
                    const newer = isCloudNewer(note);
                    const isCurrent = isCurrentSource(note);
                    const isLoadingNote = loadingNoteId === note.id;
                    
                    return (
                      <List.Item
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          background: isCurrent ? '#f6ffed' : '#fafafa',
                          border: newer ? '1px solid #faad14' : isCurrent ? '1px solid #b7eb8f' : '1px solid #e8e8e8',
                          transition: 'all 0.3s',
                          cursor: 'pointer',
                          userSelect: 'none',
                          opacity: isLoadingNote ? 0.6 : 1,
                          position: 'relative',
                        }}
                        onDoubleClick={() => handleDoubleClick(note)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = newer ? '#faad14' : providerColor;
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                          const del = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                          if (del) del.style.opacity = '1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = newer ? '#faad14' : isCurrent ? '#b7eb8f' : '#e8e8e8';
                          e.currentTarget.style.boxShadow = 'none';
                          const del = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                          if (del) del.style.opacity = '0';
                        }}
                      >
                        {isLoadingNote && (
                          <Progress
                            percent={100}
                            status="active"
                            showInfo={false}
                            size="small"
                            style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
                            strokeColor={{ from: '#1890ff', to: '#52c41a' }}
                          />
                        )}
                        <div
                          className="delete-btn"
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            zIndex: 10,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(note);
                          }}
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          <DeleteOutlined style={{ fontSize: 14, color: '#ff4d4f', cursor: 'pointer' }} />
                        </div>
                        <List.Item.Meta
                          avatar={<FolderOutlined style={{ fontSize: 24, color: newer ? '#faad14' : isCurrent ? '#52c41a' : providerColor }} />}
                          title={
                            <Space>
                              <Text strong>{note.name}</Text>
                              {newer && <Tag color="orange"><SyncOutlined /> 云端有更新</Tag>}
                              {isCurrent && <Tag color="green">当前</Tag>}
                            </Space>
                          }
                          description={
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {formatDate(note.updatedAt)} · {formatSize(note.size)}
                              </Text>
                              {!isCurrent && !newer && (
                                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                                  双击打开
                                </Text>
                              )}
                              {newer && (
                                <Text type="warning" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                                  双击更新到最新版本
                                </Text>
                              )}
                            </div>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              )}
            </Panel>
          );
        })}
      </Collapse>
    </div>
  );
}

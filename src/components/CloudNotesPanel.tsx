import { useState, useEffect } from 'react';
import { List, Typography, Space, Button, Tag, Progress, message, Modal, Radio, Popconfirm } from 'antd';
import {
  CloudOutlined,
  ReloadOutlined,
  FolderOutlined,
  SyncOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { Note } from '../types';

const { Text } = Typography;

type CloudProvider = 'onedrive' | 'baidupan';

interface CloudNoteItem {
  id: string | number;
  name: string;
  updatedAt: number;
  size: number;
  existsLocally?: boolean;
  path?: string;
}

interface ProviderConfig {
  key: CloudProvider;
  label: string;
  color: string;
  isAuthenticated: () => Promise<boolean>;
  getCloudNotes: () => Promise<CloudNoteItem[]>;
  downloadNote: (id: string | number) => Promise<{ success: boolean; content?: string; error?: string }>;
  deleteNote: (note: CloudNoteItem) => Promise<{ success: boolean }>;
}

const PROVIDERS: ProviderConfig[] = [
  {
    key: 'onedrive',
    label: 'OneDrive',
    color: '#0078D4',
    isAuthenticated: () => window.electronAPI.onedrive.isAuthenticated(),
    getCloudNotes: async () => {
      const notes = await window.electronAPI.onedrive.getCloudNotes();
      return notes.map(n => ({ id: n.id, name: n.name, updatedAt: n.updatedAt, size: n.size, existsLocally: n.existsLocally }));
    },
    downloadNote: async (id) => {
      const result = await window.electronAPI.onedrive.downloadNote(String(id));
      return { success: result.success, content: result.content, error: result.error };
    },
    deleteNote: (note) => window.electronAPI.onedrive.deleteNote(String(note.id)),
  },
  {
    key: 'baidupan',
    label: '百度网盘',
    color: '#06a7ff',
    isAuthenticated: () => window.electronAPI.baidupan.isAuthenticated(),
    getCloudNotes: async () => {
      const files = await window.electronAPI.baidupan.getCloudNotes();
      return files.map(f => ({ id: f.fsId, name: f.filename, updatedAt: f.serverMtime * 1000, size: f.size, path: f.path }));
    },
    downloadNote: (id) => window.electronAPI.baidupan.downloadNote(id as number),
    deleteNote: (note) => window.electronAPI.baidupan.deleteFile([note.path!]),
  },
];

/** 下载回调传递的完整信息 */
export interface CloudDownloadInfo {
  content: string;
  provider: CloudProvider;
  cloudFileId: string | number;
  cloudPath?: string;
  cloudMtime: number;
}

interface CloudNotesPanelProps {
  onNoteDownloaded?: (info: CloudDownloadInfo) => void;
  onNoteDeleted?: (provider: CloudProvider, cloudFileId: string | number) => void;
  currentNote?: Note | null;
}

export default function CloudNotesPanel({ onNoteDownloaded, onNoteDeleted, currentNote }: CloudNotesPanelProps) {
  const [cloudNotes, setCloudNotes] = useState<CloudNoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingNoteId, setLoadingNoteId] = useState<string | number | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider>('onedrive');
  const [authenticatedProviders, setAuthenticatedProviders] = useState<Set<CloudProvider>>(new Set());

  useEffect(() => {
    const check = async () => {
      const authed = new Set<CloudProvider>();
      for (const p of PROVIDERS) {
        try {
          if (await p.isAuthenticated()) authed.add(p.key);
        } catch { /* ignore */ }
      }
      setAuthenticatedProviders(authed);
      if (authed.size > 0) {
        const first = PROVIDERS.find(p => authed.has(p.key));
        if (first) setSelectedProvider(first.key);
      }
    };
    check();
  }, []);

  useEffect(() => {
    if (authenticatedProviders.has(selectedProvider)) {
      loadCloudNotes();
    }
  }, [selectedProvider, authenticatedProviders]);

  const getProvider = () => PROVIDERS.find(p => p.key === selectedProvider)!;

  const loadCloudNotes = async () => {
    setLoading(true);
    try {
      const notes = await getProvider().getCloudNotes();
      setCloudNotes(notes);
    } catch (error: any) {
      message.error(error.message || '加载云端笔记失败');
      setCloudNotes([]);
    } finally {
      setLoading(false);
    }
  };

  const isCloudNewer = (note: CloudNoteItem): boolean => {
    if (!currentNote?.cloudSource) return false;
    const cs = currentNote.cloudSource;
    if (cs.provider !== selectedProvider) return false;
    if (String(cs.cloudFileId) !== String(note.id)) return false;
    return note.updatedAt > cs.cloudMtime;
  };

  const isCurrentSource = (note: CloudNoteItem): boolean => {
    if (!currentNote?.cloudSource) return false;
    const cs = currentNote.cloudSource;
    return cs.provider === selectedProvider && String(cs.cloudFileId) === String(note.id);
  };

  /** 双击笔记项 — 直接加载 */
  const handleDoubleClick = (note: CloudNoteItem) => {
    const currentNoteName = currentNote?.name;
    const noteBaseName = note.name.replace(/\.note$/, '');
    // 如果是当前已同步的笔记且没有更新，不需要重新加载
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
      const provider = getProvider();
      const result = await provider.downloadNote(note.id);

      if (result.success && result.content) {
        onNoteDownloaded?.({
          content: result.content,
          provider: selectedProvider,
          cloudFileId: note.id,
          cloudPath: note.path,
          cloudMtime: note.updatedAt,
        });
        loadCloudNotes();
      } else {
        message.error(result.error || '加载失败');
      }
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoadingNoteId(null);
    }
  };

  /** 删除云端笔记 */
  const handleDelete = async (note: CloudNoteItem) => {
    try {
      const provider = getProvider();
      await provider.deleteNote(note);
      message.success('云端笔记已删除');
      // 如果删除的是当前预览的笔记，通知父组件
      if (isCurrentSource(note)) {
        onNoteDeleted?.(selectedProvider, note.id);
      }
      loadCloudNotes();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
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

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Text strong style={{ fontSize: 16 }}>
            <CloudOutlined style={{ marginRight: 8 }} />
            云端笔记
          </Text>
          <Tag color="blue">{cloudNotes.length} 个</Tag>
        </Space>
        <Button icon={<ReloadOutlined />} size="small" onClick={loadCloudNotes} loading={loading}>
          刷新
        </Button>
      </div>

      {/* 云盘切换 */}
      <div style={{ marginBottom: 16 }}>
        <Radio.Group
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          size="small"
        >
          {PROVIDERS.map((p) => (
            <Radio.Button
              key={p.key}
              value={p.key}
              disabled={!authenticatedProviders.has(p.key)}
            >
              {p.label}
              {!authenticatedProviders.has(p.key) && ' (未登录)'}
            </Radio.Button>
          ))}
        </Radio.Group>
      </div>

      {/* 加载进度条 */}
      {loading && (
        <Progress
          percent={100}
          status="active"
          showInfo={false}
          strokeColor={{ from: '#1890ff', to: '#52c41a' }}
          style={{ marginBottom: 16 }}
          size="small"
        />
      )}

      <List
        dataSource={cloudNotes}
        locale={{ emptyText: loading ? ' ' : '云端暂无笔记' }}
        renderItem={(note) => {
          const newer = isCloudNewer(note);
          const isCurrent = isCurrentSource(note) && !newer;
          const isLoading = loadingNoteId === note.id;
          return (
            <List.Item
              style={{
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '8px',
                background: isCurrent ? '#f6ffed' : '#fff',
                border: newer ? '1px solid #faad14' : isCurrent ? '1px solid #b7eb8f' : '1px solid #e8e8e8',
                transition: 'all 0.3s',
                cursor: 'pointer',
                userSelect: 'none',
                opacity: isLoading ? 0.6 : 1,
                position: 'relative',
              }}
              onDoubleClick={() => handleDoubleClick(note)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = newer ? '#faad14' : '#1890ff'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; const del = e.currentTarget.querySelector('.delete-btn') as HTMLElement; if (del) del.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = newer ? '#faad14' : isCurrent ? '#b7eb8f' : '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; const del = e.currentTarget.querySelector('.delete-btn') as HTMLElement; if (del) del.style.opacity = '0'; }}
            >
              {isLoading && (
                <Progress
                  percent={100}
                  status="active"
                  showInfo={false}
                  size="small"
                  style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
                  strokeColor={{ from: '#1890ff', to: '#52c41a' }}
                />
              )}
              <Popconfirm
                title="删除云端笔记"
                description="确定要删除这个云端笔记吗？此操作不可恢复。"
                onConfirm={(e) => { e?.stopPropagation(); handleDelete(note); }}
                onCancel={(e) => e?.stopPropagation()}
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
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
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <DeleteOutlined style={{ fontSize: 14, color: '#ff4d4f', cursor: 'pointer' }} />
                </div>
              </Popconfirm>
              <List.Item.Meta
                avatar={<FolderOutlined style={{ fontSize: 24, color: newer ? '#faad14' : isCurrent ? '#52c41a' : '#1890ff' }} />}
                title={
                  <Space>
                    <Text strong>{note.name}</Text>
                    {newer && <Tag color="orange"><SyncOutlined /> 云端有更新</Tag>}
                    {isCurrent && <Tag color="green">当前</Tag>}
                  </Space>
                }
                description={
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{formatDate(note.updatedAt)} · {formatSize(note.size)}</Text>
                    {!isCurrent && !newer && (
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>双击打开</Text>
                    )}
                    {newer && (
                      <Text type="warning" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>双击更新到最新版本</Text>
                    )}
                  </div>
                }
              />
            </List.Item>
          );
        }}
      />
    </div>
  );
}

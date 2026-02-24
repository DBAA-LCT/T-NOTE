import { Button, Typography, Input, Space, Tag, Dropdown, Modal, message, Empty } from 'antd';
import { FileTextOutlined, PlusOutlined, EditOutlined, SaveOutlined, CloudUploadOutlined, DownloadOutlined, CloudOutlined, CloseOutlined, HistoryOutlined, DeleteOutlined, DownOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import OneDriveSyncButton from './OneDriveSyncButton';
import OfflineModeIndicator from './OfflineModeIndicator';
import UploadToCloudButton, { type CloudProvider } from './UploadToCloudButton';
import type { Note } from '../types';
import type { RecentNoteItem } from '../types/onedrive-sync';

const { Title, Text } = Typography;

interface TopBarProps {
  noteName: string;
  hasNote: boolean;
  hasUnsavedChanges: boolean;
  currentNote: Note | null;
  currentFilePath: string | null;
  onSave: () => void;
  onSaveAs: () => void;
  onOpen: () => void;
  onCreateNew: () => void;
  onUpdateNoteName: (name: string) => void;
  onUploadSuccess?: (cloudSource: { provider: CloudProvider; cloudFileId: string | number; cloudPath?: string; cloudMtime: number }) => void;
  isPreviewMode?: boolean;
  onSaveToCloud?: () => void;
  onSaveToLocal?: () => void;
  onCloseNote?: () => void;
  cloudSaving?: boolean;
  onOpenRecentNote?: (filePath: string) => void;
}

export default function TopBar({ 
  noteName, 
  hasNote, 
  hasUnsavedChanges,
  currentNote,
  currentFilePath,
  onSave, 
  onSaveAs, 
  onOpen, 
  onCreateNew, 
  onUpdateNoteName,
  onUploadSuccess,
  isPreviewMode,
  onSaveToCloud,
  onSaveToLocal,
  onCloseNote,
  cloudSaving,
  onOpenRecentNote,
}: TopBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(noteName);
  const [recentNotes, setRecentNotes] = useState<RecentNoteItem[]>([]);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const loadRecentNotes = async () => {
    try {
      const notes = await window.electronAPI.recentNotes.get();
      setRecentNotes(notes);
    } catch {
      setRecentNotes([]);
    }
  };

  useEffect(() => {
    loadRecentNotes();
  }, []);

  const handleRecentNoteClick = (note: RecentNoteItem) => {
    setDropdownVisible(false);
    Modal.confirm({
      title: '打开笔记',
      content: `要如何打开「${note.name}」？`,
      okText: '当前窗口',
      cancelText: '新窗口',
      closable: true,
      onOk: () => {
        onOpenRecentNote?.(note.filePath);
      },
      onCancel: async () => {
        try {
          await window.electronAPI.openNoteInNewWindow(note.filePath);
        } catch (error: any) {
          message.error(error.message || '打开新窗口失败');
        }
      },
    });
  };

  const handleRemove = async (e: React.MouseEvent, filePath: string) => {
    e.stopPropagation();
    await window.electronAPI.recentNotes.remove(filePath);
    loadRecentNotes();
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const handleStartEdit = () => {
    setEditValue(noteName);
    setIsEditing(true);
  };

  const handleFinishEdit = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue) {
      onUpdateNoteName(trimmedValue);
    } else {
      setEditValue(noteName);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishEdit();
    } else if (e.key === 'Escape') {
      setEditValue(noteName);
      setIsEditing(false);
    }
  };

  return (
    <div style={{ 
      height: 48,
      background: isPreviewMode ? '#e6f4ff' : '#fff',
      borderBottom: isPreviewMode ? '1px solid #91caff' : '1px solid #e8e8e8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      transition: 'background 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {!hasNote ? (
          <>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              size="large"
              onClick={onCreateNew}
            >
              新建笔记
            </Button>
            <Dropdown
              menu={{
                items: recentNotes.length === 0 ? [{
                  key: 'empty',
                  label: (
                    <Empty 
                      description="暂无最近笔记" 
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      style={{ margin: '16px 0' }}
                    />
                  ),
                  disabled: true,
                }] : recentNotes.map(note => ({
                  key: note.filePath,
                  label: (
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '4px 0',
                        position: 'relative',
                        minWidth: '250px'
                      }}
                      onMouseEnter={(e) => {
                        const del = e.currentTarget.querySelector('.recent-del') as HTMLElement;
                        if (del) del.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        const del = e.currentTarget.querySelector('.recent-del') as HTMLElement;
                        if (del) del.style.opacity = '0';
                      }}
                    >
                      <FileTextOutlined style={{ fontSize: 16, color: '#1890ff', marginTop: '2px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '13px', marginBottom: '2px' }}>
                          {note.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#999' }}>
                          {formatTime(note.openedAt)}
                        </div>
                      </div>
                      <DeleteOutlined 
                        className="recent-del"
                        style={{ 
                          fontSize: 12, 
                          color: '#999', 
                          opacity: 0, 
                          transition: 'opacity 0.2s',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                        onClick={(e) => handleRemove(e, note.filePath)}
                      />
                    </div>
                  ),
                  onClick: () => handleRecentNoteClick(note),
                })),
                style: {
                  maxHeight: '400px',
                  overflowY: 'auto',
                }
              }}
              trigger={['click']}
              placement="bottomLeft"
              open={dropdownVisible}
              onOpenChange={(visible) => {
                setDropdownVisible(visible);
                if (visible) loadRecentNotes();
              }}
            >
              <Button 
                icon={<HistoryOutlined />}
                size="large"
              >
                最近笔记 <DownOutlined style={{ fontSize: 10 }} />
              </Button>
            </Dropdown>
          </>
        ) : isEditing ? (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleFinishEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{ fontSize: 16, fontWeight: 500, maxWidth: 400 }}
          />
        ) : (
          <Dropdown
            menu={{
              items: recentNotes.length === 0 ? [{
                key: 'empty',
                label: (
                  <Empty 
                    description="暂无最近笔记" 
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    style={{ margin: '16px 0' }}
                  />
                ),
                disabled: true,
              }] : recentNotes.map(note => ({
                key: note.filePath,
                label: (
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '4px 0',
                      position: 'relative',
                      minWidth: '250px'
                    }}
                    onMouseEnter={(e) => {
                      const del = e.currentTarget.querySelector('.recent-del') as HTMLElement;
                      if (del) del.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      const del = e.currentTarget.querySelector('.recent-del') as HTMLElement;
                      if (del) del.style.opacity = '0';
                    }}
                  >
                    <FileTextOutlined style={{ fontSize: 16, color: '#1890ff', marginTop: '2px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '13px', marginBottom: '2px' }}>
                        {note.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#999' }}>
                        {formatTime(note.openedAt)}
                      </div>
                    </div>
                    <DeleteOutlined 
                      className="recent-del"
                      style={{ 
                        fontSize: 12, 
                        color: '#999', 
                        opacity: 0, 
                        transition: 'opacity 0.2s',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      onClick={(e) => handleRemove(e, note.filePath)}
                    />
                  </div>
                ),
                onClick: () => handleRecentNoteClick(note),
              })),
              style: {
                maxHeight: '400px',
                overflowY: 'auto',
              }
            }}
            trigger={['click']}
            placement="bottomLeft"
            open={dropdownVisible}
            onOpenChange={(visible) => {
              setDropdownVisible(visible);
              if (visible) loadRecentNotes();
            }}
          >
            <div 
              style={{ 
                display: 'flex', alignItems: 'center', cursor: 'pointer',
                padding: '4px 8px', borderRadius: 4, transition: 'background 0.3s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = isPreviewMode ? '#bae0ff' : '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onDoubleClick={handleStartEdit}
            >
              {isPreviewMode ? (
                <CloudOutlined style={{ marginRight: 8, color: '#1677ff', fontSize: 18 }} />
              ) : (
                <FileTextOutlined style={{ marginRight: 8, color: '#1677ff', fontSize: 18 }} />
              )}
              <Title level={5} style={{ margin: 0, color: '#1677ff' }}>
                {noteName}
              </Title>
              {isPreviewMode && (
                <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>云端</Tag>
              )}
              <DownOutlined style={{ marginLeft: 8, fontSize: 10, color: '#8c8c8c' }} />
            </div>
          </Dropdown>
        )}
      </div>

      <Space size={12}>
        <OfflineModeIndicator />
        
        {isPreviewMode ? (
          <>
            {hasUnsavedChanges && (
              <Tag color="warning" style={{ margin: 0, fontSize: 13, padding: '4px 12px' }}>
                有修改
              </Tag>
            )}
            <Button
              icon={<CloudUploadOutlined />}
              onClick={onSaveToCloud}
              loading={cloudSaving}
            >
              保存到云端
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={onSaveToLocal}
            >
              保存到本地
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={onCloseNote}
              title="关闭笔记"
            />
          </>
        ) : (
          <>
            {hasNote && currentNote && !currentNote.syncConfig?.enabled && (
              <UploadToCloudButton
                noteId={currentNote.id}
                noteName={currentNote.name}
                noteContent={JSON.stringify(currentNote, null, 2)}
                currentFilePath={currentFilePath || undefined}
                cloudSource={currentNote.cloudSource}
                onUploadSuccess={onUploadSuccess}
              />
            )}
            
            {hasNote && currentNote?.syncConfig?.enabled && (
              <OneDriveSyncButton />
            )}
            
            {hasNote && hasUnsavedChanges && (
              <>
                <Tag color="warning" style={{ margin: 0, fontSize: 13, padding: '4px 12px' }}>
                  未保存
                </Tag>
                <Button 
                  type="primary" 
                  icon={<SaveOutlined />}
                  onClick={onSave}
                >
                  保存
                </Button>
              </>
            )}

            {hasNote && (
              <Button
                icon={<CloseOutlined />}
                onClick={onCloseNote}
                title="关闭笔记"
              />
            )}
          </>
        )}
      </Space>
    </div>
  );
}

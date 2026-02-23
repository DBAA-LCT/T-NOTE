import { Button, Typography, Input, Space, Tag } from 'antd';
import { FileTextOutlined, PlusOutlined, EditOutlined, SaveOutlined, CloudUploadOutlined, DownloadOutlined, CloudOutlined, CloseOutlined } from '@ant-design/icons';
import { useState } from 'react';
import OneDriveSyncButton from './OneDriveSyncButton';
import OfflineModeIndicator from './OfflineModeIndicator';
import UploadToCloudButton, { type CloudProvider } from './UploadToCloudButton';
import type { Note } from '../types';

const { Title } = Typography;

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
}: TopBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(noteName);

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
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            size="large"
            onClick={onCreateNew}
          >
            新建笔记
          </Button>
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
          <div 
            style={{ 
              display: 'flex', alignItems: 'center', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 4, transition: 'background 0.3s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = isPreviewMode ? '#bae0ff' : '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            onClick={handleStartEdit}
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
            <EditOutlined style={{ marginLeft: 8, fontSize: 12, color: '#8c8c8c' }} />
          </div>
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

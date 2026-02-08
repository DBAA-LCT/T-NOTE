import { Button, Typography, Input } from 'antd';
import { FileTextOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Title } = Typography;

interface TopBarProps {
  noteName: string;
  hasNote: boolean;
  onSave: () => void;
  onSaveAs: () => void;
  onOpen: () => void;
  onCreateNew: () => void;
  onUpdateNoteName: (name: string) => void;
}

export default function TopBar({ noteName, hasNote, onSave, onSaveAs, onOpen, onCreateNew, onUpdateNoteName }: TopBarProps) {
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
      height: 60,
      background: '#fff',
      borderBottom: '2px solid #e8e8e8',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    }}>
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
          style={{ 
            fontSize: 20,
            fontWeight: 500,
            maxWidth: 400
          }}
        />
      ) : (
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 4,
            transition: 'background 0.3s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          onClick={handleStartEdit}
        >
          <FileTextOutlined style={{ marginRight: 8, color: '#1677ff', fontSize: 20 }} />
          <Title level={4} style={{ margin: 0, color: '#1677ff' }}>
            {noteName}
          </Title>
          <EditOutlined style={{ marginLeft: 8, fontSize: 14, color: '#8c8c8c' }} />
        </div>
      )}
    </div>
  );
}

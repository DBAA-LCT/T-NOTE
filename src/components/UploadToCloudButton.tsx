import { useState } from 'react';
import { Button, Modal, Input, message, Space, Typography } from 'antd';
import { CloudUploadOutlined, FolderOpenOutlined } from '@ant-design/icons';
import FolderBrowser from './FolderBrowser';

const { Text } = Typography;

interface UploadToCloudButtonProps {
  noteId: string;
  noteName: string;
  noteContent: string;
  currentFilePath?: string;
  onUploadSuccess?: () => void;
}

export default function UploadToCloudButton({
  noteId,
  noteName,
  noteContent,
  currentFilePath,
  onUploadSuccess
}: UploadToCloudButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [syncFolder, setSyncFolder] = useState<string>('');
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);

  const handleUploadClick = async () => {
    try {
      const folder = await window.electronAPI.onedrive.getSyncFolder();
      setSyncFolder(folder || '/Notes');
      setShowDialog(true);
    } catch (error) {
      message.error('获取同步文件夹失败');
    }
  };

  const handleConfirmUpload = async () => {
    if (!syncFolder) {
      message.error('请选择同步文件夹');
      return;
    }

    // 验证笔记内容
    try {
      const note = JSON.parse(noteContent);
      if (!note.pages || note.pages.length === 0) {
        message.warning('笔记没有任何页面，确定要上传吗？');
      }
      console.log('准备上传笔记:', {
        id: note.id,
        name: note.name,
        pagesCount: note.pages?.length || 0,
        contentLength: noteContent.length
      });
    } catch (error) {
      message.error('笔记内容格式错误');
      return;
    }

    setUploading(true);
    try {
      // 先设置同步文件夹
      await window.electronAPI.onedrive.setSyncFolder(syncFolder);
      
      // 上传笔记内容到云端
      const result = await window.electronAPI.onedrive.uploadNoteContent({
        noteContent,
        noteName,
        noteId,
        currentFilePath
      });

      if (result.success) {
        message.success(`笔记已上传到云端：${result.fileName || ''}`);
        setShowDialog(false);
        
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        message.error('上传失败');
      }
    } catch (error: any) {
      console.error('上传失败:', error);
      message.error(error.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleFolderSelect = (folderPath: string) => {
    setSyncFolder(folderPath);
  };

  return (
    <>
      <Button
        type="primary"
        icon={<CloudUploadOutlined />}
        onClick={handleUploadClick}
      >
        上传到云端
      </Button>

      <Modal
        title="上传笔记到云端"
        open={showDialog}
        onCancel={() => setShowDialog(false)}
        onOk={handleConfirmUpload}
        okText="上传"
        cancelText="取消"
        confirmLoading={uploading}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong>笔记名称：</Text>
            <Text>{noteName}</Text>
          </div>
          
          <div>
            <Text strong>云端保存位置：</Text>
            <Space.Compact style={{ width: '100%', marginTop: 8 }}>
              <Input
                value={syncFolder}
                onChange={(e) => setSyncFolder(e.target.value)}
                placeholder="输入云端文件夹路径，如 /Notes"
              />
              <Button 
                icon={<FolderOpenOutlined />} 
                onClick={() => setShowFolderBrowser(true)}
              >
                浏览
              </Button>
            </Space.Compact>
          </div>

          <div style={{
            padding: 12,
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: 4
          }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              笔记将上传到 OneDrive 的指定文件夹中。上传后可以在其他设备上同步访问。
            </Text>
          </div>
        </Space>
      </Modal>

      <FolderBrowser
        visible={showFolderBrowser}
        onClose={() => setShowFolderBrowser(false)}
        onSelect={handleFolderSelect}
        initialPath={syncFolder}
      />
    </>
  );
}

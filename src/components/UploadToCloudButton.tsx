import { useState, useEffect } from 'react';
import { Button, Modal, Input, message, Space, Typography, Radio } from 'antd';
import { CloudUploadOutlined, FolderOpenOutlined } from '@ant-design/icons';
import FolderBrowser from './FolderBrowser';

const { Text } = Typography;

export type CloudProvider = 'onedrive' | 'baidupan';

interface ProviderOption {
  key: CloudProvider;
  label: string;
  color: string;
  isAuthenticated: () => Promise<boolean>;
  getSyncFolder: () => Promise<string | null>;
  setSyncFolder: (path: string) => Promise<void>;
  upload: (params: { noteContent: string; noteName: string; noteId: string; currentFilePath?: string; cloudSource?: { provider: string; cloudFileId: string | number; cloudPath?: string } }) => Promise<any>;
  /** 是否支持文件夹浏览器 */
  hasFolderBrowser: boolean;
}

const PROVIDERS: ProviderOption[] = [
  {
    key: 'onedrive',
    label: 'OneDrive',
    color: '#0078D4',
    isAuthenticated: () => window.electronAPI.onedrive.isAuthenticated(),
    getSyncFolder: () => window.electronAPI.onedrive.getSyncFolder(),
    setSyncFolder: (p) => window.electronAPI.onedrive.setSyncFolder(p),
    upload: (params) => window.electronAPI.onedrive.uploadNoteContent(params),
    hasFolderBrowser: true,
  },
  {
    key: 'baidupan',
    label: '百度网盘',
    color: '#06a7ff',
    isAuthenticated: () => window.electronAPI.baidupan.isAuthenticated(),
    getSyncFolder: () => window.electronAPI.baidupan.getSyncFolder(),
    setSyncFolder: (p) => window.electronAPI.baidupan.setSyncFolder(p),
    upload: (params) => window.electronAPI.baidupan.uploadNote(params),
    hasFolderBrowser: true,
  },
];

interface UploadToCloudButtonProps {
  noteId: string;
  noteName: string;
  noteContent: string;
  currentFilePath?: string;
  cloudSource?: { provider: string; cloudFileId: string | number; cloudPath?: string };
  onUploadSuccess?: (cloudSource: { provider: CloudProvider; cloudFileId: string | number; cloudPath?: string; cloudMtime: number }) => void;
}

export default function UploadToCloudButton({
  noteId,
  noteName,
  noteContent,
  currentFilePath,
  cloudSource,
  onUploadSuccess,
}: UploadToCloudButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [syncFolder, setSyncFolder] = useState('');
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider>('onedrive');
  const [authenticatedProviders, setAuthenticatedProviders] = useState<Set<CloudProvider>>(new Set());

  // 检查哪些云盘已登录
  useEffect(() => {
    const check = async () => {
      const authed = new Set<CloudProvider>();
      for (const p of PROVIDERS) {
        try {
          if (await p.isAuthenticated()) authed.add(p.key);
        } catch { /* ignore */ }
      }
      setAuthenticatedProviders(authed);
      // 默认选中第一个已登录的
      if (authed.size > 0) {
        const first = PROVIDERS.find(p => authed.has(p.key));
        if (first) setSelectedProvider(first.key);
      }
    };
    check();
  }, []);

  const getProvider = () => PROVIDERS.find(p => p.key === selectedProvider)!;

  const handleUploadClick = async () => {
    if (authenticatedProviders.size === 0) {
      message.warning('请先在设置中登录一个云盘账号');
      return;
    }
    try {
      const provider = getProvider();
      const folder = await provider.getSyncFolder();
      setSyncFolder(folder || '/Notes');
      setShowDialog(true);
    } catch {
      setShowDialog(true);
    }
  };

  const handleConfirmUpload = async () => {
    // 验证笔记内容
    try {
      const note = JSON.parse(noteContent);
      if (!note.pages || note.pages.length === 0) {
        message.warning('笔记没有任何页面，确定要上传吗？');
      }
    } catch {
      message.error('笔记内容格式错误');
      return;
    }

    const provider = getProvider();
    setUploading(true);
    try {
      // 设置同步文件夹
      if (syncFolder) {
        await provider.setSyncFolder(syncFolder);
      }

      const result = await provider.upload({
        noteContent,
        noteName,
        noteId,
        currentFilePath,
        cloudSource: cloudSource?.provider === selectedProvider ? cloudSource : undefined,
      });

      if (result.success !== false) {
        message.success(`笔记已上传到 ${provider.label}`);
        setShowDialog(false);
        onUploadSuccess?.({
          provider: selectedProvider,
          cloudFileId: result.cloudId || '',
          cloudPath: result.path,
          cloudMtime: Date.now(),
        });
      } else {
        message.error('上传失败');
      }
    } catch (error: any) {
      message.error(error.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleFolderSelect = (folderPath: string) => {
    setSyncFolder(folderPath);
  };

  // 切换云盘时重新加载同步文件夹
  const handleProviderChange = async (key: CloudProvider) => {
    setSelectedProvider(key);
    const provider = PROVIDERS.find(p => p.key === key)!;
    try {
      const folder = await provider.getSyncFolder();
      setSyncFolder(folder || '/Notes');
    } catch {
      setSyncFolder('/Notes');
    }
  };

  const currentProvider = getProvider();

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
          {/* 选择云盘 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>选择云盘：</Text>
            <Radio.Group
              value={selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
            >
              {PROVIDERS.map((p) => (
                <Radio.Button
                  key={p.key}
                  value={p.key}
                  disabled={!authenticatedProviders.has(p.key)}
                  style={{
                    borderColor: selectedProvider === p.key ? p.color : undefined,
                    color: selectedProvider === p.key ? p.color : undefined,
                  }}
                >
                  {p.label}
                  {!authenticatedProviders.has(p.key) && ' (未登录)'}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>

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
                placeholder="输入云端文件夹路径"
              />
              {currentProvider.hasFolderBrowser && (
                <Button
                  icon={<FolderOpenOutlined />}
                  onClick={() => setShowFolderBrowser(true)}
                >
                  浏览
                </Button>
              )}
            </Space.Compact>
          </div>

          <div style={{
            padding: 12,
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: 4,
          }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              笔记将上传到 {currentProvider.label} 的指定文件夹中。上传后可以在其他设备上同步访问。
            </Text>
          </div>
        </Space>
      </Modal>

      {currentProvider.hasFolderBrowser && (
        <FolderBrowser
          visible={showFolderBrowser}
          onClose={() => setShowFolderBrowser(false)}
          onSelect={handleFolderSelect}
          initialPath={syncFolder}
          provider={selectedProvider}
        />
      )}
    </>
  );
}

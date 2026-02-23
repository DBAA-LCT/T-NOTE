import { WifiOutlined, SaveOutlined } from '@ant-design/icons';
import CloudStoragePanel from './CloudStoragePanel';
import type { CloudStorageAdapter, CloudUserInfo, CloudQuota, CloudFolderItem, CloudSyncSetting } from './CloudStoragePanel';

const oneDriveAdapter: CloudStorageAdapter = {
  name: 'OneDrive',
  themeColor: '#1677ff',

  isAuthenticated: () => window.electronAPI.onedrive.isAuthenticated(),

  authenticate: async (): Promise<CloudUserInfo> => {
    const info = await window.electronAPI.onedrive.authenticate();
    return { displayName: info.displayName, secondaryInfo: `邮箱：${info.email}` };
  },

  disconnect: () => window.electronAPI.onedrive.disconnect(),

  getUserInfo: async (): Promise<CloudUserInfo> => {
    const info = await window.electronAPI.onedrive.getUserInfo();
    return { displayName: info.displayName, secondaryInfo: `邮箱：${info.email}` };
  },

  getQuota: async (): Promise<CloudQuota> => {
    const q = await window.electronAPI.onedrive.getStorageQuota();
    return { used: q.used, total: q.total };
  },

  getSyncFolder: () => window.electronAPI.onedrive.getSyncFolder(),

  browseFolders: async (parentPath?: string): Promise<CloudFolderItem[]> => {
    const folders = await window.electronAPI.onedrive.browseFolders(parentPath);
    return folders.map(f => ({ name: f.name, path: f.path, childCount: f.childCount }));
  },

  setSyncFolder: (path: string) => window.electronAPI.onedrive.setSyncFolder(path),

  createFolder: async (name: string, parentPath?: string): Promise<CloudFolderItem> => {
    const f = await window.electronAPI.onedrive.createFolder(name, parentPath);
    return { name: f.name, path: f.path, childCount: f.childCount };
  },

  getSyncSettings: async (): Promise<CloudSyncSetting[]> => {
    const s = await window.electronAPI.onedrive.getSyncSettings();
    return [
      {
        key: 'wifiOnly',
        label: '仅 WiFi 下同步',
        description: '启用后，仅在 WiFi 网络下执行同步操作',
        icon: <WifiOutlined />,
        value: s.wifiOnly ?? false,
      },
      {
        key: 'saveConflictCopy',
        label: '保存冲突副本',
        description: '解决冲突时，自动保存被覆盖版本的副本',
        icon: <SaveOutlined />,
        value: s.saveConflictCopy ?? true,
      },
    ];
  },

  updateSyncSetting: async (key: string, value: boolean) => {
    await window.electronAPI.onedrive.updateSyncSettings({ [key]: value });
  },
};

export default function OneDriveSettingsPanel() {
  return <CloudStoragePanel adapter={oneDriveAdapter} />;
}

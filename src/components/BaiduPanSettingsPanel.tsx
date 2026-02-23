import { WifiOutlined, SaveOutlined } from '@ant-design/icons';
import CloudStoragePanel from './CloudStoragePanel';
import type { CloudStorageAdapter, CloudUserInfo, CloudQuota, CloudNoteItem, CloudFolderItem, CloudSyncSetting } from './CloudStoragePanel';

const vipLabel = (type: number) => {
  if (type === 2) return '会员状态：超级会员';
  if (type === 1) return '会员状态：会员';
  return '会员状态：普通用户';
};

const baiduPanAdapter: CloudStorageAdapter = {
  name: '百度网盘',
  themeColor: '#06a7ff',

  isAuthenticated: () => window.electronAPI.baidupan.isAuthenticated(),

  authenticate: async (): Promise<CloudUserInfo> => {
    const info = await window.electronAPI.baidupan.authenticate();
    return { displayName: info.netdiskName || info.baiduName, secondaryInfo: vipLabel(info.vipType) };
  },

  disconnect: () => window.electronAPI.baidupan.disconnect(),

  getUserInfo: async (): Promise<CloudUserInfo> => {
    const info = await window.electronAPI.baidupan.getUserInfo();
    return { displayName: info.netdiskName || info.baiduName, secondaryInfo: vipLabel(info.vipType) };
  },

  getQuota: async (): Promise<CloudQuota> => {
    const q = await window.electronAPI.baidupan.getQuota();
    return { used: q.used, total: q.total };
  },

  // 文件夹浏览
  getSyncFolder: () => window.electronAPI.baidupan.getSyncFolder(),

  browseFolders: async (parentPath?: string): Promise<CloudFolderItem[]> => {
    const folders = await window.electronAPI.baidupan.browseFolders(parentPath);
    return folders.map(f => ({ name: f.name, path: f.path, childCount: f.childCount }));
  },

  setSyncFolder: (path: string) => window.electronAPI.baidupan.setSyncFolder(path),

  createFolder: async (name: string, parentPath?: string): Promise<CloudFolderItem> => {
    const fullPath = parentPath ? `${parentPath}/${name}` : `/${name}`;
    await window.electronAPI.baidupan.createFolder(fullPath);
    return { name, path: fullPath, childCount: 0 };
  },

  // 同步设置
  getSyncSettings: async (): Promise<CloudSyncSetting[]> => {
    const s = await window.electronAPI.baidupan.getSyncSettings();
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
    await window.electronAPI.baidupan.updateSyncSettings({ [key]: value });
  },

  // 云端笔记
  getCloudNotes: async (): Promise<CloudNoteItem[]> => {
    const files = await window.electronAPI.baidupan.getCloudNotes();
    return files.map(f => ({
      id: f.fsId,
      name: f.filename,
      size: f.size,
      updatedAt: f.serverMtime * 1000,
      path: f.path,
    }));
  },

  downloadNote: (id: string | number) => window.electronAPI.baidupan.downloadNote(id as number),

  deleteNote: async (item: CloudNoteItem) => {
    if (item.path) await window.electronAPI.baidupan.deleteFile([item.path]);
  },
};

export default function BaiduPanSettingsPanel() {
  return <CloudStoragePanel adapter={baiduPanAdapter} />;
}

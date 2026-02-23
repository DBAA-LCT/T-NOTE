import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc/sync-channels';
import { BAIDU_IPC_CHANNELS } from './ipc/baidupan-channels';

contextBridge.exposeInMainWorld('electronAPI', {
  // Existing note operations
  saveNote: (noteData: string, defaultName?: string) => ipcRenderer.invoke('save-note', noteData, defaultName),
  saveNoteToPath: (filePath: string, noteData: string) => ipcRenderer.invoke('save-note-to-path', filePath, noteData),
  openNote: () => ipcRenderer.invoke('open-note'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  renameFile: (oldPath: string, newName: string) => ipcRenderer.invoke('rename-file', oldPath, newName),
  setWindowTitle: (title: string) => ipcRenderer.invoke('set-window-title', title),
  onMenuOpen: (callback: () => void) => ipcRenderer.on('menu-open', callback),
  onMenuSave: (callback: () => void) => ipcRenderer.on('menu-save', callback),
  onMenuSaveAs: (callback: () => void) => ipcRenderer.on('menu-save-as', callback),
  onOpenFileFromSystem: (callback: (filePath: string) => void) => {
    const listener = (_: any, filePath: string) => callback(filePath);
    ipcRenderer.on('open-file-from-system', listener);
    return () => ipcRenderer.removeListener('open-file-from-system', listener);
  },

  // 最近笔记
  recentNotes: {
    get: () => ipcRenderer.invoke('recent-notes:get'),
    add: (filePath: string, name: string) => ipcRenderer.invoke('recent-notes:add', filePath, name),
    remove: (filePath: string) => ipcRenderer.invoke('recent-notes:remove', filePath),
    clear: () => ipcRenderer.invoke('recent-notes:clear'),
  },

  // 新窗口打开笔记
  openNoteInNewWindow: (filePath: string) => ipcRenderer.invoke('open-note-in-new-window', filePath),
  
  // OneDrive Sync API
  onedrive: {
    // Authentication
    authenticate: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_AUTHENTICATE),
    disconnect: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_DISCONNECT),
    getUserInfo: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_USER_INFO),
    isAuthenticated: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_IS_AUTHENTICATED),
    
    // Sync Operations
    sync: (options?: any) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_EXECUTE, options),
    syncNote: (noteId: string) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_NOTE, noteId),
    uploadNote: (noteId: string) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_UPLOAD_NOTE, noteId),
    uploadNoteContent: (params: { noteContent: string; noteName: string; noteId: string; currentFilePath?: string; cloudSource?: { provider: string; cloudFileId: string | number; cloudPath?: string } }) => ipcRenderer.invoke('onedrive:sync:uploadNoteContent', params),
    downloadNote: (cloudNoteId: string, localPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_DOWNLOAD_NOTE, cloudNoteId, localPath),
    getSyncStatus: (noteId: string) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_STATUS, noteId),
    cancelSync: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_CANCEL),
    
    // Cloud Notes
    getCloudNotes: () => ipcRenderer.invoke(IPC_CHANNELS.CLOUD_GET_NOTES),
    browseFolders: (parentPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.CLOUD_BROWSE_FOLDERS, parentPath),
    createFolder: (folderName: string, parentPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.CLOUD_CREATE_FOLDER, { folderName, parentPath }),
    getStorageQuota: () => ipcRenderer.invoke(IPC_CHANNELS.CLOUD_GET_STORAGE_QUOTA),
    deleteNote: (driveItemId: string) => ipcRenderer.invoke('onedrive:cloud:deleteNote', driveItemId),
    
    // Page-Level Sync
    commitPage: (noteId: string, pageId: string) => ipcRenderer.invoke('onedrive:commit-page', noteId, pageId),
    getCloudPages: (noteId: string) => ipcRenderer.invoke('onedrive:get-cloud-pages', noteId),
    useCloudVersion: (noteId: string, pageId: string) => ipcRenderer.invoke('onedrive:use-cloud-version', noteId, pageId),
    enableNoteSync: (noteId: string, oneDrivePath: string) => ipcRenderer.invoke('onedrive:enable-note-sync', noteId, oneDrivePath),
    updateNoteSyncSettings: (noteId: string, settings: { autoCommit?: boolean }) => ipcRenderer.invoke('onedrive:update-note-sync-settings', noteId, settings),
    
    // Settings
    getSyncFolder: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_SYNC_FOLDER),
    setSyncFolder: (folderPath: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_SYNC_FOLDER, folderPath),
    getSyncSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_SYNC_SETTINGS),
    updateSyncSettings: (settings: any) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE_SYNC_SETTINGS, settings),
    
    // Conflict Resolution
    resolveConflict: (conflict: any, resolution: any) => ipcRenderer.invoke(IPC_CHANNELS.CONFLICT_RESOLVE, { conflict, resolution }),
    getConflictInfo: (noteId: string) => ipcRenderer.invoke(IPC_CHANNELS.CONFLICT_GET_INFO, noteId),
    
    // Network
    getNetworkStatus: () => ipcRenderer.invoke(IPC_CHANNELS.NETWORK_GET_STATUS),
    isWifi: () => ipcRenderer.invoke(IPC_CHANNELS.NETWORK_IS_WIFI),
    
    // Event Listeners
    onSyncProgress: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.EVENT_SYNC_PROGRESS, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_SYNC_PROGRESS, listener);
    },
    onSyncComplete: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.EVENT_SYNC_COMPLETE, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_SYNC_COMPLETE, listener);
    },
    onSyncError: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.EVENT_SYNC_ERROR, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_SYNC_ERROR, listener);
    },
    onNetworkStatusChange: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.EVENT_NETWORK_STATUS_CHANGE, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_NETWORK_STATUS_CHANGE, listener);
    },
    onConflictDetected: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.EVENT_CONFLICT_DETECTED, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_CONFLICT_DETECTED, listener);
    },
  },

  // 百度网盘 API
  baidupan: {
    // 认证
    authenticate: () => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.AUTH_AUTHENTICATE),
    disconnect: () => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.AUTH_DISCONNECT),
    getUserInfo: () => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.AUTH_GET_USER_INFO),
    isAuthenticated: () => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.AUTH_IS_AUTHENTICATED),

    // 网盘信息
    getQuota: () => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.QUOTA_GET),

    // 文件操作
    listFiles: (dir?: string) => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.FILE_LIST, dir),
    createFolder: (folderPath: string) => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.FILE_CREATE_FOLDER, folderPath),
    deleteFile: (filePaths: string[]) => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.FILE_DELETE, filePaths),

    // 文件夹浏览
    browseFolders: (parentPath?: string) => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.FOLDER_BROWSE, parentPath),
    getSyncFolder: () => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.FOLDER_GET_SYNC),
    setSyncFolder: (folderPath: string) => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.FOLDER_SET_SYNC, folderPath),

    // 设置
    getSyncSettings: () => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.SETTINGS_GET),
    updateSyncSettings: (settings: any) => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.SETTINGS_UPDATE, settings),

    // 同步
    uploadNote: (params: { noteContent: string; noteName: string; cloudPath?: string }) =>
      ipcRenderer.invoke(BAIDU_IPC_CHANNELS.SYNC_UPLOAD_NOTE, params),
    getCloudNotes: () => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.SYNC_GET_CLOUD_NOTES),
    downloadNote: (fsId: number) => ipcRenderer.invoke(BAIDU_IPC_CHANNELS.SYNC_DOWNLOAD_NOTE, fsId),

    // 事件监听
    onSyncProgress: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(BAIDU_IPC_CHANNELS.EVENT_SYNC_PROGRESS, listener);
      return () => ipcRenderer.removeListener(BAIDU_IPC_CHANNELS.EVENT_SYNC_PROGRESS, listener);
    },
    onSyncComplete: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(BAIDU_IPC_CHANNELS.EVENT_SYNC_COMPLETE, listener);
      return () => ipcRenderer.removeListener(BAIDU_IPC_CHANNELS.EVENT_SYNC_COMPLETE, listener);
    },
    onSyncError: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(BAIDU_IPC_CHANNELS.EVENT_SYNC_ERROR, listener);
      return () => ipcRenderer.removeListener(BAIDU_IPC_CHANNELS.EVENT_SYNC_ERROR, listener);
    },
  },
});


import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc/sync-channels';

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
    uploadNoteContent: (noteContent: string, noteName: string) => ipcRenderer.invoke('onedrive:sync:uploadNoteContent', { noteContent, noteName }),
    downloadNote: (cloudNoteId: string) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_DOWNLOAD_NOTE, cloudNoteId),
    getSyncStatus: (noteId: string) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_STATUS, noteId),
    cancelSync: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_CANCEL),
    
    // Cloud Notes
    getCloudNotes: () => ipcRenderer.invoke(IPC_CHANNELS.CLOUD_GET_NOTES),
    browseFolders: (parentPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.CLOUD_BROWSE_FOLDERS, parentPath),
    createFolder: (folderName: string, parentPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.CLOUD_CREATE_FOLDER, { folderName, parentPath }),
    getStorageQuota: () => ipcRenderer.invoke(IPC_CHANNELS.CLOUD_GET_STORAGE_QUOTA),
    
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
  }
});


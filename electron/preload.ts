import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
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
  }
});


import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveNote: (noteData: string, defaultName?: string) => ipcRenderer.invoke('save-note', noteData, defaultName),
  saveNoteToPath: (filePath: string, noteData: string) => ipcRenderer.invoke('save-note-to-path', filePath, noteData),
  openNote: () => ipcRenderer.invoke('open-note'),
  renameFile: (oldPath: string, newName: string) => ipcRenderer.invoke('rename-file', oldPath, newName),
  onMenuOpen: (callback: () => void) => ipcRenderer.on('menu-open', callback),
  onMenuSave: (callback: () => void) => ipcRenderer.on('menu-save', callback),
  onMenuSaveAs: (callback: () => void) => ipcRenderer.on('menu-save-as', callback)
});


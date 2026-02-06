import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveNote: (noteData: string) => ipcRenderer.invoke('save-note', noteData),
  saveNoteToPath: (filePath: string, noteData: string) => ipcRenderer.invoke('save-note-to-path', filePath, noteData),
  openNote: () => ipcRenderer.invoke('open-note'),
  onMenuOpen: (callback: () => void) => ipcRenderer.on('menu-open', callback),
  onMenuSave: (callback: () => void) => ipcRenderer.on('menu-save', callback),
  onMenuSaveAs: (callback: () => void) => ipcRenderer.on('menu-save-as', callback)
});

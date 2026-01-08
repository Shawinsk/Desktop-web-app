const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('fileSystem', {
  // Utils
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // Vaults
  getVaults: () => ipcRenderer.invoke('get-vaults'),
  createVault: (name) => ipcRenderer.invoke('create-vault', name),
  deleteVault: (path) => ipcRenderer.invoke('delete-vault', path),
  renameVault: (oldPath, newName) => ipcRenderer.invoke('rename-vault', { oldPath, newName }),

  // File Ops
  getFiles: (path) => ipcRenderer.invoke('get-files', path),
  createFolder: (currentPath, folderName) => ipcRenderer.invoke('create-folder', { currentPath, folderName }),
  createFile: (currentPath, fileName) => ipcRenderer.invoke('create-file', { currentPath, fileName }),
  deletePath: (path) => ipcRenderer.invoke('delete-path', path),
  renamePath: (oldPath, newName) => ipcRenderer.invoke('rename-path', { oldPath, newName }),
  openFile: (path) => ipcRenderer.invoke('open-file', path),
  
  // Magic
  organizeFiles: (path) => ipcRenderer.invoke('organize-files', path),
  processDroppedFiles: (filePaths, targetVaultPath) => ipcRenderer.invoke('process-dropped-files', { filePaths, targetVaultPath })
})

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CONFIG_PATH = path.join(app.getPath('userData'), 'vault-config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { vaults: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (e) {
    return { vaults: [] };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0d1117',
      symbolColor: '#e6edf3',
      height: 32
    }
  });

  win.loadFile('index.html');
}

// --- Helpers ---
async function copyRecursive(src, dest) {
  const stats = await fs.promises.stat(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) await fs.promises.mkdir(dest);
    const files = await fs.promises.readdir(src);
    for (const file of files) {
      await copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    await fs.promises.copyFile(src, dest);
  }
}

// --- IPC Handlers ---

// Vaults
ipcMain.handle('get-vaults', () => {
  const config = loadConfig();
  const existingVaults = config.vaults.filter(v => fs.existsSync(v.path));
  if (existingVaults.length !== config.vaults.length) {
    saveConfig({ vaults: existingVaults });
  }
  return existingVaults;
});

ipcMain.handle('create-vault', async (event, vaultName) => {
  const targetPath = path.join(os.homedir(), vaultName);
  if (fs.existsSync(targetPath)) return { success: false, error: 'Directory already exists!' };
  try {
    await fs.promises.mkdir(targetPath);
    const config = loadConfig();
    config.vaults.push({ name: vaultName, path: targetPath });
    saveConfig(config);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// NEW: Delete Vault
ipcMain.handle('delete-vault', async (event, vaultPath) => {
  try {
    // 1. Remove from Config
    const config = loadConfig();
    const newVaults = config.vaults.filter(v => v.path !== vaultPath);
    saveConfig({ vaults: newVaults });

    // 2. Delete Folder (Optional? User might want to keep data? 
    // Usually "Delete Vault" implies deleting data in a manager app.
    // Let's delete it to be "Supiri clean".
    if (fs.existsSync(vaultPath)) {
        await fs.promises.rm(vaultPath, { recursive: true, force: true });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// NEW: Rename Vault
ipcMain.handle('rename-vault', async (event, { oldPath, newName }) => {
    try {
        if (!oldPath || !newName) throw new Error('Invalid arguments');

        const parentDir = path.dirname(oldPath);
        const newPath = path.join(parentDir, newName);

        if (oldPath === newPath) return { success: true };
        if (fs.existsSync(newPath)) return { success: false, error: 'Vault name already exists' };

        // 1. Rename on Disk
        await fs.promises.rename(oldPath, newPath);

        // 2. Update Config
        const config = loadConfig();
        const vaultIndex = config.vaults.findIndex(v => v.path === oldPath);
        if (vaultIndex !== -1) {
            config.vaults[vaultIndex].name = newName;
            config.vaults[vaultIndex].path = newPath;
            saveConfig(config);
        }

        return { success: true, newPath };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// File System
ipcMain.handle('get-files', async (event, dirPath) => {
  try {
    const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return dirents.map(dirent => ({
      name: dirent.name,
      isDirectory: dirent.isDirectory(),
      path: path.join(dirPath, dirent.name)
    }));
  } catch (err) {
    return [];
  }
});

ipcMain.handle('create-folder', async (event, { currentPath, folderName }) => {
    try {
        if (!currentPath || typeof currentPath !== 'string') throw new Error('Invalid path');
        if (!folderName || typeof folderName !== 'string') throw new Error('Invalid folder name');
        
        const target = path.join(currentPath, folderName);
        if(fs.existsSync(target)) return { success: false, error: 'Already exists' };
        
        await fs.promises.mkdir(target);
        return { success: true };
    } catch(e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('create-file', async (event, { currentPath, fileName }) => {
    try {
        if (!currentPath || typeof currentPath !== 'string') throw new Error('Invalid path');
        if (!fileName || typeof fileName !== 'string') throw new Error('Invalid filename');

        const target = path.join(currentPath, fileName);
        if(fs.existsSync(target)) return { success: false, error: 'Already exists' };
        
        await fs.promises.writeFile(target, '');
        return { success: true };
    } catch(e) {
        return { success: false, error: e.message };
    }
});

// NEW: Delete File/Folder
ipcMain.handle('delete-path', async (event, targetPath) => {
    try {
        if(fs.existsSync(targetPath)) {
            await fs.promises.rm(targetPath, { recursive: true, force: true });
        }
        return { success: true };
    } catch(e) {
        return { success: false, error: e.message };
    }
});

// NEW: Rename File/Folder
ipcMain.handle('rename-path', async (event, { oldPath, newName }) => {
    try {
        if (!oldPath || !newName) throw new Error('Invalid arguments');
        
        const dir = path.dirname(oldPath);
        const newPath = path.join(dir, newName);
        
        if (oldPath === newPath) return { success: true }; // No change
        if (fs.existsSync(newPath)) return { success: false, error: 'Name already exists' };
        
        await fs.promises.rename(oldPath, newPath);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('open-file', async (event, filePath) => {
  shell.openPath(filePath);
});

// Organization
ipcMain.handle('organize-files', async (event, dirPath) => {
  try {
    const files = await fs.promises.readdir(dirPath);
    let deletedCount = 0;

    for (const file of files) {
      // Optional: Prevent deleting hidden system files if desired? 
      // User said "hama deyak" (everything), but usually keeping .git or similar is good.
      // For now, consistent with "Delete Everything", we delete everything visible (non-hidden usually implied unless ., but node readdir returns all).
      // We'll skip '.' and '..' which readdir doesn't return anyway.
      
      const fullPath = path.join(dirPath, file);
      try {
        await fs.promises.rm(fullPath, { recursive: true, force: true });
        deletedCount++;
      } catch (err) {
        console.error(`Failed to delete ${fullPath}:`, err);
      }
    }

    return { success: true, deleted: deletedCount };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Drag & Drop
ipcMain.handle('process-dropped-files', async (event, { filePaths, targetVaultPath }) => {
    let count = 0;
    try {
        if (!targetVaultPath || typeof targetVaultPath !== 'string') {
             throw new Error("Invalid target vault path");
        }
        if (!filePaths || !Array.isArray(filePaths)) {
             throw new Error("Invalid files list");
        }
        
        if (!fs.existsSync(targetVaultPath)) return { success: false, error: "Vault not found" };

        for (const originalPath of filePaths) {
            if (!originalPath || typeof originalPath !== 'string') continue;

            const fileName = path.basename(originalPath);
            const destPath = path.join(targetVaultPath, fileName);
            await copyRecursive(originalPath, destPath);
            count++;
        }
        return { success: true, count };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

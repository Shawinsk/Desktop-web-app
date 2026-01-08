const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const configPath = path.join(app.getPath('userData'), 'vault-config.json');

// Ensure config exists
if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ vaults: [] }, null, 2));
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "SK FILE Manager",
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0b0c15',
            symbolColor: '#ffffff',
            height: 32
        },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile('index.html');
    // win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---

// Vault Management
ipcMain.handle('get-vaults', async () => {
    try {
        if (!fs.existsSync(configPath)) return [];
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return data.vaults || [];
    } catch (error) {
        console.error("Error reading vaults:", error);
        return [];
    }
});

ipcMain.handle('add-vault', async (event, { name, path: vaultPath }) => {
    try {
        const data = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : { vaults: [] };
        // Check duplicates
        if (data.vaults.some(v => v.path === vaultPath)) return { success: false, error: "Vault already exists" };
        
        data.vaults.push({ name, path: vaultPath, id: Date.now().toString() });
        fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('remove-vault', async (event, vaultPath) => {
    try {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        data.vaults = data.vaults.filter(v => v.path !== vaultPath);
        fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('rename-vault', async (event, { oldPath, newName }) => {
    try {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const vaultIndex = data.vaults.findIndex(v => v.path === oldPath);
        if (vaultIndex === -1) return { success: false, error: "Vault not found" };

        const vault = data.vaults[vaultIndex];
        const parentDir = path.dirname(oldPath);
        const newPath = path.join(parentDir, newName);

        // Rename dir
        if (fs.existsSync(oldPath)) {
            await fs.promises.rename(oldPath, newPath);
        }

        // Update config
        data.vaults[vaultIndex].name = newName;
        data.vaults[vaultIndex].path = newPath;
        fs.writeFileSync(configPath, JSON.stringify(data, null, 2));

        return { success: true, newPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// File Operations
ipcMain.handle('create-folder', async (event, { currentPath, folderName }) => {
    try {
        const target = path.join(currentPath, folderName);
        if (fs.existsSync(target)) return { success: false, error: "Folder already exists" };
        await fs.promises.mkdir(target);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('create-file', async (event, { currentPath, fileName }) => {
    try {
        const target = path.join(currentPath, fileName);
        if (fs.existsSync(target)) return { success: false, error: "File already exists" };
        await fs.promises.writeFile(target, '');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-path', async (event, targetPath) => {
    try {
        await fs.promises.rm(targetPath, { recursive: true, force: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('rename-path', async (event, { oldPath, newName }) => {
    try {
        const dir = path.dirname(oldPath);
        const newPath = path.join(dir, newName);
        await fs.promises.rename(oldPath, newPath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('process-dropped-files', async (event, { targetPath, files }) => {
    try {
        let copied = 0;
        for (const file of files) {
            const dest = path.join(targetPath, file.name);
            await fs.promises.copyFile(file.path, dest);
            copied++;
        }
        return { success: true, count: copied };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Sort/Organize Files
ipcMain.handle('organize-files', async (event, dirPath) => {
  const categories = {
    'Images': ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'],
    'Documents': ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.ppt', '.pptx'],
    'Videos': ['.mp4', '.mkv', '.mov', '.avi', '.webm'],
    'Audio': ['.mp3', '.wav', '.flac', '.ogg'],
    'Archives': ['.zip', '.rar', '.7z', '.tar', '.gz'],
    'Installers': ['.exe', '.msi', '.dmg', '.iso', '.apk'],
    'Code': ['.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.py', '.java', '.c', '.cpp', '.php', '.sql']
  };

  try {
    const files = await fs.promises.readdir(dirPath);
    let movedCount = 0;

    for (const file of files) {
      if (file.startsWith('.')) continue; 
      const fullPath = path.join(dirPath, file);
      
      try {
          const stat = await fs.promises.stat(fullPath);
          if (stat.isFile()) {
            const ext = path.extname(file).toLowerCase();
            let targetCategory = 'Others';

            for (const [category, exts] of Object.entries(categories)) {
              if (exts.includes(ext)) {
                targetCategory = category;
                break;
              }
            }

            const targetDir = path.join(dirPath, targetCategory);
            // Create folder if it doesn't exist
            if (!fs.existsSync(targetDir)) {
              await fs.promises.mkdir(targetDir);
            }
            
            const targetPath = path.join(targetDir, file);
            if (fullPath !== targetPath) {
                 // Handle name collision
                 if (fs.existsSync(targetPath)) {
                     const nameParts = path.parse(file);
                     const newName = `${nameParts.name}_${Date.now()}${nameParts.ext}`;
                     await fs.promises.rename(fullPath, path.join(targetDir, newName));
                 } else {
                     await fs.promises.rename(fullPath, targetPath);
                 }
                 movedCount++;
            }
          }
      } catch (err) {
          console.error(`Error processing ${file}:`, err);
      }
    }

    return { success: true, moved: movedCount };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

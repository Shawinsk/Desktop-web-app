const { 
    getVaults, createVault, deleteVault, renameVault,
    getFiles, createFolder, createFile, deletePath, renamePath, openFile,
    organizeFiles, processDroppedFiles, getPathForFile
} = window.fileSystem;

// Navigation State
let historyStack = [];
let historyIndex = -1;
let currentPath = '';

// Icons
const getIcon = (fileName, isDir) => {
    if (isDir) return '📁';
    const ext = fileName.split('.').pop().toLowerCase();
    const map = {
        // Images
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️', 'svg': '🖼️',
        // Videos
        'mp4': '🎥', 'mkv': '🎥', 'mov': '🎥', 'avi': '🎥', 'webm': '🎥',
        // Audio
        'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'ogg': '🎵',
        // Code
        'js': '🟨', 'jsx': '🟨', 'ts': '🔷', 'tsx': '🔷',
        'html': '🌐', 'htm': '🌐',
        'css': '🎨', 'scss': '🎨',
        'json': '📋', 'xml': '📋',
        'py': '🐍',
        'java': '☕',
        'c': '🇨', 'cpp': '🇨',
        'php': '🐘',
        'sql': '🗄️',
        // Docs
        'pdf': '📕', 
        'doc': '📝', 'docx': '📝', 
        'txt': '📄', 'md': '📝',
        'xls': '📊', 'xlsx': '📊', 
        'ppt': '📉', 'pptx': '📉',
        // Archives
        'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
        // Misc
        'exe': '🚀', 'msi': '🚀', 'apk': '🤖'
    };
    return map[ext] || '📄';
};

// ... (existing showPrompt)

// --- App State ---
const initApp = async () => {
    await refreshSidebar();
    document.getElementById('file-grid').innerHTML = `
        <div style="text-align:center; padding-top: 50px; color: var(--text-secondary);">
            <h2>Welcome to SK FILE Manager</h2>
            <p>Select a Vault or Create a new one!</p>
        </div>
    `;

    // Navigation Listeners
    document.getElementById('btn-back').onclick = goBack;
    document.getElementById('btn-forward').onclick = goForward;
    
    // Address Bar
    const addressBar = document.getElementById('address-bar');
    addressBar.onkeydown = (e) => {
        if (e.key === 'Enter') {
            const path = addressBar.value.trim();
            if (path) loadDirectory(path);
        }
    };
};

const goBack = () => {
    if (historyIndex > 0) {
        historyIndex--;
        loadDirectory(historyStack[historyIndex], false);
    }
};

const goForward = () => {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        loadDirectory(historyStack[historyIndex], false);
    }
};

const updateNavigationState = () => {
    document.getElementById('btn-back').disabled = historyIndex <= 0;
    document.getElementById('btn-forward').disabled = historyIndex >= historyStack.length - 1;
    document.getElementById('address-bar').value = currentPath;
};

// --- Custom Prompt / Confirm ---
function showPrompt(message, isConfirm = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-prompt');
        const msgEl = document.getElementById('prompt-message');
        const input = document.getElementById('prompt-input');
        const btnOk = document.getElementById('prompt-ok');
        const btnCancel = document.getElementById('prompt-cancel');

        msgEl.textContent = message;
        input.value = '';
        
        if (isConfirm) {
            input.style.display = 'none';
            btnOk.textContent = 'Yes, Delete';
            btnOk.style.background = 'var(--danger)';
        } else {
            input.style.display = 'block';
            btnOk.textContent = 'OK';
            btnOk.style.background = 'var(--success)';
            input.focus();
        }

        modal.style.display = 'flex';
        // Focus button if confirm
        if(isConfirm) btnOk.focus(); else input.focus();

        const cleanup = () => {
            modal.style.display = 'none';
            btnOk.onclick = null;
            btnCancel.onclick = null;
            input.onkeydown = null;
        };

        const handleOk = () => {
             const val = isConfirm ? true : input.value.trim();
             cleanup();
             resolve(val || (isConfirm ? true : null));
        };

        const handleCancel = () => {
            cleanup();
            resolve(null);
        };

        btnOk.onclick = handleOk;
        btnCancel.onclick = handleCancel;
        
        if (!isConfirm) {
            input.onkeydown = (e) => {
                if(e.key === 'Enter') handleOk();
                if(e.key === 'Escape') handleCancel();
            };
        }
    });
}

// --- App State ---
// --- App State (Second one removed) ---

// --- Sidebar ---
const refreshSidebar = async () => {
    // ... (Keep existing implementation here, do not replace this unless intended, but the prompt implies this block might be needed to reach selectVault. 
    // Actually, I can target just the lower block since initApp is above it.)
    
    // WAIT: I cannot easily remove the 'initApp' AND update 'loadDirectory' in one contiguous block if they are far apart.
    // The previous view_file showed initApp at line 151.
    // I will replace from line 151 down to end of loadDirectory.
    // This includes refreshSidebar, handleCreateVault, selectVault. 
    // This is safer to ensure consistency.

    const vaults = await getVaults();
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = ''; 

    // Create
    const createBtn = document.createElement('div');
    createBtn.className = 'nav-item create-vault-btn';
    createBtn.innerHTML = `<span>➕</span> Create New Vault`;
    createBtn.onclick = handleCreateVault;
    nav.appendChild(createBtn);

    const sep = document.createElement('div');
    sep.style.borderBottom = '1px solid var(--border)';
    sep.style.margin = '10px 0';
    nav.appendChild(sep);

    // List
    vaults.forEach(vault => {
        const el = document.createElement('div');
        el.className = 'nav-item vault-item';
        if (currentPath === vault.path) el.classList.add('active');

        // Vault Name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = vault.name;
        nameSpan.style.flex = '1';
        el.appendChild(nameSpan);

        // Rename Icon
        const renameBtn = document.createElement('span');
        renameBtn.innerHTML = '✏️';
        renameBtn.className = 'rename-icon';
        renameBtn.title = 'Rename Vault';
        renameBtn.onclick = async (e) => {
            e.stopPropagation();
            const newName = await showPrompt(`Rename Vault '${vault.name}' to:`);
            if (newName && newName !== true) {
                 const res = await renameVault(vault.path, newName);
                 if (res.success) {
                     showToast("Vault Renamed! ✨");
                     if (currentPath === vault.path) {
                         currentPath = res.newPath;
                     }
                     refreshSidebar(); 
                     if (currentPath === res.newPath) {
                         loadDirectory(currentPath);
                     }
                 } else {
                     showToast(`Error: ${res.error}`);
                 }
            }
        };
        el.appendChild(renameBtn);

        // Delete Icon (Stop Propagation to prevent selection)
        const delBtn = document.createElement('span');
        delBtn.innerHTML = '🗑️';
        delBtn.className = 'delete-icon';
        delBtn.title = 'Delete Vault';
        delBtn.onclick = async (e) => {
            e.stopPropagation();
            const confirmed = await showPrompt(`Delete vault '${vault.name}' and all files?`, true);
            if (confirmed) {
                const res = await deleteVault(vault.path);
                if (res.success) {
                    showToast('Vault Deleted 🗑️');
                    currentPath = ''; // Reset
                    refreshSidebar();
                    if(currentPath === vault.path) {
                        document.getElementById('file-grid').innerHTML = '';
                    } else {
                        document.getElementById('file-grid').innerHTML = `
                            <div style="text-align:center; padding-top: 50px; color: var(--text-secondary);">
                                <h2>Vault Deleted</h2>
                            </div>
                        `;
                    }
                } else {
                    showToast(`Error: ${res.error}`);
                }
            }
        };
        el.appendChild(delBtn);

        el.onclick = () => {
            selectVault(vault.path, el);
        };
        nav.appendChild(el);
    });
};

const handleCreateVault = async () => {
    const name = await showPrompt("Enter Vault Name:");
    if (!name || name === true) return;

    const res = await createVault(name);
    if (res.success) {
        showToast(`Vault Created! 🎉`);
        refreshSidebar();
    } else {
        showToast(`Error: ${res.error}`);
    }
};

const selectVault = (path, el) => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(el) el.classList.add('active');
    loadDirectory(path);
};

// --- File View ---
const loadDirectory = async (path, addToHistory = true) => {
    currentPath = path;

    // History Logic
    if (addToHistory) {
         if (historyIndex < historyStack.length - 1) {
             historyStack = historyStack.slice(0, historyIndex + 1);
         }
         if (historyStack[historyIndex] !== path) {
             historyStack.push(path);
             historyIndex++;
         }
    }
    
    updateNavigationState();

    // Although invalid paths might occur, we let getFiles handle empty returns.
    // Address bar update is handled by updateNavigationState
    
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '<div style="color:var(--text-secondary)">Loading...</div>';

    const files = await getFiles(path);
    grid.innerHTML = '';

    // New Folder
    const newFolderCard = document.createElement('div');
    newFolderCard.className = 'file-card new-folder-card';
    newFolderCard.innerHTML = `<div class="file-icon">📁</div><div class="file-name">New Folder</div>`;
    newFolderCard.onclick = async () => {
        const name = await showPrompt("Folder Name:");
        if (name && name !== true) {
            const res = await createFolder(currentPath, name);
            if(res.success) loadDirectory(currentPath);
            else showToast(res.error);
        }
    };
    grid.appendChild(newFolderCard);

     // New File
    const newFileCard = document.createElement('div');
    newFileCard.className = 'file-card new-folder-card';
    newFileCard.innerHTML = `<div class="file-icon">📄</div><div class="file-name">New File</div>`;
    newFileCard.onclick = async () => {
        const name = await showPrompt("File Name:");
        if (name && name !== true) {
            const res = await createFile(currentPath, name);
            if(res.success) loadDirectory(currentPath);
            else showToast(res.error);
        }
    };
    grid.appendChild(newFileCard);

    if (files.length === 0) return;

    files.sort((a, b) => (a.isDirectory === b.isDirectory) ? 0 : a.isDirectory ? -1 : 1);

    files.forEach(file => {
        const card = document.createElement('div');
        card.className = 'file-card';
        card.title = file.name;
        
        const icon = getIcon(file.name, file.isDirectory);
        
        // --- Delete Button (Top Right) ---
        const delOverlay = document.createElement('div');
        delOverlay.className = 'card-delete-btn';
        delOverlay.innerHTML = '❌';
        delOverlay.onclick = async (e) => {
            e.stopPropagation();
            const confirmed = await showPrompt(`Delete '${file.name}'?`, true);
            if (confirmed) {
                const res = await deletePath(file.path);
                if(res.success) {
                    showToast('Deleted! 🗑️');
                    loadDirectory(currentPath);
                } else {
                    showToast(res.error);
                }
            }
        };

        // --- Rename Button (Top Left) ---
        const renameBtn = document.createElement('div');
        renameBtn.className = 'card-rename-btn';
        renameBtn.innerHTML = '✏️';
        renameBtn.onclick = async (e) => {
            e.stopPropagation();
            const newName = await showPrompt(`Rename '${file.name}' to:`);
            if (newName && newName !== true) {
                const res = await renamePath(file.path, newName);
                if(res.success) {
                    showToast('Renamed! ✨');
                    loadDirectory(currentPath);
                } else {
                    showToast(res.error);
                }
            }
        };

        card.innerHTML = `
            <div class="file-icon">${icon}</div>
            <div class="file-name">${file.name}</div>
        `;
        card.appendChild(delOverlay);
        card.appendChild(renameBtn);

        card.ondblclick = () => {
            if (file.isDirectory) loadDirectory(file.path);
            else openFile(file.path);
        };

        grid.appendChild(card);
    });
};

document.getElementById('organize-btn').onclick = async () => {
    if (!currentPath) return showToast("Select a Vault first!");
    
    // SAFETY CONFIRMATION
    const confirmed = await showPrompt("WARNING: This will delete ALL files/folders in this vault! Are you sure?", true);
    if (!confirmed) return;

    const btn = document.getElementById('organize-btn');
    const originalText = btn.innerText;
    btn.innerText = 'Deleting...';
    
    const result = await organizeFiles(currentPath);
    if (result.success) {
        showToast(result.deleted > 0 ? `Deleted ${result.deleted} items!` : 'Folder is empty!');
        loadDirectory(currentPath);
    } else {
        showToast(`Error: ${result.error}`);
    }
    btn.innerText = originalText;
};

const setupDragAndDrop = () => {
    const dropZone = document.getElementById('drop-overlay');
    const dropText = dropZone.querySelector('p');
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        dropText.textContent = "Drop to COPY here!";
        dropZone.style.display = 'flex';
    });

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) dropZone.style.display = 'none';
    });

    window.addEventListener('dragover', (e) => e.preventDefault());

    window.addEventListener('drop', async (e) => {
        e.preventDefault();
        dragCounter = 0;
        dropZone.style.display = 'none';
        
        const files = Array.from(e.dataTransfer.files).map(f => {
             // Try standard path (if security allows) or use electron utility
             return window.fileSystem.getPathForFile(f) || f.path; 
        }).filter(p => !!p);

        if (files.length > 0) {
            if (!currentPath) { showToast("Open a Vault first!"); return; }
            showToast('Copying... ⏳');
            const res = await processDroppedFiles(files, currentPath);
            if (res.success) {
                showToast(`Copied ${res.count} items!`);
                loadDirectory(currentPath);
            } else {
                showToast(`Error: ${res.error}`);
            }
        }
    });
};

const showToast = (msg) => {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

setupDragAndDrop();
initApp();

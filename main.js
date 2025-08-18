// main.js
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fssync = require('fs');
const { pathToFileURL } = require('url');

let mainWindow;

/** Video extensions to include */
const VIDEO_REGEX = /\.(mp4|mov|m4v|mkv|avi|webm|mts|m2ts)$/i;

function isVideoFile(name) {
  return VIDEO_REGEX.test(name);
}

function toFileUrl(p) {
  return pathToFileURL(p).href;
}

async function listVideoFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((d) => d.isFile() && isVideoFile(d.name))
    .map((d) => {
      const full = path.join(dir, d.name);
      const parsed = path.parse(full);
      return {
        name: d.name,
        base: parsed.name,
        ext: parsed.ext,
        dir: parsed.dir,
        path: full,
        url: toFileUrl(full)
      };
    });

  files.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  return files;
}

async function pickFolderAndList() {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Select a folder with videos',
    properties: ['openDirectory']
  });

  if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
    return { canceled: true };
  }

  const dir = res.filePaths[0];
  const files = await listVideoFiles(dir);
  return { canceled: false, dir, files };
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Generates a unique path if target exists: adds -1, -2, ... before extension */
async function uniquePath(dir, base, ext) {
  let candidate = path.join(dir, base + ext);
  let i = 1;
  while (await pathExists(candidate)) {
    candidate = path.join(dir, `${base}-${i}${ext}`);
    i++;
  }
  return candidate;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    title: 'Footage Renamer'
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

/** IPC: open folder + list */
ipcMain.handle('pick-folder', async () => {
  try {
    return await pickFolderAndList();
  } catch (err) {
    return { canceled: true, error: String(err) };
  }
});

/** IPC: rename file (keeps extension) */
ipcMain.handle('rename-file', async (event, payload) => {
  try {
    const { fromPath, newBase } = payload;
    const parsed = path.parse(fromPath);
    const dir = parsed.dir;
    const ext = parsed.ext;

    // Build a unique, safe new path
    const finalPath = await uniquePath(dir, newBase, ext);

    // Rename
    await fs.rename(fromPath, finalPath);

    // Return updated file info
    const fn = path.parse(finalPath);
    const info = {
      name: fn.base,
      base: fn.name,
      ext: fn.ext,
      dir: fn.dir,
      path: finalPath,
      url: toFileUrl(finalPath)
    };

    return { ok: true, file: info };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

/** IPC: delete file */
ipcMain.handle('delete-file', async (_event, fullPath) => {
  try {
    if (typeof fullPath !== 'string') return { ok: false, error: 'No path' };
    await fs.unlink(fullPath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

/** IPC: confirm delete (native dialog) */
ipcMain.handle('confirm-delete', async (_event, fileName) => {
  try {
    const res = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Delete'],
      cancelId: 0,
      defaultId: 1,
      noLink: true,
      title: 'Confirm Delete',
      message: 'Delete this file?',
      detail: fileName
    });
    return { confirmed: res.response === 1 };
  } catch (err) {
    return { confirmed: false, error: String(err) };
  }
});

ipcMain.on('show-in-folder', (_event, fullPath) => {
  try {
    if (typeof fullPath === 'string') {
      shell.showItemInFolder(fullPath);
    }
  } catch {}
});

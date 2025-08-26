// Optional Electron preload to provide native helpers when running under Electron.
// In web mode this file is ignored.

try {
	const { contextBridge, ipcRenderer, shell } = require('electron');
	// Provide a first-class API in Electron; when present, the web polyfill won't initialize.
	contextBridge.exposeInMainWorld('api', {
		pickFolder: () => ipcRenderer.invoke('api:pickFolder'),
		renameFile: (fromPath, newBase) => ipcRenderer.invoke('api:renameFile', { fromPath, newBase }),
		deleteFile: (fullPath) => ipcRenderer.invoke('api:deleteFile', { fullPath }),
		confirmDelete: async (fileName) => ({ confirmed: window.confirm(`Delete this file?\n${fileName}`) }),
		showInFolder: (fullPath) => { try { shell.showItemInFolder(fullPath); return { ok: true }; } catch (e) { return { ok: false, error: String(e) }; } },
		openExternal: async (fullPath) => { try { const err = await shell.openPath(fullPath); return err ? { ok: false, error: err } : { ok: true }; } catch (e) { return { ok: false, error: String(e) }; } },
		pickRoster: () => ipcRenderer.invoke('api:pickRoster'),
		getRoster: () => ipcRenderer.invoke('api:getRoster')
	});
} catch {
	// Not running in Electron; leave no traces.
}

// renderer/renderer.js

const openFolderBtn = document.getElementById('openFolderBtn');
const loadRosterBtn = document.getElementById('loadRosterBtn');
const showInFolderBtn = document.getElementById('showInFolderBtn');
const folderPathEl = document.getElementById('folderPath');
const fileCounterEl = document.getElementById('fileCounter');

const videoEl = document.getElementById('video');
const playPauseBtn = document.getElementById('playPauseBtn');
const muteBtn = document.getElementById('muteBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const deleteBtn = document.getElementById('deleteBtn');

const currentNameEl = document.getElementById('currentName');
const seekEl = document.getElementById('seek');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');

const renameOverlay = document.getElementById('renameOverlay');
const renameInput = document.getElementById('renameInput');
const tagOverlay = document.getElementById('tagOverlay');
const tagInput = document.getElementById('tagInput');
const tagSuggestions = document.getElementById('tagSuggestions');
const currentTagsEl = document.getElementById('currentTags');
const detailsOverlay = document.getElementById('detailsOverlay');
const detailsInput = document.getElementById('detailsInput');

const toastEl = document.getElementById('toast');

let DIR = null;
let FILES = [];
let index = 0;

let isRenaming = false;
let seeking = false;
let isTagging = false;
let isEnteringDetails = false;
let ROSTER = null; // {team, season, players: []}
let currentTags = []; // array of player objects currently tagged for the active file (not persisted globally)
let fileTagCache = new Map(); // path -> array of player objects to allow revisiting

/* ===== Browser (non-Electron) API polyfill ===== */
// If preload (Electron) didn't inject window.api, we create a browser version
// using the File System Access API (Chromium). This allows running via a web server
// (e.g., Vite) with nearly identical functionality.
(function setupWebApiPolyfill() {
  if (window.api) return; // Electron path

  const isFSAvailable = typeof window.showDirectoryPicker === 'function';
  const WEB = {
    dirHandle: null,
    // Map key -> { handle, dirHandle, url }
    fileByKey: new Map(),
  };

  function extname(name) {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i) : '';
  }

  function basenameNoExt(name) {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(0, i) : name;
  }

  function isVideoFileName(name) {
    return /\.(mp4|mov|m4v|mkv|avi|webm|mts|m2ts)$/i.test(name);
  }

  function fileToUrl(file) {
    try { return URL.createObjectURL(file); } catch { return ''; }
  }

  async function listTopLevelVideos(dirHandle) {
    const out = [];
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'file' && isVideoFileName(name)) {
        const file = await handle.getFile();
        out.push({ name, handle, file });
      }
    }
    // natural sort
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    return out;
  }

  async function uniqueName(dirHandle, base, ext) {
    let candidate = base + ext;
    let i = 1;
    while (true) {
      try {
        // If it exists, getFileHandle will succeed
        await dirHandle.getFileHandle(candidate, { create: false });
        candidate = `${base}-${i}${ext}`;
        i++;
      } catch {
        // Not found => unique
        return candidate;
      }
    }
  }

  function validateRosterWeb(data) {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.players)) return false;
    for (const p of data.players) {
      if (!p || typeof p !== 'object') return false;
      if (typeof p.number !== 'string' || typeof p.name !== 'string') return false;
    }
    return true;
  }

  function getKeyForName(name) { return name; }

  // Build the FILES array result expected by the app from a directory handle
  async function buildFiles(dirHandle) {
    const raw = await listTopLevelVideos(dirHandle);
    WEB.fileByKey.clear();
    return Promise.all(raw.map(async ({ name, handle, file }) => {
      const key = getKeyForName(name);
      const url = fileToUrl(file);
      const f = {
        name,
        base: basenameNoExt(name),
        ext: extname(name),
        dir: '',
        path: key, // synthetic key in web mode
        url,
      };
      WEB.fileByKey.set(key, { handle, dirHandle, url });
      return f;
    }));
  }

  async function webRename(fromKey, newBase) {
    if (!WEB.dirHandle) throw new Error('No directory');
    const entry = WEB.fileByKey.get(fromKey);
    if (!entry) throw new Error('File not found');
    const { handle, dirHandle } = entry;
    const oldName = handle.name;
    const ext = extname(oldName);
    const targetName = await uniqueName(dirHandle, newBase, ext);

    // Prefer native move/rename if supported
    if (typeof handle.move === 'function') {
      await handle.move(dirHandle, targetName);
      const newHandle = await dirHandle.getFileHandle(targetName, { create: false });
      const newFile = await newHandle.getFile();
      // cleanup old URL
      try { URL.revokeObjectURL(entry.url); } catch {}
      const url = fileToUrl(newFile);
      const newKey = getKeyForName(targetName);
      WEB.fileByKey.delete(fromKey);
      WEB.fileByKey.set(newKey, { handle: newHandle, dirHandle, url });
      return {
        name: targetName,
        base: basenameNoExt(targetName),
        ext: extname(targetName),
        dir: '',
        path: newKey,
        url,
      };
    }

    // Fallback: copy to new file then remove old
    const newHandle = await dirHandle.getFileHandle(targetName, { create: true });
    const writable = await newHandle.createWritable({ keepExistingData: false });
    const readFile = await handle.getFile();
    await writable.write(await readFile.arrayBuffer());
    await writable.close();
    // remove old
    await dirHandle.removeEntry(oldName, { recursive: false });
    // update map
    try { URL.revokeObjectURL(entry.url); } catch {}
    const newFile = await newHandle.getFile();
    const url = fileToUrl(newFile);
    const newKey = getKeyForName(targetName);
    WEB.fileByKey.delete(fromKey);
    WEB.fileByKey.set(newKey, { handle: newHandle, dirHandle, url });
    return {
      name: targetName,
      base: basenameNoExt(targetName),
      ext: extname(targetName),
      dir: '',
      path: newKey,
      url,
    };
  }

  async function webDelete(key) {
    const entry = WEB.fileByKey.get(key);
    if (!entry) throw new Error('File not found');
    const { handle, dirHandle, url } = entry;
    await dirHandle.removeEntry(handle.name, { recursive: false });
    try { URL.revokeObjectURL(url); } catch {}
    WEB.fileByKey.delete(key);
  }

  // Expose browser api with same shape
  window.api = {
    pickFolder: async () => {
      if (!isFSAvailable) {
        return { canceled: true, error: 'File System Access API not supported' };
      }
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        WEB.dirHandle = dirHandle;
        const files = await buildFiles(dirHandle);
        return { canceled: false, dir: dirHandle.name || 'Selected Folder', files };
      } catch (e) {
        return { canceled: true };
      }
    },
    renameFile: async (fromPath, newBase) => {
      try {
        const file = await webRename(fromPath, newBase);
        return { ok: true, file };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    deleteFile: async (fullPath) => {
      try { await webDelete(fullPath); return { ok: true }; } catch (e) { return { ok: false, error: String(e) }; }
    },
    confirmDelete: async (fileName) => {
      try { return { confirmed: window.confirm(`Delete this file?\n${fileName}`) }; } catch (e) { return { confirmed: false, error: String(e) }; }
    },
    showInFolder: (_fullPath) => {
      // Not available on the web; no-op
    },
    pickRoster: async () => {
      try {
        if (typeof window.showOpenFilePicker !== 'function') {
          return { canceled: true, error: 'File Picker not supported' };
        }
        const [h] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
        if (!h) return { canceled: true };
        const file = await h.getFile();
        const text = await file.text();
        let data; try { data = JSON.parse(text); } catch { return { canceled: true, error: 'Invalid JSON' }; }
        if (!validateRosterWeb(data)) return { canceled: true, error: 'Roster schema invalid' };
        try { localStorage.setItem('FR_ROSTER', JSON.stringify(data)); } catch {}
        return { canceled: false, roster: data };
      } catch (e) {
        return { canceled: true };
      }
    },
    getRoster: async () => {
      try { const raw = localStorage.getItem('FR_ROSTER'); if (!raw) return { ok: false, error: 'No roster loaded' }; const roster = JSON.parse(raw); return { ok: true, roster }; } catch (e) { return { ok: false, error: String(e) }; }
    }
  };

  // Hide unsupported UI affordances in web mode
  try { document.getElementById('showInFolderBtn').style.display = 'none'; } catch {}
})();

/* ===== Utilities ===== */

function formatTime(s) {
  if (!isFinite(s) || s == null) return '00:00';
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function sanitizeBaseName(name) {
  // Remove invalid filename chars on Windows and common OSes
  const cleaned = name.replace(/[\/\\:*?"<>|]/g, '-').trim();
  // Avoid empty or dots-only
  return cleaned.replace(/^\.+$/, '').trim();
}

function getLastName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

function ensureUniqueTags(tags) {
  const seen = new Set();
  const out = [];
  for (const p of tags) {
    const key = p.number + '|' + p.name;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

function buildTaggedBaseName(originalBase, tags) {
  if (!tags.length) return originalBase;
  const suffixes = tags.map(p => getLastName(p.name)).filter(Boolean);
  if (!suffixes.length) return originalBase;
  return originalBase + '_' + suffixes.join('_');
}

function filterPlayersByNumber(prefix) {
  if (!ROSTER || !ROSTER.players) return [];
  if (!prefix) return ROSTER.players.slice(0, 50); // limit
  const lower = prefix.toLowerCase();
  return ROSTER.players.filter(p => p.number.toLowerCase().startsWith(lower)).slice(0, 50);
}

function renderSuggestions(list) {
  if (!list.length) {
    tagSuggestions.innerHTML = '<div class="item" style="opacity:0.5;pointer-events:none;">No matches</div>';
    return;
  }
  tagSuggestions.innerHTML = list.map(p => `
    <div class="item" data-number="${p.number.replace(/"/g,'&quot;')}" data-name="${p.name.replace(/"/g,'&quot;')}">
      <span class="num">#${p.number}</span>
      <span class="name">${p.name}</span>
      <span class="pos">${p.position || ''}</span>
    </div>`).join('');
}

function openTagOverlay() {
  if (!FILES.length || isRenaming || isTagging) return;
  if (!ROSTER) {
    showToast('Load roster first (button top-left)');
    return;
  }
  isTagging = true;
  const file = FILES[index];
  currentTags = fileTagCache.get(file.path) ? [...fileTagCache.get(file.path)] : [];
  tagInput.value = '';
  tagOverlay.classList.remove('hidden');
  tagSuggestions.classList.remove('hidden');
  renderSuggestions(filterPlayersByNumber(''));
  renderCurrentTagPills();
  setTimeout(() => { tagInput.focus(); tagInput.select(); }, 0);
}

function closeTagOverlay() {
  if (!isTagging) return;
  isTagging = false;
  tagOverlay.classList.add('hidden');
}

function openDetailsOverlay() {
  if (!FILES.length || isRenaming || isEnteringDetails) return;
  isEnteringDetails = true;
  detailsInput.value = '';
  detailsOverlay.classList.remove('hidden');
  setTimeout(()=>{ detailsInput.focus(); detailsInput.select(); },0);
}

function closeDetailsOverlay() {
  if (!isEnteringDetails) return;
  isEnteringDetails = false;
  detailsOverlay.classList.add('hidden');
}

function finalizeTagsThenDetails() {
  if (!isTagging) return;
  if (!FILES.length) { closeTagOverlay(); return; }
  // proceed to details entry (rename will happen after details)
  closeTagOverlay();
  openDetailsOverlay();
}

async function performTagRename(file, newBase) {
  // Pause & detach to avoid file locks
  const wasPlaying = !videoEl.paused;
  videoEl.pause();
  videoEl.src = '';
  const res = await window.api.renameFile(file.path, sanitizeBaseName(newBase));
  if (!res || !res.ok) {
    showToast('Tag rename failed');
    videoEl.src = file.url;
    if (wasPlaying) videoEl.play().catch(()=>{});
    closeTagOverlay();
    return;
  }
  FILES[index] = res.file;
  const currentIndex = index;
  let advanced = false;
  if (currentIndex < FILES.length - 1) {
    loadVideoAt(currentIndex + 1, true);
    advanced = true;
  } else {
    loadVideoAt(currentIndex, true);
  }
  showToast(advanced ? 'Tagged → Next clip' : 'Tagged (last clip)');
  closeTagOverlay();
}

function addTag(player) {
  currentTags.push(player);
  currentTags = ensureUniqueTags(currentTags);
  const label = currentTags.map(p => '#' + p.number + ' ' + getLastName(p.name)).join(', ');
  tagInput.value = '';
  tagInput.placeholder = label || 'Type jersey number';
  renderSuggestions(filterPlayersByNumber(''));
  // cache current tags per file
  if (FILES.length) {
    fileTagCache.set(FILES[index].path, [...currentTags]);
  }
  renderCurrentTagPills();
}

function renderCurrentTagPills() {
  if (!currentTagsEl) return;
  if (!currentTags.length) {
    currentTagsEl.innerHTML = '<span style="opacity:.5;font-size:11px;">No players tagged</span>';
    return;
  }
  currentTagsEl.innerHTML = currentTags.map((p,i)=>`<span class="pill" data-i="${i}">#${p.number} ${getLastName(p.name)} <button title="Remove" data-remove="${i}">×</button></span>`).join('');
}

function showToast(msg, ms = 1800) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, ms);
}

function updateCounter() {
  fileCounterEl.textContent = `${FILES.length ? index + 1 : 0} / ${FILES.length}`;
}

function setFilenameUI() {
  if (!FILES.length) {
    currentNameEl.textContent = 'No file loaded';
    return;
  }
  const f = FILES[index];
  currentNameEl.textContent = f.name;
}

/* ===== Loading & navigation ===== */

function loadVideoAt(i, keepPaused = true) {
  if (!FILES.length) return;
  index = Math.max(0, Math.min(i, FILES.length - 1));
  const f = FILES[index];

  // Load new source
  videoEl.pause();
  videoEl.src = f.url;
  videoEl.currentTime = 0;
  if (!keepPaused) {
    videoEl.play().catch(() => {});
  }

  setFilenameUI();
  updateCounter();
  // Update mute button label
  muteBtn.textContent = videoEl.muted ? 'Unmute' : 'Mute';
}

function next() {
  if (!FILES.length) return;
  if (index < FILES.length - 1) {
    loadVideoAt(index + 1, true);
  } else {
    showToast('Reached end of list');
  }
}

function prev() {
  if (!FILES.length) return;
  if (index > 0) {
    loadVideoAt(index - 1, true);
  } else {
    showToast('At beginning');
  }
}

/* ===== Rename flow ===== */

function startRename() {
  if (!FILES.length || isRenaming) return;
  isRenaming = true;

  const f = FILES[index];
  renameInput.value = f.base; // prefill without extension
  renameOverlay.classList.remove('hidden');
  setTimeout(() => {
    renameInput.focus();
    renameInput.select();
  }, 0);
}

async function saveRenameAndAdvance() {
  if (!FILES.length || !isRenaming) return;
  const old = FILES[index];
  let newBase = sanitizeBaseName(renameInput.value);
  if (!newBase) {
    showToast('Name cannot be empty.');
    return;
  }

  // Pause & detach to avoid file-lock issues on Windows
  const wasPlaying = !videoEl.paused;
  videoEl.pause();
  videoEl.src = '';

  const res = await window.api.renameFile(old.path, newBase);
  if (!res || !res.ok) {
    const err = res && res.error ? res.error : 'Unknown error';
    showToast('Rename failed: ' + err, 2600);
    // Try to restore current video if failed
    videoEl.src = old.url;
    if (wasPlaying) videoEl.play().catch(() => {});
    return;
  }

  const updated = res.file;
  // Update the entry in-place
  FILES[index] = updated;

  // Exit rename mode
  isRenaming = false;
  renameOverlay.classList.add('hidden');

  // Auto-advance
  if (index < FILES.length - 1) {
    loadVideoAt(index + 1, true);
  } else {
    // On last file, stay on it with the new name
    loadVideoAt(index, true);
    showToast('All files processed!');
  }
}

function cancelRename() {
  if (!isRenaming) return;
  isRenaming = false;
  renameOverlay.classList.add('hidden');
}

/* ===== Mouse scrubbing ===== */

function updateSeekUI() {
  const d = videoEl.duration || 0;
  const t = videoEl.currentTime || 0;
  currentTimeEl.textContent = formatTime(t);
  durationEl.textContent = formatTime(d);
  if (d > 0 && !seeking) {
    seekEl.value = String((t / d) * 100);
  }
}

function seekToPercent(pct) {
  const d = videoEl.duration || 0;
  if (d > 0) {
    videoEl.currentTime = (pct / 100) * d;
  }
}

/* ===== Events ===== */

openFolderBtn.addEventListener('click', async () => {
  const res = await window.api.pickFolder();
  if (res.canceled) {
    if (res.error) showToast('Error: ' + res.error);
    return;
  }
  DIR = res.dir;
  FILES = res.files || [];
  folderPathEl.textContent = DIR || '';
  if (!FILES.length) {
    currentNameEl.textContent = 'No video files in this folder.';
    fileCounterEl.textContent = '0 / 0';
    videoEl.src = '';
    return;
  }
  loadVideoAt(0, true);
});

showInFolderBtn.addEventListener('click', () => {
  if (FILES.length) {
    window.api.showInFolder(FILES[index].path);
  }
});

prevBtn.addEventListener('click', prev);
nextBtn.addEventListener('click', next);

playPauseBtn.addEventListener('click', () => {
  if (videoEl.paused) {
    videoEl.play().then(() => (playPauseBtn.textContent = 'Pause')).catch(() => {});
  } else {
    videoEl.pause();
    playPauseBtn.textContent = 'Play';
  }
});

muteBtn.addEventListener('click', () => {
  videoEl.muted = !videoEl.muted;
  muteBtn.textContent = videoEl.muted ? 'Unmute' : 'Mute';
});

deleteBtn.addEventListener('click', async () => {
  if (!FILES.length) return;
  const file = FILES[index];
  const confirm = await window.api.confirmDelete(file.name);
  if (!confirm || !confirm.confirmed) {
    showToast('Canceled');
    return;
  }
  // Temporarily release video handle
  videoEl.pause();
  videoEl.src = '';
  const res = await window.api.deleteFile(file.path);
  if (!res || !res.ok) {
    showToast('Delete failed');
    // restore if needed
    if (file && file.url) videoEl.src = file.url;
    return;
  }
  // Remove from list
  FILES.splice(index, 1);
  if (!FILES.length) {
    currentNameEl.textContent = 'No file loaded';
    fileCounterEl.textContent = '0 / 0';
    showToast('Deleted. No more files.');
    return;
  }
  if (index >= FILES.length) index = FILES.length - 1;
  loadVideoAt(index, true);
  showToast('Deleted');
});

videoEl.addEventListener('play', () => (playPauseBtn.textContent = 'Pause'));
videoEl.addEventListener('pause', () => (playPauseBtn.textContent = 'Play'));
videoEl.addEventListener('loadedmetadata', updateSeekUI);
videoEl.addEventListener('timeupdate', updateSeekUI);
videoEl.addEventListener('durationchange', updateSeekUI);

seekEl.addEventListener('mousedown', () => { seeking = true; });
seekEl.addEventListener('mouseup', () => { seeking = false; });
seekEl.addEventListener('input', (e) => {
  seeking = true;
  const pct = Number(e.target.value);
  seekToPercent(pct);
});

document.addEventListener('keydown', (e) => {
  // If typing in rename input, let Enter go through to save
  if (isRenaming) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRenameAndAdvance();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelRename();
      return;
    }
    return;
  }

  if (isEnteringDetails) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const details = sanitizeBaseName(detailsInput.value.trim());
      const file = FILES[index];
      const baseNoExtra = file.base.split(/_(?=[^_]+$)/)[0] || file.base; // first segment before last underscore if any
      let taggedBase = buildTaggedBaseName(baseNoExtra, currentTags);
      if (details) taggedBase = taggedBase + '_' + details;
      closeDetailsOverlay();
  performTagRename(file, taggedBase);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDetailsOverlay();
      showToast('Canceled details');
      return;
    }
    return;
  }

  if (isTagging) {
    if (e.key === 'Enter') {
      e.preventDefault();
      finalizeTagsThenDetails();
      return;
    }
    if (e.key === ' ') { // allow play/pause while tagging
      e.preventDefault();
      if (videoEl.paused) {
        videoEl.play().catch(()=>{});
      } else {
        videoEl.pause();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
  // Do not clear tags on Esc; just close
  closeTagOverlay();
      return;
    }
    return; // other keys handled by input event
  }

  // Global shortcuts
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    next();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prev();
  } else if (e.key === ' ') {
    e.preventDefault();
    if (videoEl.paused) {
      videoEl.play().catch(() => {});
    } else {
      videoEl.pause();
    }
  } else if (e.key === 'Enter') { // new flow: Enter -> tag overlay first
    e.preventDefault();
    openTagOverlay();
  } else if (e.key.toLowerCase() === 't') {
    e.preventDefault();
    openTagOverlay();
  } else if (e.key === 'Delete') {
    e.preventDefault();
    deleteBtn.click();
  }
});

/* Auto prompt for folder on first load */
window.addEventListener('DOMContentLoaded', async () => {
  const res = await window.api.pickFolder();
  if (res && !res.canceled) {
    DIR = res.dir;
    FILES = res.files || [];
    folderPathEl.textContent = DIR || '';
    if (FILES.length) {
      loadVideoAt(0, true);
    } else {
      currentNameEl.textContent = 'No video files in this folder.';
      fileCounterEl.textContent = '0 / 0';
      videoEl.src = '';
    }
  }
});

/* Roster load button */
loadRosterBtn.addEventListener('click', async () => {
  const res = await window.api.pickRoster();
  if (res && !res.canceled && res.roster) {
    ROSTER = res.roster;
    showToast('Roster loaded: ' + (ROSTER.team || 'Team'));
  } else if (res && res.error) {
    showToast('Roster error: ' + res.error);
  }
});

/* Attempt to load stored roster at startup */
window.api.getRoster().then(r => { if (r && r.ok) { ROSTER = r.roster; } });

/* Tag input events */
tagInput.addEventListener('input', (e) => {
  if (!isTagging) return;
  const v = e.target.value.trim();
  renderSuggestions(filterPlayersByNumber(v));
});

tagSuggestions.addEventListener('click', (e) => {
  const item = e.target.closest('.item');
  if (!item) return;
  const num = item.getAttribute('data-number');
  const name = item.getAttribute('data-name');
  const player = ROSTER.players.find(p => p.number === num && p.name === name);
  if (player) {
    addTag(player);
  }
});

tagOverlay.addEventListener('click', (e) => {
  if (e.target === tagOverlay) {
  // Close without clearing tags when clicking backdrop
  closeTagOverlay();
  }
});

detailsOverlay.addEventListener('click', (e) => {
  if (e.target === detailsOverlay) {
    closeDetailsOverlay();
  }
});

// Tag pill removal
if (currentTagsEl) {
  currentTagsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove]');
    if (!btn) return;
    const idx = Number(btn.getAttribute('data-remove'));
    if (!Number.isNaN(idx)) {
      currentTags.splice(idx,1);
      if (FILES.length) fileTagCache.set(FILES[index].path, [...currentTags]);
      renderCurrentTagPills();
      const label = currentTags.map(p => '#' + p.number + ' ' + getLastName(p.name)).join(', ');
      tagInput.placeholder = label || 'Type jersey number';
    }
  });
}

/* ===== Zoom & Pan (Playback Area) ===== */
// Scroll wheel to zoom, click-drag to pan when zoomed > 1, double-click to reset.
let _zoom = 1;
let _panX = 0;
let _panY = 0;
let _isDragging = false;
let _dragStartX = 0;
let _dragStartY = 0;
let _origPanX = 0;
let _origPanY = 0;

function applyVideoTransform() {
  // Clamp pan so you can't drag beyond edges excessively
  const rect = videoEl.getBoundingClientRect();
  const maxX = (_zoom - 1) * rect.width / 2;
  const maxY = (_zoom - 1) * rect.height / 2;
  if (maxX > 0) {
    _panX = Math.max(-maxX, Math.min(maxX, _panX));
  } else { _panX = 0; }
  if (maxY > 0) {
    _panY = Math.max(-maxY, Math.min(maxY, _panY));
  } else { _panY = 0; }
  videoEl.style.transform = `translate(${_panX}px, ${_panY}px) scale(${_zoom})`;
  if (_zoom > 1) {
    videoEl.style.cursor = _isDragging ? 'grabbing' : 'grab';
  } else {
    videoEl.style.cursor = 'default';
  }
}

function resetZoomPan() {
  _zoom = 1;
  _panX = 0;
  _panY = 0;
  applyVideoTransform();
}

videoEl.addEventListener('wheel', (e) => {
  // Only act if not over an overlay
  if (isRenaming || isTagging || isEnteringDetails) return;
  e.preventDefault();
  const prevZoom = _zoom;
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  _zoom = Math.max(1, Math.min(8, _zoom * factor));
  // Keep pointer position roughly stable while zooming
  if (_zoom !== prevZoom) {
    const rect = videoEl.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    // Adjust pan so the zoom centers around cursor
    _panX = ( _panX + cx ) * (_zoom / prevZoom) - cx;
    _panY = ( _panY + cy ) * (_zoom / prevZoom) - cy;
    applyVideoTransform();
  }
}, { passive: false });

videoEl.addEventListener('mousedown', (e) => {
  if (_zoom <= 1) return; // no pan when not zoomed
  if (e.button !== 0) return;
  _isDragging = true;
  videoEl.classList.add('dragging');
  _dragStartX = e.clientX;
  _dragStartY = e.clientY;
  _origPanX = _panX;
  _origPanY = _panY;
});

window.addEventListener('mousemove', (e) => {
  if (!_isDragging) return;
  const dx = e.clientX - _dragStartX;
  const dy = e.clientY - _dragStartY;
  _panX = _origPanX + dx;
  _panY = _origPanY + dy;
  applyVideoTransform();
});

window.addEventListener('mouseup', () => {
  if (_isDragging) {
    _isDragging = false;
    videoEl.classList.remove('dragging');
  applyVideoTransform();
  }
});

videoEl.addEventListener('mouseleave', () => {
  if (_isDragging) {
    _isDragging = false;
    videoEl.classList.remove('dragging');
  applyVideoTransform();
  }
});

videoEl.addEventListener('dblclick', () => {
  resetZoomPan();
});

// Reset zoom/pan whenever a new video loads
const _origLoadVideoAt = loadVideoAt;
loadVideoAt = function(i, keepPaused = true) { // override while preserving original
  _origLoadVideoAt(i, keepPaused);
  resetZoomPan();
};


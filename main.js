// ==================== DATA MODELS ====================
let appData = {
  tasks: [],
  notes: [],
  versions: []
};

let currentView = 'kanban';
let currentNote = null;
let currentTaskForComments = null;
let currentHistoryItem = null;
let addTaskStatus = 'todo';
let isNoteEditing = false;
let draggedTaskId = null;
let lastSyncTime = null;

// Ensure all functions are available globally
window.setView = setView;
window.showAddTask = showAddTask;
window.closeAddTaskModal = closeAddTaskModal;
window.addTask = addTask;
window.editTaskTitle = editTaskTitle;
window.confirmDeleteTask = confirmDeleteTask;
window.handleDragStart = handleDragStart;
window.handleDragEnd = handleDragEnd;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.showComments = showComments;
window.closeCommentsModal = closeCommentsModal;
window.addComment = addComment;
window.deleteComment = deleteComment;
window.showTaskHistory = showTaskHistory;
window.showNoteHistory = showNoteHistory;
window.closeHistoryModal = closeHistoryModal;
window.revertToVersion = revertToVersion;
window.syncNotesWithGitHub = syncNotesWithGitHub;
window.saveNoteToFile = saveNoteToFile;
window.importNoteFromFile = importNoteFromFile;
window.selectNote = selectNote;
window.toggleNoteEdit = toggleNoteEdit;
window.updateNoteTitle = updateNoteTitle;
window.updateNoteContent = updateNoteContent;
window.createNote = createNote;
window.deleteCurrentNote = deleteCurrentNote;
window.handleSearch = handleSearch;
window.showSetup = showSetup;
window.saveGitHubConfig = saveGitHubConfig;
window.skipGitHubSetup = skipGitHubSetup;
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.exportData = exportData;
window.importData = importData;
window.clearAllData = clearAllData;
window.syncWithGitHub = syncWithGitHub;
window.toggleDarkMode = toggleDarkMode;

// ==================== DARK MODE ====================
function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.classList.contains('dark');
  
  if (isDark) {
    html.classList.remove('dark');
    localStorage.setItem('darkMode', 'false');
  } else {
    html.classList.add('dark');
    localStorage.setItem('darkMode', 'true');
  }
  
  updateDarkModeIcon();
}

function updateDarkModeIcon() {
  const isDark = document.documentElement.classList.contains('dark');
  const darkModeIcon = document.getElementById('darkModeIcon');
  
  if (darkModeIcon) {
    if (isDark) {
      // Show moon icon
      darkModeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>`;
    } else {
      // Show sun icon
      darkModeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>`;
    }
  }
}

function initDarkMode() {
  const savedMode = localStorage.getItem('darkMode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedMode === 'true' || (savedMode === null && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  
  updateDarkModeIcon();
}

// ==================== GITHUB API ====================
const GitHubStorage = {
  config: null,
  
  loadConfig() {
    const stored = localStorage.getItem('github_config');
    if (stored) {
      this.config = JSON.parse(stored);
      return true;
    }
    return false;
  },
  
  saveConfig(token, repo, branch = 'main') {
    this.config = { token, repo, branch };
    localStorage.setItem('github_config', JSON.stringify(this.config));
  },
  
  clearConfig() {
    this.config = null;
    localStorage.removeItem('github_config');
  },
  
  isConfigured() {
    return this.config && this.config.token && this.config.repo;
  },
  
  async getFile(path) {
    if (!this.isConfigured()) return null;
    
    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.config.repo}/contents/${path}?ref=${this.config.branch}`,
        {
          headers: {
            'Authorization': `token ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to fetch file');
      
      const data = await response.json();
      const content = atob(data.content);
      return { content: JSON.parse(content), sha: data.sha };
    } catch (error) {
      console.error('GitHub getFile error:', error);
      return null;
    }
  },
  
  async saveFile(path, content, message = 'Update data') {
    if (!this.isConfigured()) return false;
    
    try {
      // Get current file SHA if exists
      const existing = await this.getFile(path);
      
      const body = {
        message,
        content: btoa(JSON.stringify(content, null, 2)),
        branch: this.config.branch
      };
      
      if (existing) {
        body.sha = existing.sha;
      }
      
      const response = await fetch(
        `https://api.github.com/repos/${this.config.repo}/contents/${path}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save file');
      }
      
      return true;
    } catch (error) {
      console.error('GitHub saveFile error:', error);
      return false;
    }
  },
  
  async testConnection() {
    if (!this.isConfigured()) return false;
    
    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.config.repo}`,
        {
          headers: {
            'Authorization': `token ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
};

// ==================== LOCAL STORAGE ====================
const LocalStorage = {
  save() {
    localStorage.setItem('taskflow_data', JSON.stringify(appData));
  },
  
  load() {
    const stored = localStorage.getItem('taskflow_data');
    if (stored) {
      appData = JSON.parse(stored);
      return true;
    }
    return false;
  }
};

// ==================== DATA OPERATIONS ====================
function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function createVersion(itemId, itemType, data) {
  const version = {
    id: generateId(),
    itemId,
    itemType,
    data: JSON.parse(JSON.stringify(data)),
    createdAt: Date.now()
  };
  appData.versions.push(version);
  // Keep only last 50 versions per item
  const itemVersions = appData.versions.filter(v => v.itemId === itemId);
  if (itemVersions.length > 50) {
    const toRemove = itemVersions.slice(0, itemVersions.length - 50);
    toRemove.forEach(v => {
      const idx = appData.versions.findIndex(ver => ver.id === v.id);
      if (idx !== -1) appData.versions.splice(idx, 1);
    });
  }
}

function getVersions(itemId) {
  return appData.versions
    .filter(v => v.itemId === itemId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// Task operations
function createTask(title, status = 'todo') {
  const task = {
    id: generateId(),
    title,
    description: '',
    status,
    comments: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  appData.tasks.push(task);
  createVersion(task.id, 'task', task);
  saveData();
  return task;
}

function updateTask(taskId, updates) {
  const task = appData.tasks.find(t => t.id === taskId);
  if (task) {
    Object.assign(task, updates, { updatedAt: Date.now() });
    createVersion(task.id, 'task', task);
    saveData();
  }
  return task;
}

function deleteTask(taskId) {
  const idx = appData.tasks.findIndex(t => t.id === taskId);
  if (idx !== -1) {
    appData.tasks.splice(idx, 1);
    saveData();
  }
}

function addCommentToTask(taskId, content) {
  const task = appData.tasks.find(t => t.id === taskId);
  if (task) {
    task.comments.push({
      id: generateId(),
      content,
      createdAt: Date.now()
    });
    task.updatedAt = Date.now();
    createVersion(task.id, 'task', task);
    saveData();
  }
  return task;
}

function deleteCommentFromTask(taskId, commentId) {
  const task = appData.tasks.find(t => t.id === taskId);
  if (task) {
    task.comments = task.comments.filter(c => c.id !== commentId);
    task.updatedAt = Date.now();
    saveData();
  }
  return task;
}

// Note operations
function createNewNote(title = 'Untitled Note') {
  const note = {
    id: generateId(),
    title,
    content: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  appData.notes.push(note);
  createVersion(note.id, 'note', note);
  saveData();
  return note;
}

function updateNote(noteId, updates) {
  const note = appData.notes.find(n => n.id === noteId);
  if (note) {
    Object.assign(note, updates, { updatedAt: Date.now() });
    createVersion(note.id, 'note', note);
    saveData();
  }
  return note;
}

function deleteNote(noteId) {
  const idx = appData.notes.findIndex(n => n.id === noteId);
  if (idx !== -1) {
    appData.notes.splice(idx, 1);
    saveData();
  }
}

// ==================== SAVE & SYNC ====================
async function saveData() {
  LocalStorage.save();
  updateStats();
  
  if (GitHubStorage.isConfigured()) {
    updateSyncStatus('syncing');
    const success = await GitHubStorage.saveFile('taskflow-data.json', appData, 'Auto-save from TaskFlow');
    updateSyncStatus(success ? 'synced' : 'error');
  }
}

async function loadData() {
  LocalStorage.load();
  
  if (GitHubStorage.isConfigured()) {
    updateSyncStatus('syncing');
    const remote = await GitHubStorage.getFile('taskflow-data.json');
    if (remote && remote.content) {
      // Merge: use remote if newer
      const remoteData = remote.content;
      if (remoteData.tasks || remoteData.notes) {
        appData = {
          tasks: remoteData.tasks || [],
          notes: remoteData.notes || [],
          versions: remoteData.versions || []
        };
        LocalStorage.save();
      }
    }
    updateSyncStatus('synced');
  }
  
  renderAll();
}

async function syncWithGitHub() {
  if (!GitHubStorage.isConfigured()) {
    showSetup();
    return;
  }
  
  updateSyncStatus('syncing');
  
  // Pull from GitHub
  const remote = await GitHubStorage.getFile('taskflow-data.json');
  if (remote && remote.content) {
    appData = {
      tasks: remote.content.tasks || [],
      notes: remote.content.notes || [],
      versions: remote.content.versions || []
    };
    LocalStorage.save();
  }
  
  // Push to GitHub
  const success = await GitHubStorage.saveFile('taskflow-data.json', appData, 'Manual sync from TaskFlow');
  updateSyncStatus(success ? 'synced' : 'error');
  
  renderAll();
  showToast(success ? 'Synced successfully!' : 'Sync failed');
}

// ==================== UI HELPERS ====================
function formatRelativeDate(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderMarkdown(content) {
  if (!content) return '';
  try {
    return marked.parse(content);
  } catch {
    return content;
  }
}

function updateSyncStatus(status) {
  const icon = document.getElementById('syncIcon');
  const text = document.getElementById('syncText');
  const lastSyncEl = document.getElementById('lastSyncTime');
  const notesSyncIcon = document.getElementById('notesSyncIcon');
  const notesSyncText = document.getElementById('notesSyncText');
  const notesSyncStatus = document.getElementById('notesSyncStatus');
  const notesLastSync = document.getElementById('notesLastSync');
  
  switch (status) {
    case 'syncing':
      icon.className = 'w-2 h-2 rounded-full bg-yellow-400 sync-indicator';
      text.textContent = 'Syncing...';
      if (notesSyncIcon) notesSyncIcon.classList.add('animate-spin');
      if (notesSyncText) notesSyncText.textContent = 'Syncing...';
      break;
    case 'synced':
      icon.className = 'w-2 h-2 rounded-full bg-green-400';
      text.textContent = 'Synced';
      lastSyncTime = Date.now();
      localStorage.setItem('lastSyncTime', lastSyncTime);
      if (lastSyncEl) {
        lastSyncEl.textContent = `· ${formatRelativeDate(lastSyncTime)}`;
        lastSyncEl.classList.remove('hidden');
      }
      if (notesSyncIcon) notesSyncIcon.classList.remove('animate-spin');
      if (notesSyncText) notesSyncText.textContent = 'Synced';
      if (notesSyncStatus) notesSyncStatus.classList.remove('hidden');
      if (notesLastSync) notesLastSync.textContent = `Last synced: ${formatRelativeDate(lastSyncTime)}`;
      break;
    case 'error':
      icon.className = 'w-2 h-2 rounded-full bg-red-400';
      text.textContent = 'Sync Error';
      if (notesSyncIcon) notesSyncIcon.classList.remove('animate-spin');
      if (notesSyncText) notesSyncText.textContent = 'Error';
      break;
    default:
      icon.className = 'w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600';
      text.textContent = 'Local';
      if (lastSyncEl) lastSyncEl.classList.add('hidden');
      if (notesSyncText) notesSyncText.textContent = 'Sync';
      if (notesSyncStatus) notesSyncStatus.classList.add('hidden');
  }
}

// Restore last sync time on load
function restoreLastSyncTime() {
  const saved = localStorage.getItem('lastSyncTime');
  if (saved) {
    lastSyncTime = parseInt(saved);
    const lastSyncEl = document.getElementById('lastSyncTime');
    const notesSyncStatus = document.getElementById('notesSyncStatus');
    const notesLastSync = document.getElementById('notesLastSync');
    
    if (lastSyncEl && GitHubStorage.isConfigured()) {
      lastSyncEl.textContent = `· ${formatRelativeDate(lastSyncTime)}`;
      lastSyncEl.classList.remove('hidden');
    }
    if (notesSyncStatus && GitHubStorage.isConfigured()) {
      notesSyncStatus.classList.remove('hidden');
      if (notesLastSync) notesLastSync.textContent = `Last synced: ${formatRelativeDate(lastSyncTime)}`;
    }
  }
}

function updateStats() {
  document.getElementById('stats').textContent = `${appData.tasks.length} tasks · ${appData.notes.length} notes`;
  document.getElementById('storageInfo').textContent = GitHubStorage.isConfigured() 
    ? `Stored in GitHub: ${GitHubStorage.config.repo}` 
    : 'Data stored locally';
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 bg-gray-800 dark:bg-slate-700 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// ==================== VIEW MANAGEMENT ====================
function setView(view) {
  currentView = view;
  
  document.getElementById('kanbanView').classList.toggle('hidden', view !== 'kanban');
  document.getElementById('notesView').classList.toggle('hidden', view !== 'notes');
  
  document.getElementById('kanbanTab').className = view === 'kanban' 
    ? 'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
    : 'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200';
  
  document.getElementById('notesTab').className = view === 'notes'
    ? 'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
    : 'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200';
}

// ==================== KANBAN RENDERING ====================
function renderTasks() {
  const searchQuery = document.getElementById('searchInput').value.toLowerCase();
  
  const filteredTasks = appData.tasks.filter(task => 
    task.title.toLowerCase().includes(searchQuery) ||
    task.description.toLowerCase().includes(searchQuery)
  );
  
  const todoTasks = filteredTasks.filter(t => t.status === 'todo');
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in-progress');
  const doneTasks = filteredTasks.filter(t => t.status === 'done');
  
  document.getElementById('todoCount').textContent = todoTasks.length;
  document.getElementById('inProgressCount').textContent = inProgressTasks.length;
  document.getElementById('doneCount').textContent = doneTasks.length;
  
  document.getElementById('todoTasks').innerHTML = todoTasks.map(renderTaskCard).join('');
  document.getElementById('inProgressTasks').innerHTML = inProgressTasks.map(renderTaskCard).join('');
  document.getElementById('doneTasks').innerHTML = doneTasks.map(renderTaskCard).join('');
}

function renderTaskCard(task) {
  return `
    <div class="task-card bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-gray-200 dark:border-slate-600 p-3 hover:shadow-md transition-shadow"
         draggable="true" 
         ondragstart="handleDragStart(event, '${task.id}')"
         ondragend="handleDragEnd(event)"
         data-task-id="${task.id}">
      <h4 class="font-medium text-gray-800 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" 
          onclick="editTaskTitle('${task.id}')" 
          id="task-title-${task.id}">${escapeHtml(task.title)}</h4>
      <div class="flex items-center justify-between mt-2">
        <span class="text-xs text-gray-400 dark:text-gray-500">${formatRelativeDate(task.updatedAt)}</span>
        <div class="flex items-center gap-1">
          <button onclick="showComments('${task.id}')" class="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded relative" title="Comments">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            ${task.comments.length > 0 ? `<span class="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">${task.comments.length}</span>` : ''}
          </button>
          <button onclick="showTaskHistory('${task.id}')" class="p-1 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded" title="History">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </button>
          <button onclick="confirmDeleteTask('${task.id}')" class="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Delete">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== TASK ACTIONS ====================
function showAddTask(status) {
  addTaskStatus = status;
  document.getElementById('addTaskModal').classList.remove('hidden');
  document.getElementById('newTaskTitle').value = '';
  document.getElementById('newTaskTitle').focus();
}

function closeAddTaskModal() {
  document.getElementById('addTaskModal').classList.add('hidden');
}

function addTask() {
  const title = document.getElementById('newTaskTitle').value.trim();
  if (title) {
    createTask(title, addTaskStatus);
    closeAddTaskModal();
    renderTasks();
  }
}

function editTaskTitle(taskId) {
  const el = document.getElementById(`task-title-${taskId}`);
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = task.title;
  input.className = 'w-full px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500';
  
  input.onblur = () => saveTaskTitle(taskId, input.value);
  input.onkeydown = (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.value = task.title;
      input.blur();
    }
  };
  
  el.replaceWith(input);
  input.focus();
  input.select();
}

function saveTaskTitle(taskId, newTitle) {
  if (newTitle.trim()) {
    updateTask(taskId, { title: newTitle.trim() });
  }
  renderTasks();
}

function confirmDeleteTask(taskId) {
  if (confirm('Delete this task?')) {
    deleteTask(taskId);
    renderTasks();
  }
}

// Drag and Drop
function handleDragStart(event, taskId) {
  draggedTaskId = taskId;
  event.target.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(event) {
  event.target.classList.remove('dragging');
  document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

function handleDrop(event, status) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  
  if (draggedTaskId) {
    const task = appData.tasks.find(t => t.id === draggedTaskId);
    if (task && task.status !== status) {
      updateTask(draggedTaskId, { status });
      renderTasks();
    }
    draggedTaskId = null;
  }
}

// ==================== COMMENTS ====================
function showComments(taskId) {
  currentTaskForComments = appData.tasks.find(t => t.id === taskId);
  if (!currentTaskForComments) return;
  
  document.getElementById('commentsTitle').textContent = `Comments - ${currentTaskForComments.title}`;
  renderComments();
  document.getElementById('commentsModal').classList.remove('hidden');
}

function closeCommentsModal() {
  document.getElementById('commentsModal').classList.add('hidden');
  currentTaskForComments = null;
}

function renderComments() {
  if (!currentTaskForComments) return;
  
  const comments = [...currentTaskForComments.comments].reverse();
  document.getElementById('commentsList').innerHTML = comments.length === 0
    ? '<p class="text-center text-gray-400 dark:text-gray-500 py-8">No comments yet</p>'
    : comments.map(comment => `
        <div class="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 group">
          <div class="flex items-start justify-between gap-2">
            <p class="text-gray-700 dark:text-gray-200 flex-1">${escapeHtml(comment.content)}</p>
            <button onclick="deleteComment('${comment.id}')" class="p-1 text-gray-300 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">${formatRelativeDate(comment.createdAt)}</p>
        </div>
      `).join('');
}

function addComment() {
  const input = document.getElementById('newComment');
  const content = input.value.trim();
  if (content && currentTaskForComments) {
    addCommentToTask(currentTaskForComments.id, content);
    currentTaskForComments = appData.tasks.find(t => t.id === currentTaskForComments.id);
    input.value = '';
    renderComments();
    renderTasks();
  }
}

function deleteComment(commentId) {
  if (currentTaskForComments) {
    deleteCommentFromTask(currentTaskForComments.id, commentId);
    currentTaskForComments = appData.tasks.find(t => t.id === currentTaskForComments.id);
    renderComments();
    renderTasks();
  }
}

// ==================== HISTORY ====================
function showTaskHistory(taskId) {
  currentHistoryItem = { id: taskId, type: 'task' };
  renderHistory();
  document.getElementById('historyModal').classList.remove('hidden');
}

function showNoteHistory() {
  if (!currentNote) return;
  currentHistoryItem = { id: currentNote.id, type: 'note' };
  renderHistory();
  document.getElementById('historyModal').classList.remove('hidden');
}

function closeHistoryModal() {
  document.getElementById('historyModal').classList.add('hidden');
  currentHistoryItem = null;
}

function renderHistory() {
  if (!currentHistoryItem) return;
  
  const versions = getVersions(currentHistoryItem.id);
  document.getElementById('historyList').innerHTML = versions.length === 0
    ? '<div class="text-center py-8 text-gray-400 dark:text-gray-500">No version history</div>'
    : versions.map((version, index) => `
        <div class="border border-gray-200 dark:border-slate-600 rounded-lg p-3 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">${index === 0 ? 'Latest' : `Version ${versions.length - index}`}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500">${formatDate(version.createdAt)}</span>
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-300 mb-2">
            <span class="font-medium">Title:</span> ${escapeHtml(version.data.title)}
          </div>
          ${currentHistoryItem.type === 'note' && version.data.content ? 
            `<div class="text-sm text-gray-500 dark:text-gray-400 truncate">${escapeHtml(version.data.content.substring(0, 100))}${version.data.content.length > 100 ? '...' : ''}</div>` : ''}
          ${currentHistoryItem.type === 'task' ? 
            `<div class="text-sm text-gray-500 dark:text-gray-400">Status: <span class="capitalize">${version.data.status.replace('-', ' ')}</span></div>` : ''}
          ${index > 0 ? `
            <button onclick="revertToVersion('${version.id}')" class="mt-2 flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Revert to this version
            </button>
          ` : ''}
        </div>
      `).join('');
}

function revertToVersion(versionId) {
  const version = appData.versions.find(v => v.id === versionId);
  if (!version) return;
  
  if (version.itemType === 'task') {
    const taskIdx = appData.tasks.findIndex(t => t.id === version.itemId);
    if (taskIdx !== -1) {
      appData.tasks[taskIdx] = { ...version.data, updatedAt: Date.now() };
      saveData();
      renderTasks();
    }
  } else {
    const noteIdx = appData.notes.findIndex(n => n.id === version.itemId);
    if (noteIdx !== -1) {
      appData.notes[noteIdx] = { ...version.data, updatedAt: Date.now() };
      currentNote = appData.notes[noteIdx];
      saveData();
      renderNotes();
      renderNoteEditor();
    }
  }
  
  closeHistoryModal();
  showToast('Reverted to previous version');
}

// ==================== SYNC NOTES SPECIFICALLY ====================
async function syncNotesWithGitHub() {
  if (!GitHubStorage.isConfigured()) {
    showSetup();
    return;
  }
  
  updateSyncStatus('syncing');
  
  // Pull from GitHub
  const remote = await GitHubStorage.getFile('taskflow-data.json');
  if (remote && remote.content) {
    // Merge notes from remote
    const remoteNotes = remote.content.notes || [];
    
    // Smart merge: keep local notes that don't exist remotely, update existing ones
    const mergedNotes = [...remoteNotes];
    appData.notes.forEach(localNote => {
      const existingIdx = mergedNotes.findIndex(n => n.id === localNote.id);
      if (existingIdx === -1) {
        // Local note doesn't exist remotely, add it
        mergedNotes.push(localNote);
      } else if (localNote.updatedAt > mergedNotes[existingIdx].updatedAt) {
        // Local is newer, use local
        mergedNotes[existingIdx] = localNote;
      }
    });
    
    appData.notes = mergedNotes;
    appData.tasks = remote.content.tasks || appData.tasks;
    appData.versions = remote.content.versions || appData.versions;
    LocalStorage.save();
  }
  
  // Push to GitHub
  const success = await GitHubStorage.saveFile('taskflow-data.json', appData, 'Sync notes from TaskFlow');
  updateSyncStatus(success ? 'synced' : 'error');
  
  renderNotes();
  renderNoteEditor();
  showToast(success ? 'Notes synced!' : 'Sync failed');
}

function saveNoteToFile(format = 'json') {
  if (!currentNote) return;
  
  if (format === 'md') {
    // Save as markdown
    const content = `# ${currentNote.title}\n\n${currentNote.content}\n\n---\n*Last updated: ${formatDate(currentNote.updatedAt)}*`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentNote.title.replace(/[^a-z0-9]/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Note saved as Markdown!');
    return;
  }
  
  const noteData = {
    ...currentNote,
    exportedAt: Date.now(),
    version: '1.0'
  };
  
  // Try File System Access API first
  if ('showSaveFilePicker' in window) {
    saveNoteWithFilePicker(noteData);
  } else {
    // Fallback to download
    downloadNoteAsFile(noteData);
  }
}

async function saveNoteWithFilePicker(noteData) {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: `${noteData.title.replace(/[^a-z0-9]/gi, '_')}.json`,
      types: [{
        description: 'JSON files',
        accept: { 'application/json': ['.json'] }
      }]
    });
    
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(noteData, null, 2));
    await writable.close();
    
    showToast('Note saved to file!');
  } catch (err) {
    if (err.name !== 'AbortError') {
      downloadNoteAsFile(noteData);
    }
  }
}

function downloadNoteAsFile(noteData) {
  const blob = new Blob([JSON.stringify(noteData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${noteData.title.replace(/[^a-z0-9]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Note downloaded!');
}

function importNoteFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.md,.txt';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      let noteData;
      
      if (file.name.endsWith('.json')) {
        noteData = JSON.parse(text);
      } else {
        // For .md or .txt files, create a new note
        noteData = {
          title: file.name.replace(/\.(md|txt)$/, ''),
          content: text
        };
      }
      
      // Create new note from imported data
      const note = {
        id: generateId(),
        title: noteData.title || 'Imported Note',
        content: noteData.content || '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      appData.notes.push(note);
      createVersion(note.id, 'note', note);
      saveData();
      
      currentNote = note;
      renderNotes();
      renderNoteEditor();
      showToast('Note imported!');
    } catch (err) {
      console.error('Import error:', err);
      alert('Failed to import note');
    }
  };
  input.click();
}

// ==================== NOTES ====================
function renderNotes() {
  const searchQuery = document.getElementById('searchInput').value.toLowerCase();
  
  const filteredNotes = appData.notes
    .filter(note => 
      note.title.toLowerCase().includes(searchQuery) ||
      note.content.toLowerCase().includes(searchQuery)
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
  
  document.getElementById('notesList').innerHTML = filteredNotes.length === 0
    ? `<div class="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">${searchQuery ? 'No notes found' : 'No notes yet'}</div>`
    : filteredNotes.map(note => `
        <button onclick="selectNote('${note.id}')" 
          class="w-full text-left p-2 rounded-lg transition-colors ${currentNote?.id === note.id 
            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700' 
            : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'}">
          <div class="font-medium text-gray-800 dark:text-white truncate text-sm">${escapeHtml(note.title)}</div>
          <div class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">${formatRelativeDate(note.updatedAt)}</div>
        </button>
      `).join('');
}

function selectNote(noteId) {
  // Save current note if editing
  if (isNoteEditing && currentNote) {
    saveCurrentNote();
  }
  
  currentNote = appData.notes.find(n => n.id === noteId);
  isNoteEditing = false;
  renderNotes();
  renderNoteEditor();
}

function renderNoteEditor() {
  if (!currentNote) {
    document.getElementById('noteEditorEmpty').classList.remove('hidden');
    document.getElementById('noteEditor').classList.add('hidden');
    return;
  }
  
  document.getElementById('noteEditorEmpty').classList.add('hidden');
  document.getElementById('noteEditor').classList.remove('hidden');
  
  document.getElementById('noteTitle').value = currentNote.title;
  document.getElementById('noteContent').value = currentNote.content;
  document.getElementById('notePreview').innerHTML = renderMarkdown(currentNote.content) || '<p class="text-gray-400 italic">No content. Click Edit to add some.</p>';
  
  if (isNoteEditing) {
    document.getElementById('noteContent').classList.remove('hidden');
    document.getElementById('notePreview').classList.add('hidden');
    document.getElementById('noteEditBtn').innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
      <span>Save</span>
    `;
    document.getElementById('noteEditBtn').className = 'flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm';
  } else {
    document.getElementById('noteContent').classList.add('hidden');
    document.getElementById('notePreview').classList.remove('hidden');
    document.getElementById('noteEditBtn').innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
      <span>Edit</span>
    `;
    document.getElementById('noteEditBtn').className = 'flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-slate-600 text-sm';
  }
}

function toggleNoteEdit() {
  if (isNoteEditing) {
    saveCurrentNote();
    isNoteEditing = false;
  } else {
    isNoteEditing = true;
  }
  renderNoteEditor();
}

function updateNoteTitle() {
  if (currentNote) {
    const newTitle = document.getElementById('noteTitle').value.trim();
    if (newTitle && newTitle !== currentNote.title) {
      updateNote(currentNote.id, { title: newTitle });
      currentNote = appData.notes.find(n => n.id === currentNote.id);
      renderNotes();
    }
  }
}

function updateNoteContent() {
  if (currentNote) {
    saveCurrentNote();
  }
}

function saveCurrentNote() {
  if (!currentNote) return;
  
  const newContent = document.getElementById('noteContent').value;
  if (newContent !== currentNote.content) {
    updateNote(currentNote.id, { content: newContent });
    currentNote = appData.notes.find(n => n.id === currentNote.id);
    renderNotes();
  }
}

function createNote() {
  const note = createNewNote();
  currentNote = note;
  isNoteEditing = true;
  renderNotes();
  renderNoteEditor();
  document.getElementById('noteTitle').focus();
  document.getElementById('noteTitle').select();
}

function deleteCurrentNote() {
  if (currentNote && confirm('Delete this note?')) {
    deleteNote(currentNote.id);
    currentNote = null;
    renderNotes();
    renderNoteEditor();
  }
}

// ==================== SEARCH ====================
function handleSearch() {
  renderTasks();
  renderNotes();
}

// ==================== SETTINGS & GITHUB CONFIG ====================
function showSetup() {
  document.getElementById('setupModal').classList.remove('hidden');
  if (GitHubStorage.config) {
    document.getElementById('githubToken').value = GitHubStorage.config.token || '';
    document.getElementById('githubRepo').value = GitHubStorage.config.repo || '';
    document.getElementById('githubBranch').value = GitHubStorage.config.branch || 'main';
  }
}

async function saveGitHubConfig() {
  const token = document.getElementById('githubToken').value.trim();
  const repo = document.getElementById('githubRepo').value.trim();
  const branch = document.getElementById('githubBranch').value.trim() || 'main';
  
  if (!token || !repo) {
    alert('Please enter both token and repository');
    return;
  }
  
  GitHubStorage.saveConfig(token, repo, branch);
  
  const connected = await GitHubStorage.testConnection();
  if (connected) {
    document.getElementById('setupModal').classList.add('hidden');
    showToast('Connected to GitHub!');
    await syncWithGitHub();
    updateStats();
  } else {
    alert('Failed to connect. Please check your token and repository.');
    GitHubStorage.clearConfig();
  }
}

function skipGitHubSetup() {
  document.getElementById('setupModal').classList.add('hidden');
  updateSyncStatus('local');
}

function showSettings() {
  document.getElementById('githubStatus').textContent = GitHubStorage.isConfigured()
    ? `Connected to: ${GitHubStorage.config.repo}`
    : 'Not connected';
  document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.add('hidden');
}

// ==================== EXPORT/IMPORT ====================
function exportData() {
  const data = {
    version: '1.0',
    exportedAt: Date.now(),
    ...appData
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `taskflow-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported!');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.tasks && data.notes) {
        appData = {
          tasks: data.tasks || [],
          notes: data.notes || [],
          versions: data.versions || []
        };
        saveData();
        renderAll();
        showToast('Data imported!');
      } else {
        alert('Invalid backup file');
      }
    } catch {
      alert('Failed to import file');
    }
  };
  input.click();
}

function clearAllData() {
  if (confirm('Are you sure? This will delete ALL your data!')) {
    if (confirm('This action cannot be undone. Continue?')) {
      appData = { tasks: [], notes: [], versions: [] };
      currentNote = null;
      saveData();
      renderAll();
      showToast('All data cleared');
    }
  }
}

// ==================== INITIALIZATION ====================
function renderAll() {
  renderTasks();
  renderNotes();
  renderNoteEditor();
  updateStats();
}

async function init() {
  // Initialize dark mode
  initDarkMode();
  
  // Load GitHub config
  GitHubStorage.loadConfig();
  
  // Load data
  await loadData();
  
  // Show setup if not configured
  if (!GitHubStorage.isConfigured()) {
    updateSyncStatus('local');
  } else {
    restoreLastSyncTime();
  }
  
  renderAll();
  
  // Auto-sync every 5 minutes if connected
  if (GitHubStorage.isConfigured()) {
    setInterval(async () => {
      await syncWithGitHub();
    }, 5 * 60 * 1000);
  }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

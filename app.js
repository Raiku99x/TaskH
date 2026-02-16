/* ══════════════════════════════════════════
   TASK HUB — app.js (with Browser Notifications & Stat Card Filters + Progress Card)
   ══════════════════════════════════════════ */

const STORAGE_KEY      = 'taskhub-v2-tasks';
const HIDDEN_CARDS_KEY = 'taskhub-v2-hidden';
const ARCHIVE_KEY      = 'taskhub-v2-archive';
const THEME_KEY        = 'taskhub-v2-theme';
const NOTIFIED_KEY     = 'taskhub-v2-notified';

let tasks        = [];
let archivedTasks = [];
let editId       = null;
let activePeriod = 'twomonths';
let hiddenCards  = new Set();
let activeSortMode = 'due';
let activeStatFilter = null;
let progressCycleMode = 'done';
let isFullscreen = false;
let isDarkMode   = false;
let notifiedTasks = {};

const CAT_LABELS = {
  quiz:       'Quiz',
  project:    'Project',
  assignment: 'Assignment',
  review:     'Review',
  output:     'Output',
  online:     'Online Class',
  facetoface: 'F2F Class',
  learning:   'Learning Task',
  other:      'Other',
};

const PRI_ORDER    = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER = { todo: 0, inprog: 1, done: 2 };


// ══════════════════════════════════════════
// NOTIFICATION SYSTEM
// ══════════════════════════════════════════

function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') showWelcomeNotification();
    });
  }
}

function showWelcomeNotification() {
  new Notification('Task Hub Notifications Enabled! 🎉', {
    body: 'You will now receive reminders for upcoming tasks.',
    icon: '📋',
    tag: 'welcome'
  });
}

function checkAndNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  loadNotifiedTasks();
  const todayStr = today.toISOString().split('T')[0];
  if (notifiedTasks.date !== todayStr) {
    notifiedTasks = { date: todayStr, tasks: {} };
    persistNotifiedTasks();
  }

  const currentTime = now.getTime();

  tasks.forEach(task => {
    if (task.status === 'done') return;

    if (task.date) {
      const dueDate = new Date(task.date + 'T00:00:00');
      dueDate.setHours(0, 0, 0, 0);
      const notifyKey = `due-${task.id}-${dueDate.getTime()}`;

      if (dueDate.getTime() === today.getTime()) {
        const lastNotified = notifiedTasks.tasks[notifyKey] || 0;
        if (currentTime - lastNotified >= 4 * 60 * 60 * 1000) {
          showTaskNotification('📅 Due Today!', `${task.name} is due today`, task, 'due-today');
          notifiedTasks.tasks[notifyKey] = currentTime;
        }
      } else if (dueDate.getTime() === tomorrow.getTime()) {
        const lastNotified = notifiedTasks.tasks[notifyKey + '-tomorrow'] || 0;
        if (currentTime - lastNotified >= 8 * 60 * 60 * 1000) {
          showTaskNotification('⚠️ Due Tomorrow!', `${task.name} is due tomorrow`, task, 'due-tomorrow');
          notifiedTasks.tasks[notifyKey + '-tomorrow'] = currentTime;
        }
      }
    }

    if (task.targetDate) {
      const doDate = new Date(task.targetDate + 'T00:00:00');
      doDate.setHours(0, 0, 0, 0);
      const notifyKey = `do-${task.id}-${doDate.getTime()}`;

      if (doDate.getTime() === today.getTime()) {
        const lastNotified = notifiedTasks.tasks[notifyKey] || 0;
        if (currentTime - lastNotified >= 4 * 60 * 60 * 1000) {
          showTaskNotification('🎯 Do Today!', `Time to work on: ${task.name}`, task, 'do-today');
          notifiedTasks.tasks[notifyKey] = currentTime;
        }
      } else if (doDate.getTime() === tomorrow.getTime()) {
        const lastNotified = notifiedTasks.tasks[notifyKey + '-tomorrow'] || 0;
        if (currentTime - lastNotified >= 8 * 60 * 60 * 1000) {
          showTaskNotification('📌 Do Tomorrow!', `Prepare for: ${task.name}`, task, 'do-tomorrow');
          notifiedTasks.tasks[notifyKey + '-tomorrow'] = currentTime;
        }
      }
    }
  });

  persistNotifiedTasks();
}

function showTaskNotification(title, body, task, tag) {
  const notification = new Notification(title, {
    body, icon: '📋', tag: tag + '-' + task.id, requireInteraction: false, silent: false
  });
  notification.onclick = function() { window.focus(); notification.close(); openModal(task.id); };
}

function loadNotifiedTasks() {
  try {
    const stored = localStorage.getItem(NOTIFIED_KEY);
    notifiedTasks = stored ? JSON.parse(stored) : { date: new Date().toISOString().split('T')[0], tasks: {} };
  } catch (e) {
    notifiedTasks = { date: new Date().toISOString().split('T')[0], tasks: {} };
  }
}

function persistNotifiedTasks() {
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notifiedTasks)); } catch (e) {}
}


// ══════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════

function loadTasks() {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) tasks = JSON.parse(s); } catch (e) { tasks = []; }
  try { const s = localStorage.getItem(HIDDEN_CARDS_KEY); if (s) hiddenCards = new Set(JSON.parse(s)); } catch (e) { hiddenCards = new Set(); }
  try { const s = localStorage.getItem(ARCHIVE_KEY); if (s) archivedTasks = JSON.parse(s); } catch (e) { archivedTasks = []; }
  try {
    const s = localStorage.getItem(THEME_KEY);
    if (s) { isDarkMode = s === 'dark'; if (isDarkMode) { document.body.classList.add('dark-mode'); updateThemeIcon(); } }
  } catch (e) { isDarkMode = false; }
  renderAll();
}

function persistTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch (e) {}
  renderAll();
  checkAndNotify();
}

function persistHidden() {
  try { localStorage.setItem(HIDDEN_CARDS_KEY, JSON.stringify([...hiddenCards])); } catch (e) {}
  applyHiddenCards();
}

function persistArchive() {
  try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archivedTasks)); } catch (e) {}
}

function persistTheme() {
  try { localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light'); } catch (e) {}
}


// ══════════════════════════════════════════
// FULLSCREEN
// ══════════════════════════════════════════

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => console.log('Fullscreen failed:', err));
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
}

function updateFullscreenButton() {
  const btn = document.getElementById('fullscreenBtn');
  if (!btn) return;
  const icon = btn.querySelector('svg');
  if (document.fullscreenElement) {
    icon.innerHTML = `<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>`;
    btn.title = 'Exit Fullscreen';
  } else {
    icon.innerHTML = `<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>`;
    btn.title = 'Enter Fullscreen';
  }
}

document.addEventListener('fullscreenchange', updateFullscreenButton);


// ══════════════════════════════════════════
// THEME
// ══════════════════════════════════════════

function toggleTheme() {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle('dark-mode', isDarkMode);
  updateThemeIcon();
  persistTheme();
}

function updateThemeIcon() {
  const lightIcon = document.querySelector('.theme-icon-light');
  const darkIcon  = document.querySelector('.theme-icon-dark');
  if (isDarkMode) { lightIcon.style.display = 'none'; darkIcon.style.display = 'block'; }
  else            { lightIcon.style.display = 'block'; darkIcon.style.display = 'none'; }
}

function refreshPage() { location.reload(); }


// ══════════════════════════════════════════
// STAT CARD FILTERS
// ══════════════════════════════════════════

function setStatFilter(filter) {
  if (filter === 'progress') {
    if (activeStatFilter === 'progress') {
      const modes = ['done', 'todo', 'inprog', 'overdue'];
      progressCycleMode = modes[(modes.indexOf(progressCycleMode) + 1) % modes.length];
    } else {
      activeStatFilter = 'progress';
      progressCycleMode = 'done';
    }
  } else {
    activeStatFilter = (activeStatFilter === filter) ? null : filter;
  }
  updateStatCardVisuals();
  renderTasks();
}

function updateStatCardVisuals() {
  ['total','todo','inprog','done','overdue','progress'].forEach(id => {
    const card = document.getElementById('card-' + id);
    if (card) card.classList.toggle('active-filter', activeStatFilter === id);
  });
  updateProgressCard();
}


// ══════════════════════════════════════════
// PROGRESS CARD
// ══════════════════════════════════════════

function updateProgressCard() {
  const periodTasks = tasks.filter(taskInPeriod);
  const total = periodTasks.length;

  if (total === 0) {
    document.getElementById('progressPercent').textContent = '0%';
    document.getElementById('progressLabel').textContent = 'No Tasks';
    updateProgressCircle(0, 0, 0, 0);
    return;
  }

  const doneCount    = periodTasks.filter(t => t.status === 'done').length;
  const todoCount    = periodTasks.filter(t => t.status === 'todo').length;
  const inprogCount  = periodTasks.filter(t => t.status === 'inprog').length;
  const overdueCount = periodTasks.filter(isOverdue).length;

  const donePercent    = Math.round((doneCount    / total) * 100);
  const todoPercent    = Math.round((todoCount    / total) * 100);
  const inprogPercent  = Math.round((inprogCount  / total) * 100);
  const overduePercent = Math.round((overdueCount / total) * 100);

  updateProgressCircle(donePercent, inprogPercent, todoPercent, overduePercent);

  const percentEl = document.getElementById('progressPercent');
  const labelEl   = document.getElementById('progressLabel');

  if (progressCycleMode === 'done')    { percentEl.textContent = donePercent + '%';    percentEl.style.color = 'var(--green)';  labelEl.textContent = 'completed'; }
  else if (progressCycleMode === 'todo')   { percentEl.textContent = todoPercent + '%';    percentEl.style.color = 'var(--slate)';  labelEl.textContent = 'to do'; }
  else if (progressCycleMode === 'inprog') { percentEl.textContent = inprogPercent + '%';  percentEl.style.color = 'var(--amber)';  labelEl.textContent = 'in progress'; }
  else if (progressCycleMode === 'overdue'){ percentEl.textContent = overduePercent + '%'; percentEl.style.color = 'var(--red)';    labelEl.textContent = 'overdue'; }
}

function updateProgressCircle(donePercent, inprogPercent, todoPercent, overduePercent) {
  const svg = document.getElementById('progressCircle');
  if (!svg) return;
  const radius = 45, centerX = 50, centerY = 50;
  svg.innerHTML = '';

  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('cx', centerX); bgCircle.setAttribute('cy', centerY);
  bgCircle.setAttribute('r', radius); bgCircle.setAttribute('fill', 'none');
  bgCircle.setAttribute('stroke', 'var(--surface2)'); bgCircle.setAttribute('stroke-width', '8');
  svg.appendChild(bgCircle);

  let currentPercent = 0;
  [
    [donePercent,    'var(--green)'],
    [inprogPercent,  'var(--amber)'],
    [todoPercent,    'var(--slate)'],
    [overduePercent, 'var(--red)'],
  ].forEach(([pct, color]) => {
    if (pct > 0) {
      const path = createSegmentPath(currentPercent, pct, radius, centerX, centerY);
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '8');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('fill', 'none');
      svg.appendChild(path);
      currentPercent += pct;
    }
  });
}

function createSegmentPath(startPercent, segmentPercent, radius, centerX, centerY) {
  const startAngle = (startPercent / 100) * 360 - 90;
  const endAngle   = ((startPercent + segmentPercent) / 100) * 360 - 90;
  const startRad   = (startAngle * Math.PI) / 180;
  const endRad     = (endAngle   * Math.PI) / 180;
  const x1 = centerX + radius * Math.cos(startRad);
  const y1 = centerY + radius * Math.sin(startRad);
  const x2 = centerX + radius * Math.cos(endRad);
  const y2 = centerY + radius * Math.sin(endRad);
  const largeArc = segmentPercent > 50 ? 1 : 0;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`);
  return path;
}


// ══════════════════════════════════════════
// EXPORT / IMPORT
// ══════════════════════════════════════════

function openDataModal()  { document.getElementById('dataOverlay').classList.add('open'); }
function closeDataModal() { document.getElementById('dataOverlay').classList.remove('open'); }
function handleDataOverlayClick(e) { if (e.target === document.getElementById('dataOverlay')) closeDataModal(); }

function exportTasks() {
  const data = { tasks, archivedTasks, exportDate: new Date().toISOString(), version: 'v2' };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `taskhub-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  closeDataModal();

  showConfirmSuccess('Export Successful! ✓', 'Your tasks have been exported successfully.');
}

function importTasks() { document.getElementById('importFile').click(); }

function importTasksFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.tasks) throw new Error('Invalid file format');

      document.getElementById('confirmModalTitle').textContent = 'Import Tasks?';
      document.getElementById('confirmModalMessage').textContent = `This will import ${data.tasks.length} task${data.tasks.length !== 1 ? 's' : ''} and replace your current tasks. Are you sure?`;
      document.getElementById('confirmModalIcon').innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

      const confirmBtn = document.getElementById('confirmModalBtn');
      confirmBtn.textContent = 'Import Tasks';
      confirmBtn.className = 'confirm-btn archive-btn';
      confirmBtn.onclick = () => {
        tasks = data.tasks || [];
        archivedTasks = data.archivedTasks || [];
        persistTasks(); persistArchive(); closeDataModal(); closeConfirmModal();
        setTimeout(() => showConfirmSuccess('Import Successful! ✓', `${data.tasks.length} task${data.tasks.length !== 1 ? 's' : ''} imported!`), 300);
      };

      document.getElementById('confirmCancelBtn').style.display = 'flex';
      document.getElementById('confirmOverlay').classList.add('open');
    } catch (error) {
      document.getElementById('confirmModalTitle').textContent = 'Import Error';
      document.getElementById('confirmModalMessage').textContent = `Failed to import: ${error.message}`;
      document.getElementById('confirmModalIcon').innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
      const confirmBtn = document.getElementById('confirmModalBtn');
      confirmBtn.textContent = 'OK'; confirmBtn.className = 'confirm-btn delete-btn'; confirmBtn.onclick = closeConfirmModal;
      document.getElementById('confirmCancelBtn').style.display = 'none';
      document.getElementById('confirmOverlay').classList.add('open');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function showConfirmSuccess(title, message) {
  document.getElementById('confirmModalTitle').textContent = title;
  document.getElementById('confirmModalMessage').textContent = message;
  document.getElementById('confirmModalIcon').innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
  const confirmBtn = document.getElementById('confirmModalBtn');
  confirmBtn.textContent = 'OK'; confirmBtn.className = 'confirm-btn archive-btn'; confirmBtn.onclick = closeConfirmModal;
  document.getElementById('confirmCancelBtn').style.display = 'none';
  document.getElementById('confirmOverlay').classList.add('open');
}


// ══════════════════════════════════════════
// ARCHIVE
// ══════════════════════════════════════════

function openArchive()  { renderArchive(); document.getElementById('archiveOverlay').classList.add('open'); }
function closeArchive() { document.getElementById('archiveOverlay').classList.remove('open'); }
function handleArchiveOverlayClick(e) { if (e.target === document.getElementById('archiveOverlay')) closeArchive(); }

function renderArchive() {
  const el = document.getElementById('archiveContent');
  if (!archivedTasks.length) {
    el.innerHTML = `<div class="empty-state"><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg><h3>No archived tasks</h3><p>Deleted tasks will appear here.</p></div>`;
    return;
  }
  el.innerHTML = archivedTasks.map(task => `
    <div class="archive-task-card">
      <div class="archive-task-info">
        <div class="archive-task-name">${esc(task.name)}</div>
        <div class="archive-task-meta">
          <span class="badge cat-${task.category}">${CAT_LABELS[task.category]}</span>
          ${task.date ? `<span class="archive-meta-text">Due: ${formatDue(task.date, task.time)}</span>` : ''}
        </div>
      </div>
      <div class="archive-task-actions">
        <button class="btn-restore" onclick="restoreTask('${task.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg> Restore</button>
        <button class="btn-delete-permanent" onclick="deletePermanent('${task.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
      </div>
    </div>`).join('');
}

function restoreTask(id) {
  const idx = archivedTasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  tasks.push(archivedTasks[idx]);
  archivedTasks.splice(idx, 1);
  persistTasks(); persistArchive(); renderArchive();
}

function deletePermanent(id) {
  const task = archivedTasks.find(t => t.id === id);
  if (!task) return;
  document.getElementById('confirmModalTitle').textContent = 'Delete Permanently?';
  document.getElementById('confirmModalMessage').textContent = `Permanently delete "${task.name}"? This cannot be undone.`;
  document.getElementById('confirmModalIcon').innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  const confirmBtn = document.getElementById('confirmModalBtn');
  confirmBtn.textContent = 'Delete Permanently'; confirmBtn.className = 'confirm-btn delete-btn';
  confirmBtn.onclick = () => { archivedTasks = archivedTasks.filter(t => t.id !== id); persistArchive(); renderArchive(); closeConfirmModal(); };
  document.getElementById('confirmOverlay').classList.add('open');
}


// ══════════════════════════════════════════
// PERIOD FILTER
// ══════════════════════════════════════════

function getPeriodRange(period) {
  const now   = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end   = new Date(now); end.setHours(23, 59, 59, 999);

  if (period === 'day')      return { start, end, label: 'Today' };
  if (period === 'tomorrow') {
    start.setDate(start.getDate() + 1); end.setDate(end.getDate() + 1);
    return { start, end, label: start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) };
  }
  if (period === 'week') {
    start.setDate(start.getDate() - start.getDay());
    end.setDate(end.getDate() + (6 - new Date().getDay())); end.setHours(23, 59, 59, 999);
    return { start, end, label: formatShort(start) + ' – ' + formatShort(end) };
  }
  if (period === 'month') {
    start.setDate(1); end.setMonth(end.getMonth() + 1, 0); end.setHours(23, 59, 59, 999);
    return { start, end, label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
  }
  if (period === 'twomonths') {
    start.setDate(1); end.setMonth(end.getMonth() + 2, 0); end.setHours(23, 59, 59, 999);
    const cur  = now.toLocaleDateString('en-US', { month: 'short' });
    const next = new Date(now); next.setMonth(next.getMonth() + 1);
    return { start, end, label: cur + ' – ' + next.toLocaleDateString('en-US', { month: 'short' }) + ' ' + now.getFullYear() };
  }
  return { start: null, end: null, label: 'All time' };
}

function taskInPeriod(task) {
  if (activePeriod === 'all') return true;
  if (!task.date) return false;
  const { start, end } = getPeriodRange(activePeriod);
  const due = new Date(task.date + 'T' + (task.time || '00:00'));
  return due >= start && due <= end;
}

function setPeriod(period) {
  activePeriod = period;
  document.querySelectorAll('.period-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.period === period));
  document.getElementById('periodToggleLabel').textContent = getPeriodRange(period).label;
  renderAll();
}


// ══════════════════════════════════════════
// HIDE / RESTORE STAT CARDS
// ══════════════════════════════════════════

function hideCard(id, event) {
  if (event) event.stopPropagation();
  hiddenCards.add(id); persistHidden();
}

function restoreAllCards() { hiddenCards.clear(); persistHidden(); }

function applyHiddenCards() {
  ['total','todo','inprog','done','overdue','progress'].forEach(id => {
    const el = document.getElementById('card-' + id);
    if (el) el.classList.toggle('hidden', hiddenCards.has(id));
  });
  document.getElementById('restoreBtn').classList.toggle('visible', hiddenCards.size > 0);
  updateStatCardVisuals();
}


// ══════════════════════════════════════════
// FILTER TOGGLE (ALL SCREEN SIZES)
// ══════════════════════════════════════════

function toggleFilters() {
  const filtersSection = document.getElementById('filtersSection');
  const toggleBtn      = document.getElementById('filterToggle');
  filtersSection.classList.toggle('open');
  toggleBtn.classList.toggle('active');
}


// ══════════════════════════════════════════
// PERIOD TOGGLE
// ══════════════════════════════════════════

function togglePeriod() {
  const periodContainer = document.getElementById('periodContainer');
  const toggleBtn       = document.getElementById('periodToggle');
  const isVisible       = periodContainer.style.display !== 'none';
  periodContainer.style.display = isVisible ? 'none' : 'flex';
  toggleBtn.classList.toggle('expanded', !isVisible);
  toggleBtn.querySelectorAll('.toggle-arrow').forEach(a => a.textContent = isVisible ? '▼' : '▲');
}


// ══════════════════════════════════════════
// SORT MODE
// ══════════════════════════════════════════

function setSortMode(mode) {
  activeSortMode = mode;
  document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.sort === mode));
  renderTasks();
}


// ══════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════

function renderAll() {
  const periodTasks = tasks.filter(taskInPeriod);
  renderStats(periodTasks);
  renderTasks();
  applyHiddenCards();
  document.getElementById('periodToggleLabel').textContent = getPeriodRange(activePeriod).label;
  document.getElementById('summaryMeta').textContent = periodTasks.length + ' task' + (periodTasks.length !== 1 ? 's' : '') + ' in this period';
}

function renderStats(periodTasks) {
  document.getElementById('statTotal').textContent   = periodTasks.length;
  document.getElementById('statTodo').textContent    = periodTasks.filter(t => t.status === 'todo').length;
  document.getElementById('statInprog').textContent  = periodTasks.filter(t => t.status === 'inprog').length;
  document.getElementById('statDone').textContent    = periodTasks.filter(t => t.status === 'done').length;
  document.getElementById('statOverdue').textContent = periodTasks.filter(isOverdue).length;
  updateProgressCard();
}

function renderTasks() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const fCat   = document.getElementById('filterCat').value;
  const fSt    = document.getElementById('filterStatus').value;

  let list = tasks.filter(task => {
    if (!taskInPeriod(task))                          return false;
    if (fCat && task.category !== fCat)               return false;
    if (fSt  && task.status   !== fSt)                return false;
    if (search && !task.name.toLowerCase().includes(search) && !(task.notes || '').toLowerCase().includes(search)) return false;
    return true;
  });

  // Apply stat card filter
  if (activeStatFilter) {
    if      (activeStatFilter === 'todo')    list = list.filter(t => t.status === 'todo');
    else if (activeStatFilter === 'inprog')  list = list.filter(t => t.status === 'inprog');
    else if (activeStatFilter === 'done')    list = list.filter(t => t.status === 'done');
    else if (activeStatFilter === 'overdue') list = list.filter(isOverdue);
    else if (activeStatFilter === 'progress') {
      if      (progressCycleMode === 'done')    list = list.filter(t => t.status === 'done');
      else if (progressCycleMode === 'todo')    list = list.filter(t => t.status === 'todo');
      else if (progressCycleMode === 'inprog')  list = list.filter(t => t.status === 'inprog');
      else if (progressCycleMode === 'overdue') list = list.filter(isOverdue);
    }
  }

  const doneTasks    = list.filter(t => t.status === 'done');
  const notDoneTasks = list.filter(t => t.status !== 'done');

  if (activeSortMode === 'due') {
    notDoneTasks.sort((a, b) => {
      const da = a.date ? new Date(a.date + 'T' + (a.time || '23:59')) : new Date('9999');
      const db = b.date ? new Date(b.date + 'T' + (b.time || '23:59')) : new Date('9999');
      return da - db;
    });
  } else {
    notDoneTasks.sort((a, b) => {
      const ta = a.targetDate ? new Date(a.targetDate + 'T' + (a.targetTime || '23:59')) : new Date('9999');
      const tb = b.targetDate ? new Date(b.targetDate + 'T' + (b.targetTime || '23:59')) : new Date('9999');
      return ta - tb;
    });
  }

  doneTasks.sort((a, b) => (a.created || 0) - (b.created || 0));
  list = [...notDoneTasks, ...doneTasks];

  const el = document.getElementById('taskList');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6M12 9v6"/></svg><h3>${tasks.length ? 'No tasks match these filters' : 'Nothing here yet'}</h3><p>${tasks.length ? 'Try adjusting your filters or time range.' : 'Click "+ Add Task" to get started.'}</p></div>`;
    return;
  }
  el.innerHTML = list.map(buildTaskCardHTML).join('');
}


// ══════════════════════════════════════════
// TASK CARD HTML
// ══════════════════════════════════════════

function buildTaskCardHTML(task) {
  const over    = isOverdue(task);
  const dueTxt  = formatDue(task.date, task.time);
  const stLabel = { todo: 'To Do', inprog: 'In Progress', done: 'Done' }[task.status];
  const doTxt   = formatDue(task.targetDate, task.targetTime);
  const showDo  = doTxt && doTxt !== dueTxt;
  const doOverdue = task.targetDate && task.status !== 'done'
    ? new Date(task.targetDate + 'T' + (task.targetTime || '23:59')) < new Date() : false;

  const dueMeta = dueTxt ? `
    <span class="meta-item" style="${over ? 'color:var(--red)' : ''}">
      ${over ? '<span class="overdue-dot"></span>' : ''}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      Due: ${esc(dueTxt)}${over ? ' — Overdue' : ''}
    </span>` : '';

  const doMeta = showDo ? `
    <span class="meta-item" style="${doOverdue ? 'color:var(--red)' : ''}">
      ${doOverdue ? '<span class="overdue-dot"></span>' : ''}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>
      Do: ${esc(doTxt)}${doOverdue ? ' — Overdue' : ''}
    </span>` : '';

  const noteHTML = task.notes ? `<div class="task-notes">${esc(task.notes)}</div>` : '';

  return `
  <div class="task-card ${task.status === 'done' ? 'done-card' : ''}" data-task-id="${task.id}">
    <div class="status-col">
      <div class="status-dot ${task.status}" title="Click to cycle status" onclick="cycleStatus('${task.id}')"></div>
    </div>
    <div class="task-body">
      <div class="task-top">
        <span class="task-name">${esc(task.name)}</span>
        <span class="badge cat-${task.category}">${CAT_LABELS[task.category]}</span>
      </div>
      <div class="task-meta">${dueMeta}${doMeta}</div>
      ${noteHTML}
    </div>
    <div class="task-actions">
      <button class="qs-btn qs-todo   ${task.status === 'todo'   ? 'active' : ''}" onclick="setStatus('${task.id}', 'todo')"   title="Set To Do">Todo</button>
      <button class="qs-btn qs-inprog ${task.status === 'inprog' ? 'active' : ''}" onclick="setStatus('${task.id}', 'inprog')" title="Set In Progress">In Progress</button>
      <button class="qs-btn qs-done   ${task.status === 'done'   ? 'active' : ''}" onclick="setStatus('${task.id}', 'done')"   title="Set Done">Done</button>
      <button class="qs-btn-mobile qs-${task.status}" onclick="cycleStatus('${task.id}')" title="Change status">${stLabel}</button>
      <div class="action-divider"></div>
      <button class="icon-btn" title="Edit task" onclick="openModal('${task.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="icon-btn del" title="Delete task" onclick="deleteTask('${task.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  </div>`;
}


// ══════════════════════════════════════════
// TASK ACTIONS
// ══════════════════════════════════════════

function setStatus(id, status) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (status === 'done' && task.status !== 'done') {
    playCompletionAnimation(id, () => { task.status = status; persistTasks(); });
  } else {
    task.status = status; persistTasks();
  }
}

function playCompletionAnimation(taskId, callback) {
  const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
  if (!taskCard) { callback(); return; }
  taskCard.classList.add('task-completing');
  const checkmark = document.createElement('div');
  checkmark.className = 'completion-checkmark';
  checkmark.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
  taskCard.appendChild(checkmark);
  const colors = ['var(--green)', 'var(--amber)', 'var(--accent)', 'var(--red)'];
  for (let i = 0; i < 8; i++) {
    const c = document.createElement('div');
    c.className = 'confetti-particle';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.left = `${50 + (Math.random() - 0.5) * 60}%`;
    c.style.top = '50%';
    c.style.animationDelay = `${Math.random() * 0.1}s`;
    taskCard.appendChild(c);
  }
  setTimeout(() => {
    checkmark.remove();
    document.querySelectorAll('.confetti-particle').forEach(p => p.remove());
    taskCard.classList.remove('task-completing');
    callback();
  }, 600);
}

function cycleStatus(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const newStatus = { todo: 'inprog', inprog: 'done', done: 'todo' }[task.status];
  if (newStatus === 'done' && task.status !== 'done') {
    playCompletionAnimation(id, () => { task.status = newStatus; persistTasks(); });
  } else {
    task.status = newStatus; persistTasks();
  }
}

function deleteTask(id) { openDeleteConfirmModal(id); }

function openDeleteConfirmModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  document.getElementById('confirmModalTitle').textContent = 'Move to Archive?';
  document.getElementById('confirmModalMessage').textContent = `Archive "${task.name}"? You can restore it later.`;
  document.getElementById('confirmModalIcon').innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`;
  const confirmBtn = document.getElementById('confirmModalBtn');
  confirmBtn.textContent = 'Move to Archive'; confirmBtn.className = 'confirm-btn archive-btn';
  confirmBtn.onclick = () => {
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    archivedTasks.push(tasks[idx]); tasks.splice(idx, 1);
    persistTasks(); persistArchive(); closeConfirmModal();
  };
  document.getElementById('confirmOverlay').classList.add('open');
}

function closeConfirmModal() {
  document.getElementById('confirmOverlay').classList.remove('open');
  document.getElementById('confirmCancelBtn').style.display = 'flex';
}

function handleConfirmOverlayClick(e) { if (e.target === document.getElementById('confirmOverlay')) closeConfirmModal(); }


// ══════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════

function openModal(id) {
  editId = id || null;
  document.getElementById('modalTitle').textContent = editId ? 'Edit Task' : 'Add Task';
  if (editId) {
    const task = tasks.find(t => t.id === editId);
    document.getElementById('fName').value       = task.name;
    document.getElementById('fCat').value        = task.category;
    document.getElementById('fDate').value       = task.date        || '';
    document.getElementById('fTime').value       = task.time        || '';
    document.getElementById('fTargetDate').value = task.targetDate  || '';
    document.getElementById('fTargetTime').value = task.targetTime  || '';
    document.getElementById('fStatus').value     = task.status;
    document.getElementById('fNotes').value      = task.notes       || '';
  } else {
    ['fName','fDate','fTime','fTargetDate','fTargetTime','fNotes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('fCat').value    = 'quiz';
    document.getElementById('fStatus').value = 'todo';
  }
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('fName').focus(), 120);
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); editId = null; }
function handleOverlayClick(e) { if (e.target === document.getElementById('modalOverlay')) closeModal(); }

function saveTask() {
  const nameInput = document.getElementById('fName');
  const name = nameInput.value.trim();
  if (!name) { nameInput.style.borderColor = 'var(--red)'; nameInput.focus(); return; }
  nameInput.style.borderColor = '';

  const data = {
    name,
    category:   document.getElementById('fCat').value,
    date:       document.getElementById('fDate').value,
    time:       document.getElementById('fTime').value,
    targetDate: document.getElementById('fTargetDate').value,
    targetTime: document.getElementById('fTargetTime').value,
    status:     document.getElementById('fStatus').value,
    notes:      document.getElementById('fNotes').value.trim(),
  };

  if (editId) {
    const idx = tasks.findIndex(t => t.id === editId);
    tasks[idx] = { ...tasks[idx], ...data };
  } else {
    tasks.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created: Date.now(), ...data });
  }
  closeModal(); persistTasks();
}


// ══════════════════════════════════════════
// UTILITY
// ══════════════════════════════════════════

function isOverdue(task) {
  if (!task.date || task.status === 'done') return false;
  return new Date(task.date + 'T' + (task.time || '23:59')) < new Date();
}

function formatDue(date, time) {
  if (!date) return null;
  const label = new Date(date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (!time) return label;
  const [h, m] = time.split(':');
  const hr = +h; const ampm = hr >= 12 ? 'PM' : 'AM';
  return label + ' at ' + ((hr % 12) || 12) + ':' + m + ' ' + ampm;
}

function formatShort(date) { return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setDateLabel() {
  document.getElementById('dateLabelInline').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}


// ══════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveTask();
});


// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════

setDateLabel();
loadTasks();
requestNotificationPermission();
checkAndNotify();
setInterval(checkAndNotify, 60 * 60 * 1000);

if (isMobileDevice()) {
  setTimeout(() => { document.documentElement.requestFullscreen().catch(() => {}); }, 500);
}

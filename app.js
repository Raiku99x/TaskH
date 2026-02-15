/* ══════════════════════════════════════════
   TASK HUB — app.js
   ══════════════════════════════════════════ */

// ── CONSTANTS & STATE ─────────────────────────────────────────
const STORAGE_KEY      = 'taskhub-v2-tasks';
const HIDDEN_CARDS_KEY = 'taskhub-v2-hidden';

let tasks        = [];
let editId       = null;
let activePeriod = 'month';
let hiddenCards  = new Set();
let defaultSort  = 'do';  // Do Date is the default sort
let isFullscreen = false;

const CAT_LABELS = {
  quiz:       'Quiz',
  project:    'Project',
  assignment: 'Assignment',
  review:     'Review',
  output:     'Output',
  online:     'Online Appt.',
  facetoface: 'Face-to-face',
  other:      'Other',
};

const PRI_ORDER    = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER = { todo: 0, inprog: 1, done: 2 };


// ══════════════════════════════════════════
// STORAGE (using localStorage)
// ══════════════════════════════════════════

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) tasks = JSON.parse(stored);
  } catch (e) {
    tasks = [];
  }

  try {
    const storedHidden = localStorage.getItem(HIDDEN_CARDS_KEY);
    if (storedHidden) hiddenCards = new Set(JSON.parse(storedHidden));
  } catch (e) {
    hiddenCards = new Set();
  }

  renderAll();
}

function persistTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) { 
    console.error('Failed to save tasks:', e);
  }
  renderAll();
}

function persistHidden() {
  try {
    localStorage.setItem(HIDDEN_CARDS_KEY, JSON.stringify([...hiddenCards]));
  } catch (e) { 
    console.error('Failed to save hidden cards:', e);
  }
  applyHiddenCards();
}


// ══════════════════════════════════════════
// FULLSCREEN FUNCTIONALITY
// ══════════════════════════════════════════

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
    || window.innerWidth <= 768;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.log('Fullscreen request failed:', err);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

function updateFullscreenButton() {
  const btn = document.getElementById('fullscreenBtn');
  if (!btn) return;
  
  const icon = btn.querySelector('svg');
  if (document.fullscreenElement) {
    // Show exit fullscreen icon
    icon.innerHTML = `<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>`;
    btn.title = 'Exit Fullscreen';
  } else {
    // Show enter fullscreen icon
    icon.innerHTML = `<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>`;
    btn.title = 'Enter Fullscreen';
  }
}

// Listen for fullscreen changes
document.addEventListener('fullscreenchange', updateFullscreenButton);


// ══════════════════════════════════════════
// PERIOD FILTER
// ══════════════════════════════════════════

function getPeriodRange(period) {
  const now   = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === 'day') {
    return { start, end, label: 'Today' };
  }

  if (period === 'tomorrow') {
    start.setDate(start.getDate() + 1);
    end.setDate(end.getDate() + 1);
    return {
      start,
      end,
      label: start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
    };
  }

  if (period === 'week') {
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);
    end.setDate(end.getDate() + (6 - new Date().getDay()));
    end.setHours(23, 59, 59, 999);
    return {
      start,
      end,
      label: formatShort(start) + ' – ' + formatShort(end),
    };
  }

  if (period === 'month') {
    start.setDate(1);
    end.setMonth(end.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return {
      start,
      end,
      label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };
  }

  // all time
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

  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === period);
  });

  const { label } = getPeriodRange(period);
  document.getElementById('periodNote').textContent = label;

  renderAll();
}


// ══════════════════════════════════════════
// HIDE / RESTORE STAT CARDS
// ══════════════════════════════════════════

function hideCard(id) {
  hiddenCards.add(id);
  persistHidden();
}

function restoreAllCards() {
  hiddenCards.clear();
  persistHidden();
}

function applyHiddenCards() {
  const ids = ['total', 'todo', 'inprog', 'done', 'overdue'];

  ids.forEach(id => {
    const el = document.getElementById('card-' + id);
    if (el) el.classList.toggle('hidden', hiddenCards.has(id));
  });

  const restoreBtn = document.getElementById('restoreBtn');
  restoreBtn.classList.toggle('visible', hiddenCards.size > 0);
}


// ══════════════════════════════════════════
// FILTER TOGGLE (MOBILE)
// ══════════════════════════════════════════

function toggleFilters() {
  const filtersSection = document.getElementById('filtersSection');
  const toggleBtn = document.getElementById('filterToggle');
  filtersSection.classList.toggle('open');
  toggleBtn.classList.toggle('active');
}


// ══════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════

function renderAll() {
  const periodTasks = tasks.filter(taskInPeriod);
  renderStats(periodTasks);
  renderTasks();
  applyHiddenCards();

  const { label } = getPeriodRange(activePeriod);
  document.getElementById('periodNote').textContent = label;
  document.getElementById('summaryMeta').textContent =
    periodTasks.length + ' task' + (periodTasks.length !== 1 ? 's' : '') + ' in this period';
}

function renderStats(periodTasks) {
  document.getElementById('statTotal').textContent   = periodTasks.length;
  document.getElementById('statTodo').textContent    = periodTasks.filter(t => t.status === 'todo').length;
  document.getElementById('statInprog').textContent  = periodTasks.filter(t => t.status === 'inprog').length;
  document.getElementById('statDone').textContent    = periodTasks.filter(t => t.status === 'done').length;
  document.getElementById('statOverdue').textContent = periodTasks.filter(isOverdue).length;
}

function renderTasks() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const fCat   = document.getElementById('filterCat').value;
  const fSt    = document.getElementById('filterStatus').value;
  const sort   = document.getElementById('sortBy').value;

  let list = tasks.filter(task => {
    if (!taskInPeriod(task))                          return false;
    if (fCat && task.category !== fCat)               return false;
    if (fSt  && task.status   !== fSt)                return false;
    if (search &&
        !task.name.toLowerCase().includes(search) &&
        !(task.notes || '').toLowerCase().includes(search)) return false;
    return true;
  });

  list.sort((a, b) => {
    if (sort === 'due') {
      const da = a.date ? new Date(a.date + 'T' + (a.time || '23:59')) : new Date('9999');
      const db = b.date ? new Date(b.date + 'T' + (b.time || '23:59')) : new Date('9999');
      return da - db;
    }
    if (sort === 'do') {
      const ta = a.targetDate ? new Date(a.targetDate + 'T' + (a.targetTime || '23:59')) : new Date('9999');
      const tb = b.targetDate ? new Date(b.targetDate + 'T' + (b.targetTime || '23:59')) : new Date('9999');
      return ta - tb;
    }
    if (sort === 'status')   return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    return b.created - a.created;
  });

  const el = document.getElementById('taskList');

  if (!list.length) {
    el.innerHTML = `
      <div class="empty-state">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <path d="M9 12h6M12 9v6"/>
        </svg>
        <h3>${tasks.length ? 'No tasks in this period' : 'Nothing here yet'}</h3>
        <p>${tasks.length
          ? 'Try a different time range or clear your filters.'
          : 'Click "+ Add Task" to get started.'}</p>
      </div>`;
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

  // Do Date: show only if different from due date
  const doTxt      = formatDue(task.targetDate, task.targetTime);
  const showDo     = doTxt && doTxt !== dueTxt;
  const doOverdue  = task.targetDate && task.status !== 'done'
    ? new Date(task.targetDate + 'T' + (task.targetTime || '23:59')) < new Date()
    : false;

  const dueMeta = dueTxt ? `
    <span class="meta-item" style="${over ? 'color:var(--red)' : ''}">
      ${over ? '<span class="overdue-dot"></span>' : ''}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8"  y1="2" x2="8"  y2="6"/>
        <line x1="3"  y1="10" x2="21" y2="10"/>
      </svg>
      Due: ${esc(dueTxt)}${over ? ' &mdash; Overdue' : ''}
    </span>` : '';

  const doMeta = showDo ? `
    <span class="meta-item" style="${doOverdue ? 'color:var(--red)' : ''}">
      ${doOverdue ? '<span class="overdue-dot"></span>' : ''}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="4"/>
        <line x1="12" y1="2"  x2="12" y2="5"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
        <line x1="2"  y1="12" x2="5"  y2="12"/>
        <line x1="19" y1="12" x2="22" y2="12"/>
      </svg>
      Do: ${esc(doTxt)}${doOverdue ? ' &mdash; Overdue' : ''}
    </span>` : '';

  const noteHTML = task.notes
    ? `<div class="task-notes">${esc(task.notes)}</div>`
    : '';

  return `
  <div class="task-card ${task.status === 'done' ? 'done-card' : ''}">

    <div class="status-col">
      <div class="status-dot ${task.status}"
           title="Click to cycle status"
           onclick="cycleStatus('${task.id}')"></div>
    </div>

    <div class="task-body">
      <div class="task-top">
        <span class="task-name">${esc(task.name)}</span>
        <span class="badge cat-${task.category}">${CAT_LABELS[task.category]}</span>
      </div>
      <div class="task-meta">
        ${dueMeta}
        ${doMeta}
      </div>
      ${noteHTML}
    </div>

    <div class="task-actions">
      <button class="qs-btn qs-todo   ${task.status === 'todo'   ? 'active' : ''}"
              onclick="setStatus('${task.id}', 'todo')"
              title="Set To Do">Todo</button>
      <button class="qs-btn qs-inprog ${task.status === 'inprog' ? 'active' : ''}"
              onclick="setStatus('${task.id}', 'inprog')"
              title="Set In Progress">In Progress</button>
      <button class="qs-btn qs-done   ${task.status === 'done'   ? 'active' : ''}"
              onclick="setStatus('${task.id}', 'done')"
              title="Set Done">Done</button>

      <button class="qs-btn-mobile qs-${task.status}"
              onclick="cycleStatus('${task.id}')"
              title="Click to change status">${stLabel}</button>

      <div class="action-divider"></div>

      <button class="icon-btn" title="Edit task" onclick="openModal('${task.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="icon-btn del" title="Delete task" onclick="deleteTask('${task.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
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
  task.status = status;
  persistTasks();
}

function cycleStatus(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const cycle = { todo: 'inprog', inprog: 'done', done: 'todo' };
  task.status = cycle[task.status];
  persistTasks();
}

function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  tasks = tasks.filter(t => t.id !== id);
  persistTasks();
}


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
    ['fName', 'fDate', 'fTime', 'fTargetDate', 'fTargetTime', 'fNotes'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('fCat').value    = 'quiz';
    document.getElementById('fStatus').value = 'todo';
  }

  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('fName').focus(), 120);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editId = null;
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

function saveTask() {
  const nameInput = document.getElementById('fName');
  const name = nameInput.value.trim();

  if (!name) {
    nameInput.style.borderColor = 'var(--red)';
    nameInput.focus();
    return;
  }
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
    tasks.push({
      id:      Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      created: Date.now(),
      ...data,
    });
  }

  closeModal();
  persistTasks();
}


// ══════════════════════════════════════════
// UTILITY HELPERS
// ══════════════════════════════════════════

function isOverdue(task) {
  if (!task.date || task.status === 'done') return false;
  return new Date(task.date + 'T' + (task.time || '23:59')) < new Date();
}

function formatDue(date, time) {
  if (!date) return null;
  const label = new Date(date + 'T00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  if (!time) return label;
  const [h, m] = time.split(':');
  const hr   = +h;
  const ampm = hr >= 12 ? 'PM' : 'AM';
  return label + ' at ' + ((hr % 12) || 12) + ':' + m + ' ' + ampm;
}

function formatShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setDateLabel() {
  const dateText = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  document.getElementById('dateLabel').textContent = dateText;
  document.getElementById('dateLabelMobile').textContent = dateText;
}


// ══════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════

document.addEventListener('keydown', e => {
  if (e.key === 'Escape')                         closeModal();
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveTask();
});


// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════

setDateLabel();
loadTasks();

// Auto-fullscreen on mobile devices
if (isMobileDevice()) {
  setTimeout(() => {
    document.documentElement.requestFullscreen().catch(err => {
      console.log('Auto-fullscreen failed:', err);
    });
  }, 500);
}

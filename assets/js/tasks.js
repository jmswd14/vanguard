// ────────── SUPABASE ──────────
const _sb = window.supabaseClient;
let _uid = null;

// ────────── COLORS ──────────
const TAG_COLORS = [
  '#7B9EC4', // periwinkle blue
  '#B87A8A', // dusty rose
  '#C09A50', // warm amber
  '#5A9B80', // sage green
  '#8C7EC0', // muted lavender
  '#B87856', // terracotta
  '#4E9BAC', // steel teal
  '#A87860', // warm sienna
  '#A89060', // antique gold
  '#628E92', // muted teal
  '#9A5872', // wine / mauve
  '#6A9660', // moss green
];
const LIST_COLORS = ['#7C9EFF','#FF8FAB','#FFD166','#06D6A0','#CB9CF2','#FF9F68','#4DD9F0','#F4A261','#E76F51','#A8DADC'];

// ────────── DATA (in-memory, loaded from Supabase) ──────────
let tasks          = [];
let categories     = []; // DB table still called 'lists'
let tags           = [];
let recurringTasks = [];

// ────────── STATE ──────────
let currentView       = 'all';
let sortBy            = 'default';
let sortDir           = 'asc';
let activeTagFilters  = [];
let showAllCompleted  = false;
let selectedTagColor      = TAG_COLORS[0];
let selectedCategoryColor = LIST_COLORS[0];
let selectedTaskTags  = [];
let dragSrcId         = null;
let dragFromHandle    = false;
let activeMenuId      = null;
let tagFilterDropdownOpen = false;
let taskReminders = []; // [{ id, amount, unit }]

const today    = new Date();
const todayStr = today.toISOString().split('T')[0];

// ────────── UTILS ──────────
function uid() { return crypto.randomUUID(); }

function setPriorityChip(inputId, value) {
  const input = document.getElementById(inputId);
  if (input) input.value = value;
  const picker = document.getElementById(inputId + '-picker');
  if (picker) picker.querySelectorAll('.prio-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.prio === value)
  );
}

function formatDate(ds) {
  if (!ds) return '';
  const d = new Date(ds + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

function isOverdue(ds) { return ds && ds < todayStr; }
function isToday(ds)   { return ds === todayStr; }
function isThisWeek(ds) {
  if (!ds) return false;
  const d = new Date(ds + 'T00:00:00');
  const end = new Date(today); end.setDate(end.getDate() + 7);
  return d >= today && d <= end;
}

function getTag(id)      { return tags.find(t => t.id === id); }
function getCategory(id) { return categories.find(c => c.id === id); }

// ────────── DB TRANSFORM ──────────
function fromDbTask(t) {
  return {
    id:              t.id,
    name:            t.name,
    category:        t.category_id || '',   // DB column renamed from list_id → category_id
    priority:        t.priority || 'medium',
    due:             t.due || '',
    tags:            t.tags || [],
    notes:           t.notes || '',
    done:            t.done || false,
    completedAt:     t.completed_at ? new Date(t.completed_at).getTime() : null,
    order:           t.position || 0,
    recurringTaskId: t.recurring_task_id || null,
    recurringDate:   t.recurring_date || null,
  };
}

// ────────── DATA LOADING ──────────
async function loadAll() {
  const [tr, lr, gr] = await Promise.all([
    _sb.from('tasks').select('*').eq('user_id', _uid).order('position', { ascending: true }),
    _sb.from('lists').select('*').eq('user_id', _uid).order('created_at', { ascending: true }),
    _sb.from('tags').select('*').eq('user_id', _uid).order('created_at',  { ascending: true }),
  ]);

  tasks = (tr.data || []).map(fromDbTask);
  tags  = gr.data || [];

  if (lr.data && lr.data.length) {
    categories = lr.data;
  } else {
    // Seed two default categories for a brand-new user
    const defaults = [
      { id: uid(), user_id: _uid, name: 'Personal', color: '#7C9EFF' },
      { id: uid(), user_id: _uid, name: 'Work',     color: '#06D6A0' },
    ];
    await _sb.from('lists').insert(defaults);
    categories = defaults;
  }

  await loadRecurringTasks();
  await generateRecurringInstances();
}

// ────────── CONTEXT MENUS (unified) ──────────
function openContextMenu(e, dropdownId) {
  e.stopPropagation();
  if (activeMenuId === dropdownId) { closeContextMenu(); return; }
  closeContextMenu();
  activeMenuId = dropdownId;
  document.getElementById(dropdownId)?.classList.add('open');
}

function closeContextMenu() {
  if (activeMenuId) {
    document.getElementById(activeMenuId)?.classList.remove('open');
    activeMenuId = null;
  }
}

function taskMenuDelete(tid, name) {
  closeContextMenu();
  confirmDelete('task', tid, name);
}

function tagMenuDelete(tid, name) {
  closeContextMenu();
  confirmDelete('tag', tid, name);
}

// ────────── SIDEBAR ──────────
function renderSidebar() {
  const d = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('sidebar-date-label').textContent = d;

  const active = tasks.filter(t => !t.done);
  document.getElementById('count-all').textContent       = active.length;
  document.getElementById('count-today').textContent     = active.filter(t => isToday(t.due)).length;
  document.getElementById('count-week').textContent      = active.filter(t => isThisWeek(t.due)).length;
  document.getElementById('count-overdue').textContent   = active.filter(t => isOverdue(t.due)).length;
  document.getElementById('count-nodate').textContent    = active.filter(t => !t.due).length;
  const rtCount = document.getElementById('count-recurring');
  if (rtCount) rtCount.textContent = recurringTasks.length || '';

  const ln = document.getElementById('category-nav');
  ln.innerHTML = categories.map(c => {
    const cnt = active.filter(t => t.category === c.id).length;
    return `<div class="sidebar-item ${currentView === 'category:' + c.id ? 'active' : ''}" onclick="setView('category:${c.id}', this)">
      <div class="sidebar-item-left">
        <span class="list-color-dot" style="background:${c.color}"></span>
        <span>${c.name}</span>
      </div>
      <span class="sidebar-count">${cnt}</span>
    </div>`;
  }).join('');

  renderTagFilterMenu();
}

// ────────── VIEWS ──────────
function setView(view, el) {
  currentView = view;
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  else { const navEl = document.getElementById('nav-' + view); if (navEl) navEl.classList.add('active'); }

  const titles = { all: 'All Tasks', today: 'Today', week: 'This Week', overdue: 'Overdue', nodate: 'No Due Date', recurring: 'Recurring' };
  if (view.startsWith('category:')) {
    const c = getCategory(view.replace('category:', ''));
    document.getElementById('view-title').textContent = c ? c.name : 'Category';
  } else {
    document.getElementById('view-title').textContent = titles[view] || view;
  }

  renderTasks();
  closeSidebar();
}

// ────────── SORT ──────────
function setSortBy(val) { sortBy = val; renderTasks(); }

function toggleSortDir() {
  sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  document.getElementById('sort-dir-btn').textContent = sortDir === 'asc' ? '↑' : '↓';
  renderTasks();
}

function sortTasks(filtered) {
  if (sortBy === 'default') return filtered;
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  return [...filtered].sort((a, b) => {
    if (sortBy === 'due') {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      const cmp = a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    }
    if (sortBy === 'priority') {
      const cmp = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
      return sortDir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

// ────────── TAG FILTER (sort bar) ──────────
function renderTagFilterMenu() {
  const menu    = document.getElementById('tag-filter-menu');
  const label   = document.getElementById('tag-filter-label');
  const trigger = document.getElementById('tag-filter-trigger');
  if (!menu || !label) return;

  if (activeTagFilters.length === 0) {
    label.textContent = 'Filter by tag';
    label.style.color = '';
    trigger.classList.remove('active');
  } else if (activeTagFilters.length === 1) {
    const t = getTag(activeTagFilters[0]);
    label.textContent = t ? t.name : 'Filter by tag';
    label.style.color = t ? t.color : '';
    trigger.classList.add('active');
  } else {
    label.textContent = `${activeTagFilters.length} tags`;
    label.style.color = '';
    trigger.classList.add('active');
  }

  if (!tags.length) {
    menu.innerHTML = '<div class="tag-filter-empty">No tags yet</div>';
    return;
  }
  menu.innerHTML = tags.map(t => `
    <div class="tag-filter-option ${activeTagFilters.includes(t.id) ? 'selected' : ''}"
         onclick="toggleTagFilter('${t.id}')">
      <span class="option-dot" style="background:${t.color};"></span>
      <span style="color:${t.color};font-weight:500;">${t.name}</span>
      <span class="option-check">${activeTagFilters.includes(t.id) ? '✓' : ''}</span>
    </div>`).join('');
}

function toggleTagFilter(tid) {
  if (activeTagFilters.includes(tid)) {
    activeTagFilters = activeTagFilters.filter(x => x !== tid);
  } else {
    activeTagFilters.push(tid);
  }
  renderTagFilterMenu();
  renderTasks();
}

function toggleTagFilterDropdown(e) {
  e.stopPropagation();
  tagFilterDropdownOpen = !tagFilterDropdownOpen;
  document.getElementById('tag-filter-trigger').classList.toggle('open', tagFilterDropdownOpen);
  document.getElementById('tag-filter-menu').classList.toggle('open', tagFilterDropdownOpen);
}

// ────────── FILTER + SORT ──────────
function getFilteredTasks() {
  let filtered = tasks.filter(t => !t.done);

  if (currentView === 'today')                filtered = filtered.filter(t => isToday(t.due));
  else if (currentView === 'week')            filtered = filtered.filter(t => isThisWeek(t.due));
  else if (currentView === 'overdue')         filtered = filtered.filter(t => isOverdue(t.due));
  else if (currentView === 'nodate')          filtered = filtered.filter(t => !t.due);
  else if (currentView.startsWith('category:')) filtered = filtered.filter(t => t.category === currentView.replace('category:', ''));

  if (activeTagFilters.length) {
    filtered = filtered.filter(t => activeTagFilters.some(tid => t.tags && t.tags.includes(tid)));
  }

  return sortTasks(filtered);
}

// ────────── RENDER TASKS ──────────
function renderTasks() {
  if (currentView === 'recurring') {
    renderRecurringView();
    renderSidebar();
    return;
  }

  const container = document.getElementById('tasks-container');
  const filtered  = getFilteredTasks();

  document.getElementById('view-subtitle').textContent = `${filtered.length} task${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">✦</div>
      <h3>Nothing here</h3>
      <p>Add a task above or try a different filter</p>
    </div>`;
  } else {
    container.innerHTML = filtered.map(t => renderTaskItem(t)).join('');
  }

  renderCompleted();
  renderSidebar();
}

function renderTaskItem(t) {
  const cat = getCategory(t.category);
  const tagChips = (t.tags || []).map(tid => {
    const tag = getTag(tid);
    return tag ? `<span class="tag-chip" style="background:${tag.color}28;color:${tag.color};">${tag.name}</span>` : '';
  }).join('');

  let dueHtml = '';
  if (t.due) {
    const cls  = isOverdue(t.due) ? 'overdue' : isToday(t.due) ? 'today' : '';
    const icon = isOverdue(t.due) ? '⚑' : '📅';
    dueHtml = `<span class="due-badge ${cls}">${icon} ${isToday(t.due) ? 'Today' : formatDate(t.due)}</span>`;
  }

  const priorityClass = { high: 'priority-high', medium: 'priority-medium', low: 'priority-low' }[t.priority] || 'priority-medium';
  const priorityLabel = { high: '[!] HIGH', medium: '[~] MED', low: '[.] LOW' }[t.priority] || '[~] MED';
  const menuId   = `task-menu-${t.id}`;
  const safeName = t.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');

  const recurringBadge = t.recurringTaskId ? `<span class="recurring-badge" title="Generated from recurring task">↻</span>` : '';

  return `<div class="task-item" data-id="${t.id}"
              onclick="editTask('${t.id}')"
              ondragover="onDragOver(event,'${t.id}')"
              ondrop="onDrop(event,'${t.id}')"
              ondragstart="onDragStart(event,'${t.id}')"
              ondragend="onDragEnd()">
    <span class="task-drag-handle" draggable="true" onmousedown="dragFromHandle=true" onclick="event.stopPropagation()" title="Drag to reorder">⠿</span>
    <div class="task-checkbox" onclick="event.stopPropagation();completeTask('${t.id}')"></div>
    <div class="task-body">
      <div class="task-name">${recurringBadge}${t.name}</div>
      <div class="task-meta">
        <span class="priority-badge ${priorityClass}">${priorityLabel}</span>
        ${dueHtml}
        ${cat ? `<span class="list-badge"><span class="list-color-dot" style="background:${cat.color};width:6px;height:6px;"></span>${cat.name}</span>` : ''}
        ${tagChips}
      </div>
      ${t.notes ? `<div class="task-note">${t.notes}</div>` : ''}
    </div>
    <div class="task-menu-wrap" onclick="event.stopPropagation()">
      <span class="task-menu-btn" onclick="openContextMenu(event,'${menuId}')">⋯</span>
      <div class="task-menu-dropdown" id="${menuId}">
        <div class="task-menu-option danger" onclick="taskMenuDelete('${t.id}','${safeName}')">Delete</div>
      </div>
    </div>
  </div>`;
}

// ────────── COMPLETED ──────────
function renderCompleted() {
  const done = tasks.filter(t => t.done).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  const el   = document.getElementById('completed-section');
  if (!done.length) { el.innerHTML = ''; return; }

  const visible = showAllCompleted ? done : done.slice(0, 5);
  const hasMore = done.length > 5;

  el.innerHTML = `
    <div class="section-header">
      <div class="section-header-line"></div>
      <div class="section-header-label">Completed (${done.length})</div>
      <div class="section-header-line"></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${visible.map(t => {
        const menuId   = `completed-menu-${t.id}`;
        const safeName = t.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `
        <div class="completed-task">
          <div class="completed-check" onclick="uncompleteTask('${t.id}')" title="Mark as active">✓</div>
          <div class="completed-name">${t.name}</div>
          <div class="completed-date">${t.completedAt ? new Date(t.completedAt).toLocaleDateString('en-US', {month:'short',day:'numeric'}) : ''}</div>
          <div class="task-menu-wrap">
            <span class="task-menu-btn" onclick="openContextMenu(event,'${menuId}')">⋯</span>
            <div class="task-menu-dropdown" id="${menuId}">
              <div class="task-menu-option danger" onclick="taskMenuDelete('${t.id}','${safeName}')">Delete</div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
    ${hasMore && !showAllCompleted ? `<button class="see-more-btn" onclick="toggleSeeMore()">View more (${done.length - 5} remaining)</button>` : ''}
    ${showAllCompleted && done.length > 5 ? `<button class="see-more-btn" onclick="toggleSeeMore()">Show less</button>` : ''}
  `;
}

function toggleSeeMore() { showAllCompleted = !showAllCompleted; renderCompleted(); }

// ────────── TASK ACTIONS ──────────
async function completeTask(tid) {
  const t = tasks.find(x => x.id === tid);
  if (!t) return;
  const now = new Date().toISOString();
  t.done = true;
  t.completedAt = Date.now();
  renderTasks();
  await _sb.from('tasks').update({ done: true, completed_at: now }).eq('id', tid).eq('user_id', _uid);
}

async function uncompleteTask(tid) {
  const t = tasks.find(x => x.id === tid);
  if (!t) return;
  t.done = false;
  delete t.completedAt;
  renderTasks();
  await _sb.from('tasks').update({ done: false, completed_at: null }).eq('id', tid).eq('user_id', _uid);
}

function confirmDelete(type, itemId, itemName) {
  const messages = {
    task:      `"${itemName}" will be permanently deleted.`,
    category:  `The category "${itemName}" will be deleted. Tasks in this category won't be deleted but will lose their category assignment.`,
    tag:       `The tag "${itemName}" will be removed from all tasks and deleted permanently.`,
    recurring: `The recurring task "${itemName}" will be deleted. Already-generated tasks will not be affected.`,
  };
  document.getElementById('confirm-delete-msg').textContent = messages[type] || 'This will be permanently deleted.';
  const btn = document.getElementById('confirm-delete-btn');
  btn.onclick = () => {
    closeModal('confirm-delete-modal');
    if (type === 'task')      deleteTask(itemId);
    if (type === 'category')  deleteCategory(itemId);
    if (type === 'tag')       deleteTag(itemId);
    if (type === 'recurring') deleteRecurringTask(itemId);
  };
  openModal('confirm-delete-modal');
}

async function deleteTask(tid) {
  tasks = tasks.filter(t => t.id !== tid);
  renderTasks();
  await _sb.from('tasks').delete().eq('id', tid).eq('user_id', _uid);
}

async function editTask(tid) {
  const t = tasks.find(x => x.id === tid);
  if (!t) return;
  document.getElementById('task-modal-title').textContent = 'Edit Task';
  document.getElementById('editing-task-id').value = tid;
  document.getElementById('task-name-input').value = t.name;
  document.getElementById('task-name-input').style.borderColor = '';
  document.getElementById('task-category-input').style.borderColor = '';
  setPriorityChip('task-priority-input', t.priority);
  document.getElementById('task-due-input').value = t.due || '';
  document.getElementById('task-notes-input').value = t.notes || '';
  selectedTaskTags = [...(t.tags || [])];
  tagDropdownOpen = false;
  populateTaskModal(t.category);

  // Load existing reminders
  taskReminders = [];
  const section = document.getElementById('task-reminders-section');
  if (t.due) {
    const { data: remRows } = await _sb.from('task_reminders')
      .select('id, amount, unit').eq('task_id', tid).eq('user_id', _uid).eq('sent', false);
    taskReminders = (remRows || []).map(r => ({ id: r.id, amount: r.amount, unit: r.unit }));
    section.style.display = '';
    renderRemindersSection();
  } else {
    section.style.display = 'none';
    document.getElementById('task-reminder-rows').innerHTML = '';
  }

  // Hide recurring toggle in edit mode
  document.getElementById('task-recurring-toggle-row').style.display = 'none';
  document.getElementById('task-recurring-fields').style.display = 'none';
  document.getElementById('task-due-group').style.display = '';
  document.getElementById('add-task-modal').classList.add('show');
  setTimeout(() => document.getElementById('task-name-input')?.focus(), 80);
  const deleteBtn = document.getElementById('modal-delete-btn');
  const actions   = document.getElementById('task-modal-actions');
  if (deleteBtn) deleteBtn.style.display = 'inline-flex';
  if (actions)   actions.style.justifyContent = 'space-between';
}

function modalDeleteTask() {
  const tid  = document.getElementById('editing-task-id').value;
  const name = document.getElementById('task-name-input').value.trim();
  closeModal('add-task-modal');
  confirmDelete('task', tid, name);
}

async function saveTask() {
  const name     = document.getElementById('task-name-input').value.trim();
  const category = document.getElementById('task-category-input').value;
  if (!name || !category) {
    if (!name)     document.getElementById('task-name-input').style.borderColor = 'var(--p-high)';
    if (!category) document.getElementById('task-category-input').style.borderColor = 'var(--p-high)';
    return;
  }
  const tid = document.getElementById('editing-task-id').value;

  // If recurring toggle is on (new task only), create a recurring template + instance
  const recurringToggle = document.getElementById('task-recurring-toggle');
  if (!tid && recurringToggle && recurringToggle.checked) {
    const activeFreqBtn = document.querySelector('.task-freq-btn.active');
    const freq = activeFreqBtn ? activeFreqBtn.dataset.freq : 'daily';
    let freqDay = null;
    if (freq === 'weekly')  freqDay = parseInt(document.getElementById('task-rt-week-select').value, 10);
    if (freq === 'monthly') freqDay = parseInt(document.getElementById('task-rt-month-select').value, 10);
    const rtPayload = {
      id:            uid(),
      user_id:       _uid,
      name,
      list_id:       category || null,
      priority:      document.getElementById('task-priority-input').value,
      tags:          [...selectedTaskTags],
      notes:         document.getElementById('task-notes-input').value.trim(),
      frequency:     freq,
      frequency_day: freqDay,
      active:        true,
    };
    closeModal('add-task-modal');
    const { data: rtData, error: rtErr } = await _sb.from('recurring_tasks').insert(rtPayload).select().single();
    if (rtErr) { console.error('[recurring] insert error:', rtErr.message); return; }
    const rt = rtData || { ...rtPayload, last_generated_date: null };
    recurringTasks.push(rt);
    // Only generate an instance today if the schedule actually fires today
    if (shouldGenerateToday(rt)) {
      const newId  = uid();
      const minPos = tasks.length ? Math.min(...tasks.map(t => t.order || 0)) : 0;
      const { data: taskData } = await _sb.from('tasks').insert({
        id:               newId,
        user_id:          _uid,
        name:             rt.name,
        category_id:      rt.list_id || null,
        priority:         rt.priority,
        due:              todayStr,
        tags:             rt.tags || [],
        notes:            rt.notes || '',
        done:             false,
        position:         minPos - 1,
        recurring_task_id: rt.id,
        recurring_date:   todayStr,
      }).select().single();
      if (taskData) tasks.unshift(fromDbTask(taskData));
      await _sb.from('recurring_tasks').update({ last_generated_date: todayStr }).eq('id', rt.id);
      rt.last_generated_date = todayStr;
    }
    renderTasks();
    renderSidebar();
    return;
  }
  const data = {
    name,
    priority: document.getElementById('task-priority-input').value,
    due:      document.getElementById('task-due-input').value,
    category,
    tags:     [...selectedTaskTags],
    notes:    document.getElementById('task-notes-input').value.trim(),
    done:     false,
  };

  closeModal('add-task-modal');

  const snapshotReminders = [...taskReminders];

  if (tid) {
    const t = tasks.find(x => x.id === tid);
    if (t) Object.assign(t, data);
    renderTasks();
    await _sb.from('tasks').update({
      name:        data.name,
      category_id: data.category || null,
      priority:    data.priority,
      due:         data.due || null,
      tags:        data.tags,
      notes:       data.notes || null,
    }).eq('id', tid).eq('user_id', _uid);
    await saveReminders(tid, data.due, snapshotReminders);
  } else {
    const newId  = uid();
    const minPos = tasks.length ? Math.min(...tasks.map(t => t.order || 0)) : 0;
    const pos    = minPos - 1;
    const newTask = { id: newId, ...data, order: pos };
    tasks.unshift(newTask);
    renderTasks();
    await _sb.from('tasks').insert({
      id:          newId,
      user_id:     _uid,
      name:        data.name,
      category_id: data.category || null,
      priority:    data.priority,
      due:         data.due || null,
      tags:        data.tags,
      notes:       data.notes || null,
      done:        false,
      position:    pos,
    });
    await saveReminders(newId, data.due, snapshotReminders);
  }
}

async function saveReminders(taskId, dueStr, reminders) {
  // Delete unsent reminders for this task, then re-insert
  await _sb.from('task_reminders').delete()
    .eq('task_id', taskId).eq('user_id', _uid).eq('sent', false);

  if (!dueStr || !reminders.length) return;

  const rows = reminders
    .filter(r => r.amount > 0)
    .map(r => ({
      id:        crypto.randomUUID(),
      user_id:   _uid,
      task_id:   taskId,
      remind_at: calcRemindAt(dueStr, r.amount, r.unit),
      amount:    r.amount,
      unit:      r.unit,
      sent:      false,
    }));

  if (rows.length) {
    await _sb.from('task_reminders').insert(rows);
  }
}

// ────────── CATEGORIES ──────────
async function addCategory() {
  const name = document.getElementById('new-category-name').value.trim();
  if (!name) return;
  const newCat = { id: uid(), name, color: selectedCategoryColor };
  categories.push(newCat);
  document.getElementById('new-category-name').value = '';
  closeModal('add-category-modal');
  renderSidebar();
  await _sb.from('lists').insert({ ...newCat, user_id: _uid });
}

async function deleteCategory(cid) {
  categories = categories.filter(c => c.id !== cid);
  tasks.forEach(t => { if (t.category === cid) t.category = ''; });
  if (currentView === 'category:' + cid) setView('all');
  renderSidebar();
  renderTasks();
  await Promise.all([
    _sb.from('lists').delete().eq('id', cid).eq('user_id', _uid),
    _sb.from('tasks').update({ category_id: null }).eq('category_id', cid).eq('user_id', _uid),
  ]);
}

// ────────── RECURRING TASKS ──────────

async function loadRecurringTasks() {
  const { data, error } = await _sb.from('recurring_tasks').select('*').eq('user_id', _uid).order('created_at', { ascending: true });
  if (error) { console.error('[recurring] loadRecurringTasks error:', error.message, '— has migration 006 been run?'); }
  recurringTasks = data || [];
}

function shouldGenerateToday(rt) {
  if (rt.last_generated_date === todayStr) return false;
  if (rt.frequency === 'daily')   return true;
  if (rt.frequency === 'weekly')  return today.getDay() === rt.frequency_day;
  if (rt.frequency === 'monthly') {
    if (rt.frequency_day === 0) {
      // Last day of month
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      return today.getDate() === lastDay;
    }
    return today.getDate() === rt.frequency_day;
  }
  return false;
}

async function generateRecurringInstances() {
  for (const rt of recurringTasks) {
    if (!rt.active || !shouldGenerateToday(rt)) continue;
    // Safety: skip if an instance already exists for today
    if (tasks.some(t => t.recurringTaskId === rt.id && t.recurringDate === todayStr)) continue;

    const newId  = uid();
    const minPos = tasks.length ? Math.min(...tasks.map(t => t.order || 0)) : 0;
    const { data } = await _sb.from('tasks').insert({
      id:               newId,
      user_id:          _uid,
      name:             rt.name,
      category_id:      rt.list_id || null,
      priority:         rt.priority,
      due:              todayStr,
      tags:             rt.tags || [],
      notes:            rt.notes || '',
      done:             false,
      position:         minPos - 1,
      recurring_task_id: rt.id,
      recurring_date:   todayStr,
    }).select().single();

    if (data) tasks.unshift(fromDbTask(data));
    await _sb.from('recurring_tasks').update({ last_generated_date: todayStr }).eq('id', rt.id);
    rt.last_generated_date = todayStr;
  }
}

function frequencyLabel(rt) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const ordinal = n => {
    const s = ['th','st','nd','rd'];
    const v = n % 100;
    return n + (s[(v-20)%10] || s[v] || s[0]);
  };
  if (rt.frequency === 'daily')   return 'Daily';
  if (rt.frequency === 'weekly')  return 'Weekly — ' + (days[rt.frequency_day] || '');
  if (rt.frequency === 'monthly') return 'Monthly — ' + (rt.frequency_day === 0 ? 'Last day' : ordinal(rt.frequency_day));
  return '';
}

function renderRecurringView() {
  const container = document.getElementById('tasks-container');
  document.getElementById('view-subtitle').textContent = `${recurringTasks.length} template${recurringTasks.length !== 1 ? 's' : ''}`;
  if (!recurringTasks.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">↻</div>
      <h3>No recurring tasks</h3>
      <p>Create a recurring task to auto-generate it on a schedule</p>
    </div>
    <div style="text-align:center;margin-top:16px;">
      <button class="btn btn-primary" onclick="openModal('add-recurring-modal')">+ New Recurring Task</button>
    </div>`;
  } else {
    container.innerHTML = recurringTasks.map(rt => {
      const cat     = getCategory(rt.list_id);
      const menuId  = `rt-menu-${rt.id}`;
      const safeName = rt.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      return `<div class="recurring-task-row ${rt.active ? '' : 'rt-paused'}">
        <span class="recurring-badge">↻</span>
        <div class="rt-body">
          <div class="rt-name">${rt.name}</div>
          <div class="rt-meta">
            <span class="recurring-freq-label">${frequencyLabel(rt)}</span>
            ${cat ? `<span class="list-badge"><span class="list-color-dot" style="background:${cat.color};width:6px;height:6px;"></span>${cat.name}</span>` : ''}
            ${rt.active ? '' : '<span class="rt-paused-label">Paused</span>'}
          </div>
        </div>
        <div class="task-menu-wrap" onclick="event.stopPropagation()">
          <span class="task-menu-btn" onclick="openContextMenu(event,'${menuId}')">⋯</span>
          <div class="task-menu-dropdown" id="${menuId}">
            <div class="task-menu-option" onclick="closeContextMenu();openEditRecurringModal('${rt.id}')">Edit</div>
            <div class="task-menu-option" onclick="closeContextMenu();toggleRecurringActive('${rt.id}')">${rt.active ? 'Pause' : 'Resume'}</div>
            <div class="task-menu-option danger" onclick="closeContextMenu();confirmDelete('recurring','${rt.id}','${safeName}')">Delete</div>
          </div>
        </div>
      </div>`;
    }).join('') + `<div style="margin-top:24px;">
      <button class="btn" onclick="openModal('add-recurring-modal')">+ New Recurring Task</button>
    </div>`;
  }
  document.getElementById('completed-section').innerHTML = '';
}

let editingRecurringId = null;

function buildMonthDaySelect(selId) {
  const sel = document.getElementById(selId);
  if (!sel || sel.options.length) return;
  const ordinal = n => { const s=['th','st','nd','rd']; const v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); };
  for (let d = 1; d <= 28; d++) {
    const o = document.createElement('option');
    o.value = d; o.textContent = ordinal(d);
    sel.appendChild(o);
  }
  const lastOpt = document.createElement('option');
  lastOpt.value = 0; lastOpt.textContent = 'Last day';
  sel.appendChild(lastOpt);
}

function openModal_addRecurring() {
  buildMonthDaySelect('rt-month-select');
  editingRecurringId = null;
  document.getElementById('rt-modal-title').textContent = 'New Recurring Task';
  document.getElementById('rt-name-input').value = '';
  setPriorityChip('rt-priority-input', 'medium');
  document.getElementById('rt-notes-input').value = '';
  setRecurringFrequency('daily');
  populateRecurringModal('');
  document.getElementById('add-recurring-modal').classList.add('show');
  setTimeout(() => document.getElementById('rt-name-input')?.focus(), 80);
}

function openEditRecurringModal(id) {
  buildMonthDaySelect('rt-month-select');
  const rt = recurringTasks.find(r => r.id === id);
  if (!rt) return;
  editingRecurringId = id;
  document.getElementById('rt-modal-title').textContent = 'Edit Recurring Task';
  document.getElementById('rt-name-input').value = rt.name;
  setPriorityChip('rt-priority-input', rt.priority);
  document.getElementById('rt-notes-input').value = rt.notes || '';
  setRecurringFrequency(rt.frequency, rt.frequency_day);
  populateRecurringModal(rt.list_id || '');
  document.getElementById('add-recurring-modal').classList.add('show');
  setTimeout(() => document.getElementById('rt-name-input')?.focus(), 80);
}

function populateRecurringModal(selectedListId) {
  const sel = document.getElementById('rt-category-input');
  sel.innerHTML = categories.map(c => `<option value="${c.id}" ${selectedListId === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
}

function setRecurringFrequency(freq, day) {
  document.querySelectorAll('#add-recurring-modal .freq-btn').forEach(b => b.classList.toggle('active', b.dataset.freq === freq));
  const weekSel  = document.getElementById('rt-freq-week');
  const monthSel = document.getElementById('rt-freq-month');
  weekSel.style.display  = freq === 'weekly'  ? '' : 'none';
  monthSel.style.display = freq === 'monthly' ? '' : 'none';
  const wSel = document.getElementById('rt-week-select');
  const mSel = document.getElementById('rt-month-select');
  if (freq === 'weekly'  && day != null && wSel) wSel.value = day;
  if (freq === 'monthly' && day != null && mSel) mSel.value = day;
}

function onTaskRecurringToggle() {
  const on = document.getElementById('task-recurring-toggle').checked;
  document.getElementById('task-due-group').style.display = on ? 'none' : '';
  document.getElementById('task-recurring-fields').style.display = on ? '' : 'none';
  if (on) {
    // Reset reminders since no due date when recurring
    document.getElementById('task-reminders-section').style.display = 'none';
    taskReminders = [];
    document.getElementById('task-reminder-rows').innerHTML = '';
    setTaskRecurringFrequency('daily');
  }
}

function setTaskRecurringFrequency(freq) {
  document.querySelectorAll('.task-freq-btn').forEach(b => b.classList.toggle('active', b.dataset.freq === freq));
  const weekDiv  = document.getElementById('task-rt-freq-week');
  const monthDiv = document.getElementById('task-rt-freq-month');
  if (weekDiv)  weekDiv.style.display  = freq === 'weekly'  ? '' : 'none';
  if (monthDiv) monthDiv.style.display = freq === 'monthly' ? '' : 'none';
}

async function saveRecurringTask() {
  const name = document.getElementById('rt-name-input').value.trim();
  if (!name) { document.getElementById('rt-name-input').style.borderColor = 'var(--p-high)'; return; }
  document.getElementById('rt-name-input').style.borderColor = '';

  const activeFreqBtn = document.querySelector('.freq-btn.active');
  const freq = activeFreqBtn ? activeFreqBtn.dataset.freq : 'daily';
  let freqDay = null;
  if (freq === 'weekly')  freqDay = parseInt(document.getElementById('rt-week-select').value,  10);
  if (freq === 'monthly') freqDay = parseInt(document.getElementById('rt-month-select').value, 10);

  const payload = {
    user_id:       _uid,
    name,
    list_id:       document.getElementById('rt-category-input').value || null,
    priority:      document.getElementById('rt-priority-input').value,
    notes:         document.getElementById('rt-notes-input').value.trim(),
    frequency:     freq,
    frequency_day: freqDay,
    active:        true,
  };

  closeModal('add-recurring-modal');

  if (editingRecurringId) {
    const { error } = await _sb.from('recurring_tasks').update(payload).eq('id', editingRecurringId).eq('user_id', _uid);
    if (error) { console.error('[recurring] update error:', error.message); return; }
    const idx = recurringTasks.findIndex(r => r.id === editingRecurringId);
    if (idx !== -1) recurringTasks[idx] = { ...recurringTasks[idx], ...payload };
  } else {
    const newRtId = uid();
    const { data, error } = await _sb.from('recurring_tasks').insert({ ...payload, id: newRtId }).select().single();
    if (error) { console.error('[recurring] insert error:', error.message, '— has migration 006 been run?'); return; }
    const rt = data || { ...payload, id: newRtId, last_generated_date: null };
    recurringTasks.push(rt);

    // Generate an instance for today immediately if this template fires today
    if (shouldGenerateToday(rt) && !tasks.some(t => t.recurringTaskId === rt.id && t.recurringDate === todayStr)) {
      const newId  = uid();
      const minPos = tasks.length ? Math.min(...tasks.map(t => t.order || 0)) : 0;
      const { data: taskData, error: taskErr } = await _sb.from('tasks').insert({
        id:                newId,
        user_id:           _uid,
        name:              rt.name,
        category_id:       rt.list_id || null,
        priority:          rt.priority,
        due:               todayStr,
        tags:              rt.tags || [],
        notes:             rt.notes || '',
        done:              false,
        position:          minPos - 1,
        recurring_task_id: rt.id,
        recurring_date:    todayStr,
      }).select().single();
      if (taskErr) { console.error('[recurring] task insert error:', taskErr.message); }
      if (taskData) tasks.unshift(fromDbTask(taskData));
      await _sb.from('recurring_tasks').update({ last_generated_date: todayStr }).eq('id', rt.id);
      rt.last_generated_date = todayStr;
    }
  }

  if (currentView === 'recurring') renderRecurringView();
  renderSidebar();
  renderTasks();
}

async function toggleRecurringActive(id) {
  const rt = recurringTasks.find(r => r.id === id);
  if (!rt) return;
  rt.active = !rt.active;
  await _sb.from('recurring_tasks').update({ active: rt.active }).eq('id', id).eq('user_id', _uid);
  if (currentView === 'recurring') renderRecurringView();
}

async function deleteRecurringTask(id) {
  recurringTasks = recurringTasks.filter(r => r.id !== id);
  if (currentView === 'recurring') renderRecurringView();
  renderSidebar();
  await _sb.from('recurring_tasks').delete().eq('id', id).eq('user_id', _uid);
}

// ────────── TAGS ──────────
async function addTag() {
  const name = document.getElementById('new-tag-name').value.trim();
  if (!name) { document.getElementById('new-tag-name').style.borderColor = 'var(--p-high)'; return; }
  document.getElementById('new-tag-name').style.borderColor = '';
  const newTag = { id: uid(), name: name.toLowerCase(), color: selectedTagColor };
  tags.push(newTag);
  await _sb.from('tags').insert({ ...newTag, user_id: _uid });
  document.getElementById('new-tag-name').value = '';
  selectedTagColor = TAG_COLORS[0];
  document.querySelectorAll('#tag-color-swatches .color-swatch').forEach((s, i) => s.classList.toggle('selected', i === 0));
  renderManageTags();
  renderSidebar();
}

async function deleteTag(tid) {
  tags = tags.filter(t => t.id !== tid);
  activeTagFilters = activeTagFilters.filter(x => x !== tid);
  renderManageTags();
  renderSidebar();
  renderTasks();
  await _sb.from('tags').delete().eq('id', tid).eq('user_id', _uid);
  await _sb.rpc('remove_tag_from_tasks', { p_tag_id: tid, p_user_id: _uid });
}

function renderManageTags() {
  const el = document.getElementById('manage-tags-list');
  if (!tags.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">No tags yet — create one below.</div>';
    return;
  }
  el.innerHTML = tags.map(t => {
    const usageCount = tasks.filter(task => task.tags && task.tags.includes(t.id)).length;
    const menuId   = `tag-menu-${t.id}`;
    const safeName = t.name.replace(/'/g, "\\'");
    return `<div class="manage-tag-row">
      <span class="manage-tag-dot" style="background:${t.color};"></span>
      <span class="tag-chip" style="background:${t.color}28;color:${t.color};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:500;">${t.name}</span>
      <span class="manage-tag-name" style="color:var(--text-muted);font-size:12px;">${usageCount} task${usageCount !== 1 ? 's' : ''}</span>
      <div class="task-menu-wrap">
        <span class="task-menu-btn" onclick="openContextMenu(event,'${menuId}')">⋯</span>
        <div class="task-menu-dropdown" id="${menuId}">
          <div class="task-menu-option danger" onclick="tagMenuDelete('${t.id}','${safeName}')">Delete</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ────────── MODAL SETUP ──────────
function populateTaskModal(selectedCategory) {
  const sel = document.getElementById('task-category-input');
  sel.innerHTML = categories.map(c => `<option value="${c.id}" ${selectedCategory === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
  renderTagDropdown();
}

// ────────── TAG DROPDOWN (task modal) ──────────
let tagDropdownOpen = false;
let inlineTagColor  = TAG_COLORS[0];

function renderTagDropdown() {
  const opts = document.getElementById('tag-dropdown-options');
  opts.innerHTML = tags.map(t => `
    <div class="tag-dropdown-option ${selectedTaskTags.includes(t.id) ? 'selected' : ''}"
         onclick="toggleTaskTag('${t.id}')">
      <span class="option-dot" style="background:${t.color};"></span>
      <span style="color:${t.color};font-weight:500;">${t.name}</span>
      <span class="option-check">${selectedTaskTags.includes(t.id) ? '✓' : ''}</span>
    </div>`).join('');

  const sel = document.getElementById('tag-dropdown-selected');
  const ph  = document.getElementById('tag-dropdown-placeholder');
  if (selectedTaskTags.length) {
    ph.style.display = 'none';
    sel.innerHTML = '<span class="tag-dropdown-placeholder" id="tag-dropdown-placeholder" style="display:none"></span>' +
      selectedTaskTags.map(tid => {
        const t = getTag(tid);
        return t ? `<span class="tag-chip" style="background:${t.color}28;color:${t.color};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500;">${t.name}</span>` : '';
      }).join('');
  } else {
    sel.innerHTML = '<span class="tag-dropdown-placeholder" id="tag-dropdown-placeholder">Select tags...</span>';
  }
}

function toggleTagDropdown(e) {
  e.stopPropagation();
  tagDropdownOpen = !tagDropdownOpen;
  document.getElementById('tag-dropdown-trigger').classList.toggle('open', tagDropdownOpen);
  document.getElementById('tag-dropdown-menu').classList.toggle('open', tagDropdownOpen);
  if (!tagDropdownOpen) hideInlineTagForm();
}

function toggleTaskTag(tid) {
  if (selectedTaskTags.includes(tid)) {
    selectedTaskTags = selectedTaskTags.filter(x => x !== tid);
  } else {
    selectedTaskTags.push(tid);
  }
  renderTagDropdown();
}

function showInlineTagForm() {
  inlineTagColor = TAG_COLORS[0];
  document.getElementById('inline-tag-name').value = '';
  const sw = document.getElementById('inline-tag-swatches');
  sw.innerHTML = TAG_COLORS.map((c, i) => `
    <div class="tag-inline-swatch ${i === 0 ? 'selected' : ''}" style="background:${c}"
         onclick="selectInlineTagColor('${c}', this)"></div>`).join('');
  document.getElementById('tag-inline-form').classList.add('show');
  setTimeout(() => {
    const form     = document.getElementById('tag-inline-form');
    const backdrop = document.getElementById('add-task-modal');
    if (form && backdrop) {
      const formBottom = form.getBoundingClientRect().bottom;
      if (formBottom > window.innerHeight - 20) {
        backdrop.scrollBy({ top: formBottom - window.innerHeight + 40, behavior: 'smooth' });
      }
    }
    document.getElementById('inline-tag-name').focus();
  }, 80);
}

function hideInlineTagForm() {
  document.getElementById('tag-inline-form').classList.remove('show');
}

function selectInlineTagColor(c, el) {
  inlineTagColor = c;
  document.querySelectorAll('.tag-inline-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
}

async function saveInlineTag() {
  const name = document.getElementById('inline-tag-name').value.trim();
  if (!name) { document.getElementById('inline-tag-name').style.borderColor = 'var(--p-high)'; return; }
  const newTag = { id: uid(), name: name.toLowerCase(), color: inlineTagColor };
  tags.push(newTag);
  await _sb.from('tags').insert({ ...newTag, user_id: _uid });
  selectedTaskTags.push(newTag.id);
  hideInlineTagForm();
  renderTagDropdown();
  renderSidebar();
}

// ────────── MODALS ──────────
function openModal(mid) {
  if (mid === 'add-recurring-modal') { openModal_addRecurring(); return; }
  if (mid === 'add-task-modal') {
    document.getElementById('task-modal-title').textContent = 'New Task';
    document.getElementById('editing-task-id').value = '';
    document.getElementById('task-name-input').value = '';
    document.getElementById('task-name-input').style.borderColor = '';
    document.getElementById('task-category-input').style.borderColor = '';
    setPriorityChip('task-priority-input', 'medium');
    document.getElementById('task-due-input').value = '';
    document.getElementById('task-notes-input').value = '';
    selectedTaskTags = [];
    tagDropdownOpen  = false;
    taskReminders = [];
    document.getElementById('task-reminders-section').style.display = 'none';
    document.getElementById('task-reminder-rows').innerHTML = '';
    // Reset recurring toggle
    const recurringToggle = document.getElementById('task-recurring-toggle');
    if (recurringToggle) recurringToggle.checked = false;
    document.getElementById('task-recurring-fields').style.display = 'none';
    document.getElementById('task-due-group').style.display = '';
    document.getElementById('task-recurring-toggle-row').style.display = '';
    buildMonthDaySelect('task-rt-month-select');
    setTaskRecurringFrequency('daily');
    const deleteBtn  = document.getElementById('modal-delete-btn');
    const actions    = document.getElementById('task-modal-actions');
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (actions)   actions.style.justifyContent = 'flex-end';
    const defaultCategory = currentView.startsWith('category:') ? currentView.replace('category:', '') : (categories[0]?.id || '');
    populateTaskModal(defaultCategory);
  }
  if (mid === 'add-category-modal') {
    selectedCategoryColor = LIST_COLORS[0];
    const sw = document.getElementById('category-color-picker');
    sw.innerHTML = LIST_COLORS.map((c, i) => `<div class="list-color-swatch ${i === 0 ? 'selected' : ''}" style="background:${c}" onclick="selectCategoryColor('${c}', this)"></div>`).join('');
  }
  if (mid === 'manage-tags-modal') {
    selectedTagColor = TAG_COLORS[0];
    document.getElementById('new-tag-name').value = '';
    document.getElementById('new-tag-name').style.borderColor = '';
    const sw = document.getElementById('tag-color-swatches');
    sw.innerHTML = TAG_COLORS.map((c, i) => `<div class="color-swatch ${i === 0 ? 'selected' : ''}" style="background:${c}" onclick="selectTagColor('${c}', this)"></div>`).join('');
    renderManageTags();
  }
  document.getElementById(mid).classList.add('show');
  setTimeout(() => { const fi = document.querySelector('#' + mid + ' input[type="text"]'); if (fi) fi.focus(); }, 80);
}

function closeModal(mid) { document.getElementById(mid).classList.remove('show'); }

// ────────── REMINDERS ──────────

function onDueDateChange() {
  const due = document.getElementById('task-due-input').value;
  const section = document.getElementById('task-reminders-section');
  if (due) {
    section.style.display = '';
  } else {
    section.style.display = 'none';
    taskReminders = [];
    document.getElementById('task-reminder-rows').innerHTML = '';
  }
}

function renderRemindersSection() {
  const rows = document.getElementById('task-reminder-rows');
  rows.innerHTML = taskReminders.map((r, i) => `
    <div class="reminder-row" id="reminder-row-${i}">
      <input class="reminder-amount" type="number" min="1" value="${r.amount}"
             oninput="updateReminder(${i},'amount',this.value)">
      <select class="reminder-unit" onchange="updateReminder(${i},'unit',this.value)">
        <option value="minutes" ${r.unit==='minutes'?'selected':''}>minutes</option>
        <option value="hours"   ${r.unit==='hours'  ?'selected':''}>hours</option>
        <option value="days"    ${r.unit==='days'   ?'selected':''}>days</option>
      </select>
      <span class="reminder-before">before</span>
      <button type="button" class="reminder-remove" onclick="removeReminderRow(${i})">×</button>
    </div>`).join('');
}

function addReminderRow() {
  taskReminders.push({ id: null, amount: 30, unit: 'minutes' });
  renderRemindersSection();
}

function removeReminderRow(i) {
  taskReminders.splice(i, 1);
  renderRemindersSection();
}

function updateReminder(i, field, val) {
  if (!taskReminders[i]) return;
  taskReminders[i][field] = field === 'amount' ? parseInt(val, 10) || 1 : val;
}

function calcRemindAt(dueStr, amount, unit) {
  // dueStr is YYYY-MM-DD; treat due as start-of-day in local time
  const due = new Date(dueStr + 'T00:00:00');
  const ms = {
    minutes: amount * 60 * 1000,
    hours:   amount * 3600 * 1000,
    days:    amount * 86400 * 1000,
  }[unit] || 0;
  return new Date(due.getTime() - ms).toISOString();
}

function selectCategoryColor(c, el) {
  selectedCategoryColor = c;
  document.querySelectorAll('#category-color-picker .list-color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
}

function selectTagColor(c, el) {
  selectedTagColor = c;
  document.querySelectorAll('#tag-color-swatches .color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
}

// ────────── SIGN OUT ──────────
async function signOut() {
  await _sb.auth.signOut();
  window.location.href = '../login.html';
}

// ────────── GLOBAL EVENT HANDLERS ──────────
document.addEventListener('click', (e) => {
  if (tagDropdownOpen && !document.getElementById('tag-dropdown-wrap')?.contains(e.target)) {
    tagDropdownOpen = false;
    document.getElementById('tag-dropdown-trigger').classList.remove('open');
    document.getElementById('tag-dropdown-menu').classList.remove('open');
    hideInlineTagForm();
  }
  if (tagFilterDropdownOpen && !document.getElementById('tag-filter-wrap')?.contains(e.target)) {
    tagFilterDropdownOpen = false;
    document.getElementById('tag-filter-trigger')?.classList.remove('open');
    document.getElementById('tag-filter-menu')?.classList.remove('open');
  }
  closeContextMenu();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.show').forEach(m => m.classList.remove('show'));
    closeContextMenu();
  }
});

// ────────── DRAG & DROP (handle only) ──────────
function onDragStart(e, tid) {
  if (!dragFromHandle) { e.preventDefault(); return; }
  dragSrcId = tid;
  setTimeout(() => { const el = document.querySelector(`[data-id="${tid}"]`); if (el) el.classList.add('dragging'); }, 0);
}

function onDragOver(e, tid) {
  e.preventDefault();
  document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
  const el = document.querySelector(`[data-id="${tid}"]`);
  if (el && tid !== dragSrcId) el.classList.add('drag-over');
}

async function onDrop(e, tid) {
  e.preventDefault();
  if (!dragSrcId || dragSrcId === tid) return;
  const srcTask = tasks.find(t => t.id === dragSrcId);
  const tgtTask = tasks.find(t => t.id === tid);
  if (!srcTask || !tgtTask) return;
  const srcIdx = tasks.indexOf(srcTask);
  const tgtIdx = tasks.indexOf(tgtTask);
  tasks.splice(srcIdx, 1);
  tasks.splice(tgtIdx, 0, srcTask);
  tasks.forEach((t, i) => { t.order = i; });
  renderTasks();
  await _sb.from('tasks').upsert(
    tasks.map(t => ({ id: t.id, user_id: _uid, position: t.order })),
    { onConflict: 'id' }
  );
}

function onDragEnd() {
  dragSrcId = null;
  dragFromHandle = false;
  document.querySelectorAll('.task-item').forEach(el => { el.classList.remove('dragging'); el.classList.remove('drag-over'); });
}

// ────────── MOBILE ──────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

// ────────── INIT ──────────
async function init() {
  const { data: { session } } = await _sb.auth.getSession();
  if (!session) { window.location.href = '../login.html'; return; }
  _uid = session.user.id;
  VG_THEME.sync();
  await loadAll();
  renderSidebar();
  renderTasks();
  renderTagFilterMenu();
}

init();

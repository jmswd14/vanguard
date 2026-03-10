// ── NOTIFICATION INBOX — shared across all pages ──────────────────────────────
// Requires: window.supabaseClient (loaded before this script)
// Injects: notification panel HTML into <body>
// Exposes: toggleNotifPanel() globally

(function () {
  const DB = window.supabaseClient;
  let currentUserId = null;
  let panelOpen = false;
  let notifications = [];

  // ── INJECT PANEL HTML ──────────────────────────────────────────────────────

  // Fix 5 — create scrim and panel as separate elements, no fragile double-append
  function injectPanel() {
    const scrim = document.createElement('div');
    scrim.className = 'notif-scrim';
    scrim.id = 'notif-scrim';
    scrim.onclick = function () { window.closeNotifPanel(); };

    const panel = document.createElement('div');
    panel.className = 'notif-panel';
    panel.id = 'notif-panel';
    panel.innerHTML = `
      <div class="notif-panel-header">
        <span class="notif-panel-title">Notifications</span>
        <button class="notif-mark-all-btn" onclick="markAllNotifsRead()">Mark all read</button>
        <button class="notif-panel-close" onclick="closeNotifPanel()">×</button>
      </div>
      <div class="notif-list" id="notif-list">
        <div class="notif-empty">Loading...</div>
      </div>`;

    document.body.appendChild(scrim);
    document.body.appendChild(panel);
  }

  // ── INIT ──────────────────────────────────────────────────────────────────

  async function init() {
    injectPanel();

    const { data: { session } } = await DB.auth.getSession();
    if (!session) return;
    currentUserId = session.user.id;

    await refreshBadge();

    // Real-time: update badge when new notifications arrive
    DB.channel('notif-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUserId}`,
      }, () => refreshBadge())
      .subscribe();
  }

  async function refreshBadge() {
    if (!currentUserId) return;
    const { count } = await DB.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUserId)
      .eq('read', false);

    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (count && count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // ── OPEN / CLOSE ──────────────────────────────────────────────────────────

  window.toggleNotifPanel = function () {
    if (panelOpen) closeNotifPanel();
    else openNotifPanel();
  };

  window.closeNotifPanel = function () {
    panelOpen = false;
    document.getElementById('notif-panel')?.classList.remove('open');
    document.getElementById('notif-scrim')?.classList.remove('open');
  };

  function openNotifPanel() {
    // Collapse left sidebar if it is currently expanded
    const app = document.querySelector('.app');
    const leftSidebar = document.querySelector('.left-sidebar');
    if (app && !app.classList.contains('ls-collapsed')) {
      app.classList.add('ls-collapsed');
      if (leftSidebar) leftSidebar.classList.add('ls-collapsed');
      localStorage.setItem('vg-ls-collapsed', 'true');
    }

    panelOpen = true;
    document.getElementById('notif-panel')?.classList.add('open');
    document.getElementById('notif-scrim')?.classList.add('open');
    loadNotifications();
  }

  // ── LOAD + RENDER ──────────────────────────────────────────────────────────

  async function loadNotifications() {
    if (!currentUserId) return;
    const list = document.getElementById('notif-list');
    list.innerHTML = '<div class="notif-empty">Loading...</div>';

    // Fix 4 — handle query errors explicitly
    const { data, error } = await DB.from('notifications')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[notifications] Failed to load notifications:', error);
      list.innerHTML = '<div class="notif-empty">Could not load notifications</div>';
      return;
    }

    notifications = data || [];
    renderList();
    await refreshBadge();
  }

  function renderList() {
    const list = document.getElementById('notif-list');
    if (!notifications.length) {
      list.innerHTML = '<div class="notif-empty">You\'re all caught up ✓</div>';
      return;
    }
    list.innerHTML = notifications.map(n => renderItem(n)).join('');
  }

  // Fix 3 — keys match the actual type strings sent by the cron job
  const TYPE_ICONS = {
    task_due_today:    '☑',
    task_overdue:      '⚠',
    habit_checkin:     '◉',
    journal_prompt:    '✦',
    finance_asset_due: '◈',
    system:            '⊞',
  };

  function renderItem(n) {
    const icon = TYPE_ICONS[n.type] || '◎';
    const time = timeAgo(new Date(n.created_at));
    const unreadClass = n.read ? '' : 'unread';
    const link = n.link ? `onclick="handleNotifClick('${n.id}','${escAttr(n.link)}')"` : `onclick="markNotifRead('${n.id}')"`;
    return `
      <div class="notif-item ${unreadClass}" ${link}>
        <div class="notif-item-icon">${icon}</div>
        <div class="notif-item-body">
          <div class="notif-item-title">${escHtml(n.title)}</div>
          <div class="notif-item-msg">${escHtml(n.message)}</div>
          <div class="notif-item-time">${time}</div>
        </div>
        ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
      </div>`;
  }

  window.handleNotifClick = async function (id, link) {
    await markNotifRead(id);
    window.location.href = link;
  };

  window.markNotifRead = async function (id) {
    await DB.from('notifications').update({ read: true }).eq('id', id).eq('user_id', currentUserId);
    const n = notifications.find(x => x.id === id);
    if (n) n.read = true;
    renderList();
    await refreshBadge();
  };

  window.markAllNotifsRead = async function () {
    await DB.from('notifications').update({ read: true })
      .eq('user_id', currentUserId).eq('read', false);
    notifications.forEach(n => n.read = true);
    renderList();
    await refreshBadge();
  };

  // ── UTILS ──────────────────────────────────────────────────────────────────

  function timeAgo(date) {
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60)   return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function escAttr(s) {
    return String(s ?? '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  // ── KICK OFF ────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

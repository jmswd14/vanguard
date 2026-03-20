// ── MOTHERBOARD CHAT — self-contained floating AI assistant ──────────────────
(function () {
  'use strict';

  // ── CSS ────────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* Floating button */
    #mb-chat-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 46px;
      height: 46px;
      background: var(--bg, #000);
      border: 1px solid var(--retro-c1, #00FF41);
      color: var(--retro-c1, #00FF41);
      font-size: 20px;
      cursor: pointer;
      z-index: 9000;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, box-shadow 0.15s;
      font-family: var(--font-sans, 'Share Tech Mono', monospace);
      box-shadow: 0 0 0 0 var(--retro-c1, #00FF41);
    }
    #mb-chat-fab:hover {
      background: var(--retro-c1, #00FF41);
      color: #000;
      box-shadow: 0 0 16px rgba(0,255,65,0.25);
    }
    #mb-chat-fab.open {
      background: var(--retro-c1, #00FF41);
      color: #000;
    }

    /* Backdrop */
    #mb-chat-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 9001;
    }
    #mb-chat-backdrop.open { display: block; }

    /* Panel */
    #mb-chat-panel {
      position: fixed;
      top: 0;
      right: -720px;
      width: 720px;
      max-width: 100vw;
      height: 100vh;
      background: var(--bg, #000);
      border-left: 1px solid var(--border, #1C1C1C);
      z-index: 9002;
      display: flex;
      flex-direction: column;
      transition: right 0.25s cubic-bezier(0.4,0,0.2,1);
      font-family: var(--font-sans, 'Share Tech Mono', monospace);
    }
    #mb-chat-panel.open { right: 0; }

    /* Panel inner layout */
    .mb-chat-inner {
      display: flex;
      height: 100%;
      overflow: hidden;
    }

    /* ── LEFT: conversation list ── */
    .mb-chat-sidebar {
      width: 210px;
      flex-shrink: 0;
      border-right: 1px solid var(--border, #1C1C1C);
      display: flex;
      flex-direction: column;
      background: var(--surface, #0A0A0A);
    }
    .mb-chat-sidebar-header {
      padding: 14px 12px 10px;
      border-bottom: 1px solid var(--border, #1C1C1C);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .mb-chat-sidebar-title {
      font-size: 10px;
      letter-spacing: 0.12em;
      color: var(--text-muted, var(--retro-c1, #00FF41));
      opacity: 0.5;
      text-transform: uppercase;
    }
    .mb-chat-new-btn {
      background: none;
      border: 1px solid var(--border2, #222);
      color: var(--retro-c1, #00FF41);
      font-size: 16px;
      width: 24px;
      height: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-sans, monospace);
      transition: background 0.15s, color 0.15s;
      line-height: 1;
    }
    .mb-chat-new-btn:hover { background: var(--retro-c1, #00FF41); color: #000; }

    .mb-chat-conv-list {
      flex: 1;
      overflow-y: auto;
      padding: 6px 0;
    }
    .mb-chat-conv-list::-webkit-scrollbar { width: 3px; }
    .mb-chat-conv-list::-webkit-scrollbar-thumb { background: var(--border2, #222); }

    .mb-conv-item {
      padding: 8px 12px;
      cursor: pointer;
      border-left: 2px solid transparent;
      transition: background 0.1s, border-color 0.1s;
      position: relative;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .mb-conv-item:hover { background: var(--surface2, #111); }
    .mb-conv-item.active {
      border-left-color: var(--retro-c1, #00FF41);
      background: var(--surface2, #111);
    }
    .mb-conv-item-text {
      flex: 1;
      min-width: 0;
    }
    .mb-conv-title {
      font-size: 11px;
      color: var(--text, var(--retro-c1, #00FF41));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
    .mb-conv-date {
      font-size: 9px;
      color: var(--text-muted, var(--retro-c1, #00FF41));
      opacity: 0.4;
      display: block;
      margin-top: 1px;
    }
    .mb-conv-delete {
      background: none;
      border: none;
      color: var(--text-muted, #555);
      font-size: 13px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s, color 0.15s;
      padding: 2px 4px;
      flex-shrink: 0;
      font-family: var(--font-sans, monospace);
    }
    .mb-conv-item:hover .mb-conv-delete { opacity: 1; }
    .mb-conv-delete:hover { color: #E03030; }

    .mb-chat-sidebar-footer {
      padding: 10px 12px;
      border-top: 1px solid var(--border, #1C1C1C);
    }
    .mb-history-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 10px;
      color: var(--text-muted, var(--retro-c1, #00FF41));
      opacity: 0.6;
      user-select: none;
    }
    .mb-history-toggle input[type=checkbox] { cursor: pointer; accent-color: var(--retro-c1, #00FF41); }

    /* ── RIGHT: chat area ── */
    .mb-chat-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .mb-chat-header {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border, #1C1C1C);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .mb-chat-header-title {
      font-size: 11px;
      color: var(--retro-c1, #00FF41);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.7;
    }
    .mb-chat-close {
      background: none;
      border: none;
      color: var(--text-muted, #555);
      font-size: 18px;
      cursor: pointer;
      font-family: var(--font-sans, monospace);
      transition: color 0.15s;
      padding: 2px 6px;
    }
    .mb-chat-close:hover { color: var(--retro-c1, #00FF41); }

    /* Messages */
    .mb-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .mb-chat-messages::-webkit-scrollbar { width: 3px; }
    .mb-chat-messages::-webkit-scrollbar-thumb { background: var(--border2, #222); }

    .mb-msg {
      display: flex;
      flex-direction: column;
      max-width: 88%;
    }
    .mb-msg.user { align-self: flex-end; align-items: flex-end; }
    .mb-msg.assistant { align-self: flex-start; align-items: flex-start; }

    .mb-msg-bubble {
      padding: 10px 14px;
      font-size: 13px;
      line-height: 1.6;
      border: 1px solid var(--border, #1C1C1C);
    }
    .mb-msg.user .mb-msg-bubble {
      background: var(--surface2, #111);
      border-color: var(--border2, #222);
      color: var(--text, var(--retro-c1, #00FF41));
    }
    .mb-msg.assistant .mb-msg-bubble {
      background: var(--surface, #0A0A0A);
      color: var(--text, var(--retro-c1, #00FF41));
      border-left: 2px solid var(--retro-c1, #00FF41);
    }
    .mb-msg-bubble p { margin: 0 0 8px; }
    .mb-msg-bubble p:last-child { margin: 0; }
    .mb-msg-bubble code {
      background: var(--surface2, #111);
      padding: 1px 5px;
      font-family: var(--font-sans, monospace);
      font-size: 12px;
      border: 1px solid var(--border, #1C1C1C);
    }
    .mb-msg-bubble pre {
      background: var(--surface2, #111);
      padding: 10px;
      overflow-x: auto;
      border: 1px solid var(--border, #1C1C1C);
      margin: 8px 0 0;
    }
    .mb-msg-bubble pre code { background: none; border: none; padding: 0; }
    .mb-msg-bubble strong { color: var(--retro-c2, #FF6600); font-weight: normal; }
    .mb-msg-bubble ul, .mb-msg-bubble ol { margin: 4px 0; padding-left: 18px; }
    .mb-msg-bubble li { margin-bottom: 3px; }

    .mb-msg-time {
      font-size: 9px;
      color: var(--text-muted, #555);
      opacity: 0.4;
      margin-top: 4px;
    }

    /* Thinking indicator */
    .mb-thinking {
      display: flex;
      gap: 5px;
      align-items: center;
      padding: 10px 14px;
      border: 1px solid var(--border, #1C1C1C);
      border-left: 2px solid var(--retro-c1, #00FF41);
      background: var(--surface, #0A0A0A);
      align-self: flex-start;
    }
    .mb-thinking-dot {
      width: 5px;
      height: 5px;
      background: var(--retro-c1, #00FF41);
      animation: mb-pulse 1.2s ease-in-out infinite;
    }
    .mb-thinking-dot:nth-child(2) { animation-delay: 0.2s; }
    .mb-thinking-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes mb-pulse {
      0%, 80%, 100% { opacity: 0.2; }
      40% { opacity: 1; }
    }

    /* Empty state */
    .mb-chat-empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 40px;
      text-align: center;
    }
    .mb-chat-empty-icon {
      font-size: 32px;
      color: var(--retro-c1, #00FF41);
      opacity: 0.3;
    }
    .mb-chat-empty-text {
      font-size: 12px;
      color: var(--text-muted, #555);
      opacity: 0.5;
      line-height: 1.6;
    }

    /* Input area */
    .mb-chat-input-wrap {
      padding: 14px 16px;
      border-top: 1px solid var(--border, #1C1C1C);
      display: flex;
      gap: 8px;
      flex-shrink: 0;
      background: var(--bg, #000);
    }
    .mb-chat-input {
      flex: 1;
      background: var(--surface, #0A0A0A);
      border: 1px solid var(--border2, #222);
      color: var(--text, var(--retro-c1, #00FF41));
      font-family: var(--font-sans, 'Share Tech Mono', monospace);
      font-size: 13px;
      padding: 10px 12px;
      resize: none;
      outline: none;
      min-height: 42px;
      max-height: 120px;
      transition: border-color 0.15s;
      line-height: 1.5;
    }
    .mb-chat-input::placeholder { color: var(--text-muted, #555); opacity: 0.5; }
    .mb-chat-input:focus { border-color: var(--retro-c1, #00FF41); }

    .mb-chat-send {
      background: var(--retro-c1, #00FF41);
      border: none;
      color: #000;
      width: 42px;
      height: 42px;
      font-size: 16px;
      cursor: pointer;
      font-family: var(--font-sans, monospace);
      transition: opacity 0.15s;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mb-chat-send:hover { opacity: 0.85; }
    .mb-chat-send:disabled { opacity: 0.3; cursor: not-allowed; }

    /* Mobile */
    @media (max-width: 600px) {
      #mb-chat-panel { width: 100vw; }
      #mb-chat-fab { bottom: 16px; right: 16px; width: 42px; height: 42px; font-size: 18px; }
      .mb-chat-sidebar { width: 170px; }
    }
  `;
  document.head.appendChild(style);

  // ── HTML ───────────────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.innerHTML = `
    <button id="mb-chat-fab" title="AI Assistant" onclick="mbChatToggle()">✦</button>
    <div id="mb-chat-backdrop" onclick="mbChatClose()"></div>
    <div id="mb-chat-panel">
      <div class="mb-chat-inner">
        <!-- Conversation sidebar -->
        <div class="mb-chat-sidebar">
          <div class="mb-chat-sidebar-header">
            <span class="mb-chat-sidebar-title">Chats</span>
            <button class="mb-chat-new-btn" onclick="mbChatNewConversation()" title="New chat">+</button>
          </div>
          <div class="mb-chat-conv-list" id="mb-conv-list"></div>
          <div class="mb-chat-sidebar-footer">
            <label class="mb-history-toggle">
              <input type="checkbox" id="mb-include-history" onchange="mbIncludeHistoryChanged()">
              Reference all past chats
            </label>
          </div>
        </div>
        <!-- Chat area -->
        <div class="mb-chat-main">
          <div class="mb-chat-header">
            <span class="mb-chat-header-title" id="mb-chat-header-title">AI Assistant</span>
            <button class="mb-chat-close" onclick="mbChatClose()">✕</button>
          </div>
          <div class="mb-chat-messages" id="mb-chat-messages">
            <div class="mb-chat-empty">
              <div class="mb-chat-empty-icon">✦</div>
              <div class="mb-chat-empty-text">Ask me anything about your tasks, habits, schedule, or anything else.</div>
            </div>
          </div>
          <div class="mb-chat-input-wrap">
            <textarea class="mb-chat-input" id="mb-chat-input" placeholder="Ask anything…" rows="1"
              onkeydown="mbChatKeydown(event)" oninput="mbChatAutoResize(this)"></textarea>
            <button class="mb-chat-send" id="mb-chat-send" onclick="mbChatSend()">▶</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // ── STATE ──────────────────────────────────────────────────────────────────
  let _sb = null;
  let _user = null;
  let _conversations = [];
  let _activeConvId = null;
  let _messages = []; // current conversation messages
  let _streaming = false;
  let _includeHistory = false;

  // ── INIT ───────────────────────────────────────────────────────────────────
  async function mbInit() {
    // Wait for supabase client to be available
    let attempts = 0;
    while (!window.supabaseClient && attempts < 20) {
      await new Promise(r => setTimeout(r, 200));
      attempts++;
    }
    if (!window.supabaseClient) return;
    _sb = window.supabaseClient;
    const { data: { user } } = await _sb.auth.getUser();
    if (!user) return;
    _user = user;
    await mbLoadConversations();
  }

  async function mbLoadConversations() {
    if (!_sb || !_user) return;
    const { data } = await _sb.from('chat_conversations')
      .select('*').eq('user_id', _user.id)
      .order('updated_at', { ascending: false }).limit(50);
    _conversations = data || [];
    mbRenderConvList();
  }

  // ── PANEL TOGGLE ───────────────────────────────────────────────────────────
  window.mbChatToggle = function () {
    const panel = document.getElementById('mb-chat-panel');
    const fab = document.getElementById('mb-chat-fab');
    const backdrop = document.getElementById('mb-chat-backdrop');
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
      fab.classList.remove('open');
      backdrop.classList.remove('open');
    } else {
      panel.classList.add('open');
      fab.classList.add('open');
      backdrop.classList.add('open');
      if (!_user) mbInit();
      // Auto-open most recent conversation or start fresh
      if (!_activeConvId && _conversations.length > 0) {
        mbLoadConversation(_conversations[0].id);
      }
      setTimeout(() => document.getElementById('mb-chat-input')?.focus(), 300);
    }
  };

  window.mbChatClose = function () {
    document.getElementById('mb-chat-panel').classList.remove('open');
    document.getElementById('mb-chat-fab').classList.remove('open');
    document.getElementById('mb-chat-backdrop').classList.remove('open');
  };

  // ── CONVERSATION LIST ──────────────────────────────────────────────────────
  function mbRenderConvList() {
    const list = document.getElementById('mb-conv-list');
    if (!list) return;
    if (!_conversations.length) {
      list.innerHTML = `<div style="padding:16px 12px;font-size:11px;color:var(--text-muted,#555);opacity:0.5;">No conversations yet</div>`;
      return;
    }
    list.innerHTML = _conversations.map(c => {
      const date = mbTimeAgo(c.updated_at);
      const isActive = c.id === _activeConvId;
      return `
        <div class="mb-conv-item${isActive ? ' active' : ''}" onclick="mbLoadConversation('${c.id}')">
          <div class="mb-conv-item-text">
            <span class="mb-conv-title">${mbEsc(c.title)}</span>
            <span class="mb-conv-date">${date}</span>
          </div>
          <button class="mb-conv-delete" onclick="event.stopPropagation();mbDeleteConversation('${c.id}')" title="Delete">×</button>
        </div>
      `;
    }).join('');
  }

  window.mbLoadConversation = async function (id) {
    _activeConvId = id;
    const conv = _conversations.find(c => c.id === id);
    document.getElementById('mb-chat-header-title').textContent = conv?.title || 'AI Assistant';
    mbRenderConvList();

    const { data } = await _sb.from('chat_messages')
      .select('*').eq('conversation_id', id)
      .order('created_at', { ascending: true });
    _messages = data || [];
    mbRenderMessages();
  };

  window.mbChatNewConversation = function () {
    _activeConvId = null;
    _messages = [];
    document.getElementById('mb-chat-header-title').textContent = 'New Chat';
    mbRenderMessages();
    mbRenderConvList();
    document.getElementById('mb-chat-input')?.focus();
  };

  window.mbDeleteConversation = async function (id) {
    if (!_sb || !_user) return;
    _conversations = _conversations.filter(c => c.id !== id);
    if (_activeConvId === id) {
      _activeConvId = null;
      _messages = [];
      document.getElementById('mb-chat-header-title').textContent = 'New Chat';
    }
    mbRenderConvList();
    mbRenderMessages();
    await _sb.from('chat_conversations').delete().eq('id', id).eq('user_id', _user.id);
  };

  window.mbIncludeHistoryChanged = function () {
    _includeHistory = document.getElementById('mb-include-history')?.checked || false;
  };

  // ── MESSAGES ───────────────────────────────────────────────────────────────
  function mbRenderMessages() {
    const el = document.getElementById('mb-chat-messages');
    if (!el) return;
    if (!_messages.length) {
      el.innerHTML = `
        <div class="mb-chat-empty">
          <div class="mb-chat-empty-icon">✦</div>
          <div class="mb-chat-empty-text">Ask me anything about your tasks, habits, schedule, or anything else.</div>
        </div>
      `;
      return;
    }
    el.innerHTML = _messages.map(m => mbRenderMessage(m)).join('');
    el.scrollTop = el.scrollHeight;
  }

  function mbRenderMessage(m) {
    const time = mbTimeAgo(m.created_at);
    const html = mbMarkdown(m.content);
    return `
      <div class="mb-msg ${m.role}">
        <div class="mb-msg-bubble">${html}</div>
        <div class="mb-msg-time">${time}</div>
      </div>
    `;
  }

  // ── SEND ───────────────────────────────────────────────────────────────────
  window.mbChatSend = async function () {
    if (_streaming) return;
    const input = document.getElementById('mb-chat-input');
    const content = input.value.trim();
    if (!content) return;
    if (!_user) { await mbInit(); if (!_user) return; }

    input.value = '';
    mbChatAutoResize(input);
    _streaming = true;
    document.getElementById('mb-chat-send').disabled = true;

    // Create conversation if needed
    if (!_activeConvId) {
      const newId = crypto.randomUUID();
      const title = content.slice(0, 45) + (content.length > 45 ? '…' : '');
      const { data } = await _sb.from('chat_conversations').insert({
        id: newId, user_id: _user.id, title,
        updated_at: new Date().toISOString(),
      }).select().single();
      if (data) {
        _activeConvId = data.id;
        _conversations.unshift(data);
        document.getElementById('mb-chat-header-title').textContent = data.title;
        mbRenderConvList();
      }
    }

    // Save user message
    const userMsg = {
      id: crypto.randomUUID(),
      conversation_id: _activeConvId,
      user_id: _user.id,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    _messages.push(userMsg);
    mbRenderMessages();
    await _sb.from('chat_messages').insert(userMsg);

    // Show thinking indicator
    const msgEl = document.getElementById('mb-chat-messages');
    const thinking = document.createElement('div');
    thinking.className = 'mb-thinking';
    thinking.id = 'mb-thinking';
    thinking.innerHTML = `<div class="mb-thinking-dot"></div><div class="mb-thinking-dot"></div><div class="mb-thinking-dot"></div>`;
    msgEl.appendChild(thinking);
    msgEl.scrollTop = msgEl.scrollHeight;

    // Build messages array for API (last 20 messages)
    const apiMessages = _messages.slice(-20).map(m => ({ role: m.role, content: m.content }));

    try {
      const { data: { session } } = await _sb.auth.getSession();
      const supabaseUrl = window.SUPABASE_URL;

      const res = await fetch(`${supabaseUrl}/functions/v1/chat-with-claude`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': window.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ messages: apiMessages, include_history: _includeHistory }),
      });

      thinking.remove();

      if (!res.ok) {
        const err = await res.text();
        mbAppendError('Error: ' + err);
        _streaming = false;
        document.getElementById('mb-chat-send').disabled = false;
        return;
      }

      // Stream response
      const assistantMsgEl = document.createElement('div');
      assistantMsgEl.className = 'mb-msg assistant';
      assistantMsgEl.innerHTML = `<div class="mb-msg-bubble" id="mb-streaming-bubble"></div>`;
      msgEl.appendChild(assistantMsgEl);

      const bubble = document.getElementById('mb-streaming-bubble');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const evt = JSON.parse(data);
            // Gemini format
            const text = evt.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              fullText += text;
              bubble.innerHTML = mbMarkdown(fullText);
              msgEl.scrollTop = msgEl.scrollHeight;
            }
          } catch {}
        }
      }

      // Save assistant message
      const assistantMsg = {
        id: crypto.randomUUID(),
        conversation_id: _activeConvId,
        user_id: _user.id,
        role: 'assistant',
        content: fullText,
        created_at: new Date().toISOString(),
      };
      _messages.push(assistantMsg);
      // Add time label
      const timeEl = document.createElement('div');
      timeEl.className = 'mb-msg-time';
      timeEl.textContent = 'just now';
      assistantMsgEl.appendChild(timeEl);

      await _sb.from('chat_messages').insert(assistantMsg);

      // Update conversation updated_at
      await _sb.from('chat_conversations').update({ updated_at: new Date().toISOString() })
        .eq('id', _activeConvId);
      const conv = _conversations.find(c => c.id === _activeConvId);
      if (conv) { conv.updated_at = new Date().toISOString(); mbRenderConvList(); }

    } catch (e) {
      document.getElementById('mb-thinking')?.remove();
      mbAppendError('Connection error. Please try again.');
    }

    _streaming = false;
    document.getElementById('mb-chat-send').disabled = false;
    msgEl.scrollTop = msgEl.scrollHeight;
  };

  function mbAppendError(msg) {
    const msgEl = document.getElementById('mb-chat-messages');
    const el = document.createElement('div');
    el.className = 'mb-msg assistant';
    el.innerHTML = `<div class="mb-msg-bubble" style="border-left-color:#E03030;color:#E03030;">${mbEsc(msg)}</div>`;
    msgEl.appendChild(el);
    msgEl.scrollTop = msgEl.scrollHeight;
  }

  // ── KEYBOARD ───────────────────────────────────────────────────────────────
  window.mbChatKeydown = function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      mbChatSend();
    }
  };

  window.mbChatAutoResize = function (el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // ── UTILITIES ──────────────────────────────────────────────────────────────
  function mbEsc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function mbTimeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Minimal markdown: bold, code blocks, inline code, bullet lists
  function mbMarkdown(text) {
    if (!text) return '';
    let s = mbEsc(text);
    // Code blocks
    s = s.replace(/```[\s\S]*?```/g, m => {
      const code = m.slice(3, -3).replace(/^[a-z]*\n/, '');
      return `<pre><code>${code}</code></pre>`;
    });
    // Inline code
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Bullet lists
    s = s.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
    s = s.replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>');
    // Numbered lists
    s = s.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    // Paragraphs
    s = s.split(/\n\n+/).map(p => {
      if (p.startsWith('<ul>') || p.startsWith('<pre>') || p.startsWith('<ol>')) return p;
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');
    return s;
  }

  // ── KEYBOARD SHORTCUT ──────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      mbChatToggle();
    }
  });

  // ── BOOT ───────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mbInit);
  } else {
    mbInit();
  }
})();

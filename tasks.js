(function () {
  'use strict';
  const S = window.StarkSystem;
  if (!S || window.StarkTasks) return;

  const store = window.StarkWorkspace?.localStorage || window.localStorage;
  const MAIL_BRIDGE_KEY = 'mk97.mail.threads.v1';
  const REMINDER_SEEN_KEY = 'stark.tasks.remindersSeen.v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const states = ['OPEN', 'IN_PROGRESS', 'DONE'];
  const priorities = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'];
  const access = () => window.StarkSystemCloud?.getAccess?.() || {};
  const C = () => window.MKCopilotCore || null;

  const DEFAULT_ROSTER = [
    { id: 'usr_manoj', name: 'Manoj Manne', email: 'supply.chain@mk97.com', role: 'Supply Chain Director', avatar: 'MM', color: '#087f78' },
    { id: 'usr_elena', name: 'Elena Rostova', email: 'elena.rostova@mk97.com', role: 'Procurement Lead', avatar: 'ER', color: '#2563eb' },
    { id: 'usr_marcus', name: 'Marcus Vance', email: 'marcus.vance@mk97.com', role: 'Logistics & 3PL Manager', avatar: 'MV', color: '#7c3aed' },
    { id: 'usr_sarah', name: 'Sarah Jenkins', email: 'sarah.jenkins@mk97.com', role: 'Order Operations Lead', avatar: 'SJ', color: '#d97706' },
    { id: 'usr_david', name: 'David Kim', email: 'david.kim@mk97.com', role: 'Inventory & Planning Analyst', avatar: 'DK', color: '#0284c7' },
    { id: 'usr_priya', name: 'Priya Nair', email: 'priya.nair@mk97.com', role: 'Carrier & Dispatch Coordinator', avatar: 'PN', color: '#059669' }
  ];

  // Baseline Mail inbox threads used only when mail.html hasn't written its bridge snapshot yet
  const BASELINE_MAIL_THREADS = [
    {
      id: 'thread-1',
      senderName: 'James Smith',
      senderCompany: 'Global Parts Co.',
      senderEmail: 'james.smith@globalpartsco.com',
      to: 'supply.chain@mk97.com',
      subject: 'PO #87366 - Confirmed for Shipment',
      timestamp: '10:24 AM',
      unread: true,
      folder: 'inbox',
      direction: 'inbound',
      snippet: 'The staging bay #4 is allocated and ready...',
      body: 'Hi James, Please find the confirmation for PO #87366. The staging bay #4 is allocated and ready for shipment.',
      shipmentDetails: { poNumber: '87366', trackingNumber: 'DHL4567823', carrier: 'DHL Express', status: 'In Transit' },
      related: { poNumber: '#87366', vendor: 'Global Parts Co.', tracking: 'DHL4567823' }
    },
    {
      id: 'thread-2',
      senderName: 'Global Parts Co.',
      senderCompany: 'Global Parts Co.',
      senderEmail: 'orders@globalpartsco.com',
      to: 'supply.chain@mk97.com',
      subject: 'Re: 3PL Order – Tracking Request',
      timestamp: '9:18 AM',
      unread: true,
      folder: 'inbox',
      direction: 'inbound',
      snippet: 'Please provide the tracking number for the outbound 3PL transfer consignment. Staging bays require registration before midday.',
      body: 'Hello Support,\n\nPlease provide the tracking number for the outbound 3PL transfer consignment. Staging bays require registration before midday.\n\nThank you,\nGlobal Parts Dispatch Team',
      related: { poNumber: '#3PL-GP-918', vendor: 'Global Parts Co.', tracking: 'Pending Dispatch' }
    },
    {
      id: 'thread-6',
      senderName: 'Vince Inc.',
      senderCompany: 'Vince Inc.',
      senderEmail: 'vince.support@vinceinc.com',
      to: 'supply.chain@mk97.com',
      subject: '3PL Orders – Priority',
      timestamp: 'Yesterday',
      unread: true,
      folder: 'inbox',
      direction: 'inbound',
      snippet: 'Please find the 3PL order file. Need tracking by EOD.',
      body: 'Hi Manoj,\n\nPlease find the 3PL order file attached. Need tracking by EOD to finalize customer dispatch slots.',
      related: { poNumber: '#VI-PRIORITY-91', vendor: 'Vince Inc.', tracking: 'Need EOD' }
    }
  ];

  let viewMode = 'priority'; // priority | board | people | autoresolved
  let filter = 'active';     // active | auto | team | overdue | done | all
  let assigneeFilter = 'all';
  let query = '';
  let selected = '';
  let timer;
  let syncInProgress = false;
  let lastSyncSig = '';

  const tasks = () => S.getState().tasks || [];

  function when(value) {
    if (!value) return 'Not set';
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return 'Not set';
    return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  function relTime(value) {
    if (!value) return '';
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return '';
    const diffMin = Math.round((ms - Date.now()) / 60000);
    const absMin = Math.abs(diffMin);
    if (absMin < 1) return 'Just now';
    if (absMin < 60) return diffMin < 0 ? `${absMin}m ago` : `in ${absMin}m`;
    const hrs = Math.round(absMin / 60);
    if (hrs < 48) return diffMin < 0 ? `${hrs}h ago` : `in ${hrs}h`;
    const days = Math.round(hrs / 24);
    return diffMin < 0 ? `${days}d ago` : `in ${days}d`;
  }

  function iso(value) {
    if (!value) return '';
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) throw new Error('Choose a valid date and time.');
    return d.toISOString();
  }

  function localValue(value) {
    if (!value) return '';
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function localISO(value) {
    if (!value) return '';
    const result = iso(value);
    if (localValue(result) !== value) throw new Error('This local time does not exist in your time zone. Choose another time.');
    return result;
  }

  function initials(name) {
    const clean = String(name || '').trim();
    if (!clean) return 'MK';
    const parts = clean.split(/[\s@._-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }

  function colorForName(name) {
    const palette = ['#087f78', '#2563eb', '#7c3aed', '#d97706', '#0284c7', '#059669', '#db2777', '#4f46e5'];
    let h = 0;
    const s = String(name || 'MK');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }

  function getTeamRoster() {
    const base = (C()?.DEFAULT_TEAM_ROSTER || DEFAULT_ROSTER).map(m => ({ ...m }));
    const seen = new Set(base.map(m => (m.email || m.id).toLowerCase()));
    for (const t of tasks()) {
      for (const a of t.assignees || []) {
        const key = String(a.email || a.name || a.id || '').toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        base.push({
          id: a.id || 'usr_' + key.replace(/[^a-z0-9]/g, ''),
          name: a.name || a.email,
          email: a.email || '',
          role: a.role || 'Team Member',
          avatar: a.avatar || initials(a.name || a.email),
          color: a.color || colorForName(a.name || a.email)
        });
      }
    }
    return base;
  }

  function getMailThreads() {
    if (window.StarkMail?.getThreads) {
      const live = window.StarkMail.getThreads();
      if (Array.isArray(live) && live.length) return live;
    }
    try {
      const saved = JSON.parse(store?.getItem(MAIL_BRIDGE_KEY) || 'null');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (_) {}
    return BASELINE_MAIL_THREADS.map(t => ({ ...t, related: t.related ? { ...t.related } : undefined, shipmentDetails: t.shipmentDetails ? { ...t.shipmentDetails } : undefined }));
  }

  function saveMailThreadsToBridge(list) {
    try {
      store?.setItem(MAIL_BRIDGE_KEY, JSON.stringify(list.slice(0, 80)));
      window.dispatchEvent(new CustomEvent('mk97:mail-updated', { detail: { count: list.length } }));
    } catch (_) {}
  }

  function normalizeAssignees(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const raw of list) {
      if (!raw) continue;
      const name = String(raw.name || raw.email || '').trim().slice(0, 80);
      const email = String(raw.email || '').trim().slice(0, 120);
      if (!name && !email) continue;
      const key = (email || name).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: raw.id || 'usr_' + key.replace(/[^a-z0-9]+/g, '_').slice(0, 24),
        name: name || email,
        email,
        role: String(raw.role || 'Collaborator').slice(0, 60),
        avatar: raw.avatar || initials(name || email),
        color: raw.color || colorForName(name || email)
      });
    }
    return out;
  }

  function analyzeTask(task) {
    const core = C();
    if (!core?.analyzeTaskImportance) {
      return { score: 45, tier: 'MEDIUM', category: task.category || 'GENERAL', references: [], reasons: ['MK Co-Pilot engine loading…'], recommendedAction: '', rank: null };
    }
    return core.analyzeTaskImportance(task, S.getState(), { mailThreads: getMailThreads() });
  }

  function analyzeAll() {
    const core = C();
    const all = tasks();
    if (!core?.prioritizeTasks) {
      return all.map((task, idx) => ({ task, analysis: { score: 40, tier: 'MEDIUM', category: task.category || 'GENERAL', references: [], reasons: [], recommendedAction: '', rank: task.status === 'DONE' ? null : idx + 1 } }));
    }
    return core.prioritizeTasks(all, S.getState(), { mailThreads: getMailThreads() });
  }

  function runCopilotSync(options = {}) {
    const core = C();
    if (!core?.reconcileAutonomousTasks || syncInProgress) return { created: [], resolved: [], summary: '' };
    const mails = getMailThreads();
    const state = S.getState();
    const sig = `${state.revision}|${mails.length}|${mails.map(m => `${m.id}:${m.direction || m.folder}:${m.related?.tracking || ''}:${m.shipmentDetails?.trackingNumber || ''}`).join(',')}`;
    if (options.silent && !options.force && !options.resetDismissed && sig === lastSyncSig) {
      return { created: [], resolved: [], summary: 'Already synchronized.' };
    }

    // Dry-run check first so we only commit a transaction when tasks actually change
    const preview = core.reconcileAutonomousTasks(JSON.parse(JSON.stringify(state)), mails, { dryRun: true, resetDismissed: options.resetDismissed });
    lastSyncSig = sig;
    if (!preview.created.length && !preview.resolved.length) {
      if (!options.silent) {
        window.StarkSystemUI?.notice('MK Co-Pilot scan complete — all Mail, Inventory, and 3PL signals are up to date.');
      }
      return preview;
    }

    syncInProgress = true;
    let result = preview;
    try {
      S.transaction('TASKS_COPILOT_SYNC', preview.summary.slice(0, 120), draft => {
        result = core.reconcileAutonomousTasks(draft, mails, { resetDismissed: options.resetDismissed });
      });
      const newState = S.getState();
      lastSyncSig = `${newState.revision}|${mails.length}|${mails.map(m => `${m.id}:${m.direction || m.folder}:${m.related?.tracking || ''}:${m.shipmentDetails?.trackingNumber || ''}`).join(',')}`;
    } finally {
      syncInProgress = false;
    }

    if (!options.silent || (options.notifyResolved && result.resolved.length)) {
      const parts = [];
      if (result.created.length) parts.push(`${result.created.length} task(s) auto-created`);
      if (result.resolved.length) parts.push(`${result.resolved.length} task(s) auto-resolved & cleared`);
      if (parts.length) window.StarkSystemUI?.notice('✨ MK Co-Pilot: ' + parts.join(' · '));
    }
    return result;
  }

  function save(input, id) {
    const title = String(input.title || '').trim();
    const notes = String(input.notes || '').trim();
    if (!title || title.length > 160) throw new Error('Enter a task title of 1–160 characters.');
    if (notes.length > 20000) throw new Error('Keep notes within 20,000 characters.');
    const dueAt = iso(input.dueAt);
    const reminderAt = iso(input.reminderAt);
    if (reminderAt && dueAt && reminderAt > dueAt) throw new Error('Set the reminder at or before the due time.');

    let requestedPriority = input.priority || 'NORMAL';
    if (requestedPriority === 'AUTO') {
      const probe = analyzeTask({ title, notes, dueAt, assignees: input.assignees || [], linkedMailId: input.linkedMailId || '' });
      requestedPriority = probe.tier === 'CRITICAL' ? 'CRITICAL' : probe.tier === 'HIGH' ? 'HIGH' : probe.tier === 'LOW' ? 'LOW' : 'NORMAL';
    }
    if (!priorities.includes(requestedPriority) || !states.includes(input.status || 'OPEN')) {
      throw new Error('Choose a valid task status and priority.');
    }

    const assignees = normalizeAssignees(input.assignees);
    let savedId;
    S.transaction(id ? 'TASK_UPDATED' : 'TASK_CREATED', title, state => {
      state.tasks ||= [];
      let task = id ? state.tasks.find(t => t.id === id) : null;
      if (id && !task) throw new Error('This task was removed. Refresh the page.');
      if ((input.expectedVersion !== undefined && (task?.version || 0) !== input.expectedVersion) || (input.expectedUpdatedAt && task?.updatedAt !== input.expectedUpdatedAt)) {
        throw new Error('This task changed in another tab. Reopen it before saving.');
      }
      if (reminderAt && reminderAt !== task?.reminderAt && new Date(reminderAt) <= new Date()) {
        throw new Error('Choose a future reminder time.');
      }
      const now = new Date().toISOString();
      if (!task) {
        task = {
          id: S.uid('task'),
          createdAt: now,
          createdBy: access().userId || 'local',
          ownerUserId: access().userId || 'local',
          comments: [],
          reminderLog: [],
          lastRemindedAt: '',
          assignees: []
        };
        state.tasks.push(task);
      }
      task.version = (task.version || 0) + 1;
      Object.assign(task, {
        title,
        notes,
        dueAt,
        reminderAt,
        priority: requestedPriority,
        status: input.status || 'OPEN',
        updatedAt: now
      });
      if (input.assignees !== undefined) task.assignees = assignees;
      if (input.category !== undefined) task.category = input.category;
      if (input.linkedMailId !== undefined) task.linkedMailId = input.linkedMailId;
      if (input.sourcePath !== undefined && input.sourcePath) task.sourcePath = input.sourcePath;
      if (input.orderId !== undefined) task.orderId = input.orderId;
      task.completedAt = task.status === 'DONE' ? (task.completedAt || now) : '';
      if (task.status !== 'DONE') {
        task.autoResolved = false;
        task.autoResolvedAt = '';
        task.autoResolvedReason = '';
      }
      savedId = task.id;
    });
    return savedId;
  }

  function addNote(id, text, expectedUpdatedAt, expectedVersion) {
    text = String(text || '').trim();
    if (!text || text.length > 5000) throw new Error('Enter a note of 1–5,000 characters.');
    S.transaction('TASK_NOTE_ADDED', id, state => {
      const task = (state.tasks || []).find(t => t.id === id);
      if (!task) throw new Error('Task not found.');
      if ((expectedVersion !== undefined && (task.version || 0) !== expectedVersion) || (expectedUpdatedAt && task.updatedAt !== expectedUpdatedAt)) {
        throw new Error('This task changed. Reopen it before adding a note.');
      }
      task.comments ||= [];
      if (task.comments.length >= 200) throw new Error('This task already has 200 notes. Edit its description instead.');
      task.version = (task.version || 0) + 1;
      task.updatedAt = new Date().toISOString();
      task.comments.push({ id: S.uid('note'), text, time: task.updatedAt, author: access().userId || 'Manoj Manne' });
    });
  }

  function setStatus(id, status) {
    S.transaction('TASK_STATUS_CHANGED', id, state => {
      const task = (state.tasks || []).find(t => t.id === id);
      if (!task || !states.includes(status)) throw new Error('Task not found.');
      task.version = (task.version || 0) + 1;
      task.status = status;
      task.updatedAt = new Date().toISOString();
      task.completedAt = status === 'DONE' ? task.updatedAt : '';
      if (status !== 'DONE') {
        task.autoResolved = false;
        task.autoResolvedAt = '';
        task.autoResolvedReason = '';
      }
    });
  }

  function remove(id) {
    S.transaction('TASK_REMOVED', id, state => {
      state.tasks ||= [];
      const idx = state.tasks.findIndex(t => t.id === id);
      if (idx < 0) return;
      const [removed] = state.tasks.splice(idx, 1);
      if (removed?.autoKey) {
        state.taskMeta ||= { dismissedAutoKeys: [] };
        if (!state.taskMeta.dismissedAutoKeys.includes(removed.autoKey)) {
          state.taskMeta.dismissedAutoKeys.push(removed.autoKey);
        }
      }
    });
    if (selected === id) selected = '';
  }

  function addAssigneeToTask(taskId, person) {
    const clean = normalizeAssignees([person])[0];
    if (!clean) return;
    S.transaction('TASK_ASSIGNEE_ADDED', clean.name, state => {
      const task = (state.tasks || []).find(t => t.id === taskId);
      if (!task) throw new Error('Task not found.');
      task.assignees ||= [];
      const key = (clean.email || clean.name).toLowerCase();
      if (!task.assignees.some(a => (a.email || a.name).toLowerCase() === key)) {
        task.assignees.push(clean);
        task.version = (task.version || 0) + 1;
        task.updatedAt = new Date().toISOString();
      }
    });
  }

  function removeAssigneeFromTask(taskId, personKey) {
    S.transaction('TASK_ASSIGNEE_REMOVED', personKey, state => {
      const task = (state.tasks || []).find(t => t.id === taskId);
      if (!task || !Array.isArray(task.assignees)) return;
      task.assignees = task.assignees.filter(a => (a.email || a.name || a.id).toLowerCase() !== String(personKey).toLowerCase());
      task.version = (task.version || 0) + 1;
      task.updatedAt = new Date().toISOString();
    });
  }

  function sendReminder(taskId, options = {}) {
    const task = tasks().find(t => t.id === taskId);
    if (!task) throw new Error('Task not found.');
    const recipients = normalizeAssignees(options.recipients && options.recipients.length ? options.recipients : (task.assignees?.length ? task.assignees : [DEFAULT_ROSTER[0]]));
    if (!recipients.length) throw new Error('Select at least one person to send the reminder to.');

    const analysis = analyzeTask(task);
    const subject = String(options.subject || `🔔 Task Reminder: ${task.title}`).trim().slice(0, 180);
    const message = String(options.message || `Reminder for "${task.title}" (MK Priority: ${analysis.tier} · Score ${analysis.score}/100${task.dueAt ? ' · Due ' + when(task.dueAt) : ''}). Please review and update status in MK97 Tasks.`).trim().slice(0, 4000);
    const now = new Date().toISOString();
    const logEntry = {
      id: S.uid('rem'),
      sentAt: now,
      recipients: recipients.map(r => ({ name: r.name, email: r.email, avatar: r.avatar, color: r.color })),
      subject,
      message,
      channel: 'MK97 Mail + Workspace'
    };

    S.transaction('TASK_REMINDER_SENT', task.title.slice(0, 120), state => {
      const t = (state.tasks || []).find(x => x.id === taskId);
      if (!t) throw new Error('Task not found.');
      t.reminderLog ||= [];
      t.reminderLog.unshift(logEntry);
      t.reminderLog = t.reminderLog.slice(0, 30);
      t.lastRemindedAt = now;
      t.version = (t.version || 0) + 1;
      t.updatedAt = now;
      t.comments ||= [];
      t.comments.push({
        id: S.uid('note'),
        text: `🔔 Reminder sent to ${recipients.map(r => r.name).join(', ')}: "${message.slice(0, 220)}"`,
        time: now,
        author: 'Task Reminder'
      });
    });

    // Dispatch outbound reminder into MK97 Mail bridge so it shows up in Mail -> Sent
    const toList = recipients.map(r => r.email || r.name).join(', ');
    const mailThread = {
      id: 'task-rem-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      senderName: 'Manoj Manne',
      senderCompany: 'MK97 Tasks & Reminders',
      senderEmail: 'supply.chain@mk97.com',
      to: toList,
      cc: '',
      subject,
      timestamp: 'Just now',
      fullDate: new Date(now).toLocaleString(),
      unread: false,
      starred: false,
      flagged: false,
      folder: 'sent',
      direction: 'outbound',
      category: 'internal',
      avatar: 'MM',
      avatarBg: '#087f78',
      avatarColor: '#ffffff',
      tags: [{ name: 'Task Reminder', type: 'internal' }, { name: analysis.tier, type: 'po' }],
      snippet: message.slice(0, 100),
      body: `${message}\n\n---\nInvolved Team: ${recipients.map(r => `${r.name}${r.email ? ' <' + r.email + '>' : ''}`).join(', ')}\nOpen Task: tasks.html?task=${encodeURIComponent(taskId)}`,
      attachments: []
    };

    if (window.StarkMail?.prependEmail) {
      window.StarkMail.prependEmail(mailThread);
    } else {
      const currentMails = getMailThreads();
      currentMails.unshift(mailThread);
      saveMailThreadsToBridge(currentMails);
    }

    window.StarkSystemUI?.notice(`🔔 Reminder sent to ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'} (${recipients.map(r => r.name).join(', ')}) via MK97 Mail & Workspace.`);
    return logEntry;
  }

  function openReminderModal(taskId) {
    const task = tasks().find(t => t.id === taskId);
    if (!task) return;
    const analysis = analyzeTask(task);
    const involved = task.assignees?.length ? task.assignees : [DEFAULT_ROSTER[0]];
    const roster = getTeamRoster();
    const involvedKeys = new Set(involved.map(a => (a.email || a.name).toLowerCase()));
    const extras = roster.filter(m => !involvedKeys.has((m.email || m.name).toLowerCase()));
    const refSummary = analysis.references.length ? `References: ${analysis.references.slice(0, 3).map(r => r.code).join(', ')}. ` : '';
    const defaultMsg = `Hi team — quick reminder regarding "${task.title}". ${refSummary}${task.dueAt ? 'Due: ' + when(task.dueAt) + '. ' : ''}MK Co-Pilot Priority: ${analysis.tier} (Score ${analysis.score}/100). Please share an update or mark complete once done.`;

    const dialog = window.StarkSystemUI.dialog('🔔 Send Reminder to Involved Team', `
      <div class="tsk-modal-body">
        <div class="tsk-remind-banner">
          <strong>${esc(task.title)}</strong>
          <span>MK Priority: <b>${esc(analysis.tier)} (${analysis.score}/100)</b>${task.dueAt ? ' · Due ' + esc(when(task.dueAt)) : ''}</span>
        </div>
        <div class="tsk-field">
          <label class="tsk-label">People involved (select recipients)</label>
          <div class="tsk-recipient-grid" id="tsk-rem-recipients">
            ${involved.map(p => `
              <label class="tsk-recipient-chip is-selected">
                <input type="checkbox" checked data-rem-person="${esc(JSON.stringify({ id: p.id, name: p.name, email: p.email, role: p.role, avatar: p.avatar, color: p.color }))}">
                <span class="tsk-avatar-sm" style="background:${esc(p.color || '#087f78')}">${esc(p.avatar || initials(p.name))}</span>
                <span><strong>${esc(p.name)}</strong><small>${esc(p.email || p.role || '')}</small></span>
              </label>
            `).join('')}
          </div>
        </div>
        ${extras.length ? `
          <div class="tsk-field">
            <label class="tsk-label">Add another team member</label>
            <div class="tsk-inline-add">
              <select id="tsk-rem-extra-select">
                <option value="">Choose team member…</option>
                ${extras.map(m => `<option value="${esc(JSON.stringify(m))}">${esc(m.name)} (${esc(m.role)})</option>`).join('')}
              </select>
              <button type="button" class="sys-btn" id="tsk-rem-add-member">＋ Add</button>
            </div>
          </div>` : ''}
        <div class="tsk-field">
          <label class="tsk-label">Or add external email</label>
          <div class="tsk-inline-add">
            <input type="text" id="tsk-rem-custom-name" placeholder="Name (optional)">
            <input type="text" id="tsk-rem-custom-email" placeholder="person@company.com">
            <button type="button" class="sys-btn" id="tsk-rem-add-custom">＋ Add</button>
          </div>
        </div>
        <div class="tsk-field">
          <label class="tsk-label" for="tsk-rem-subject">Reminder subject</label>
          <input id="tsk-rem-subject" maxlength="180" value="${esc('🔔 Reminder: ' + task.title)}">
        </div>
        <div class="tsk-field">
          <label class="tsk-label" for="tsk-rem-message">Message</label>
          <textarea id="tsk-rem-message" rows="4" maxlength="4000" required>${esc(defaultMsg)}</textarea>
        </div>
        <p class="tsk-modal-footnote">Dispatches immediately to MK97 Mail (Sent), logs on the task activity timeline, and notifies all selected participants.</p>
      </div>
    `, wrap => {
      const checked = [...wrap.querySelectorAll('#tsk-rem-recipients input[type="checkbox"]:checked')].map(cb => {
        try { return JSON.parse(cb.dataset.remPerson); } catch (_) { return null; }
      }).filter(Boolean);
      if (!checked.length) throw new Error('Select at least one recipient.');
      sendReminder(taskId, {
        recipients: checked,
        subject: wrap.querySelector('#tsk-rem-subject').value,
        message: wrap.querySelector('#tsk-rem-message').value
      });
      render();
    }, 'Send Reminder Now', { system: true });

    dialog.querySelector('.sys-modal').style.width = 'min(620px, 96vw)';
    const grid = dialog.querySelector('#tsk-rem-recipients');
    const appendChip = p => {
      const chip = document.createElement('label');
      chip.className = 'tsk-recipient-chip is-selected';
      chip.innerHTML = `<input type="checkbox" checked data-rem-person="${esc(JSON.stringify(p))}"><span class="tsk-avatar-sm" style="background:${esc(p.color || colorForName(p.name))}">${esc(p.avatar || initials(p.name))}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.email || p.role || '')}</small></span>`;
      chip.querySelector('input').onchange = e => chip.classList.toggle('is-selected', e.target.checked);
      grid.appendChild(chip);
    };
    grid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.onchange = () => cb.closest('.tsk-recipient-chip')?.classList.toggle('is-selected', cb.checked);
    });
    dialog.querySelector('#tsk-rem-add-member')?.addEventListener('click', () => {
      const sel = dialog.querySelector('#tsk-rem-extra-select');
      if (!sel?.value) return;
      try {
        const p = JSON.parse(sel.value);
        appendChip(p);
        sel.querySelector(`option[value="${CSS.escape(sel.value)}"]`)?.remove();
        sel.value = '';
      } catch (_) {}
    });
    dialog.querySelector('#tsk-rem-add-custom')?.addEventListener('click', () => {
      const email = dialog.querySelector('#tsk-rem-custom-email')?.value.trim();
      const name = dialog.querySelector('#tsk-rem-custom-name')?.value.trim() || email;
      if (!email || !email.includes('@')) return window.StarkSystemUI?.notice('Enter a valid email address.', true);
      appendChip({ id: 'ext_' + Date.now(), name, email, role: 'External', avatar: initials(name), color: colorForName(name) });
      dialog.querySelector('#tsk-rem-custom-name').value = '';
      dialog.querySelector('#tsk-rem-custom-email').value = '';
    });
    return dialog;
  }

  function provideTrackingForTask(taskId) {
    const task = tasks().find(t => t.id === taskId);
    if (!task) return;
    const mails = getMailThreads();
    const linkedMail = mails.find(m => m.id === (task.linkedMailId || task.autoEntityId));
    const refCode = task.autoRef || linkedMail?.related?.poNumber || 'Shipment';

    const dialog = window.StarkSystemUI.dialog('📦 Provide Tracking & Auto-Resolve', `
      <div class="tsk-modal-body">
        <div class="tsk-remind-banner">
          <strong>${esc(task.title)}</strong>
          <span>${linkedMail ? `Replying to ${esc(linkedMail.senderName)} <${esc(linkedMail.senderEmail)}>` : `Updating tracking for ${esc(refCode)}`}</span>
        </div>
        <div class="tsk-form-row2">
          <label class="tsk-label">Carrier
            <select id="tsk-trk-carrier">
              <option value="DHL Express">DHL Express</option>
              <option value="UPS Ground">UPS Ground</option>
              <option value="FedEx Priority">FedEx Priority</option>
              <option value="Aramex">Aramex</option>
            </select>
          </label>
          <label class="tsk-label">Tracking Number
            <input id="tsk-trk-number" placeholder="e.g. DHL9988776 or 1Z999AA10123456784" required>
          </label>
        </div>
        <label class="tsk-label">Reply note
          <textarea id="tsk-trk-note" rows="3">Hi team, please find the confirmed carrier tracking number below for ${esc(refCode)}. Ready for dock registration.</textarea>
        </label>
        <p class="tsk-modal-footnote">MK Co-Pilot will dispatch the tracking reply via MK97 Mail, verify the tracking number, and automatically remove this task from your Active list.</p>
      </div>
    `, wrap => {
      const carrier = wrap.querySelector('#tsk-trk-carrier').value;
      const trk = wrap.querySelector('#tsk-trk-number').value.trim();
      const note = wrap.querySelector('#tsk-trk-note').value.trim();
      const validTrk = C()?.extractTrackingNumber?.(trk) || '';
      if (!validTrk) throw new Error('Enter a valid carrier tracking number (e.g. DHL9988776, 1Z999AA10123456784, or TRK8844221).');

      if (task.autoTrigger === 'tpl_delay_tracking' && task.autoEntityId) {
        S.transaction('TPL_TRACKING_UPDATED', `${task.autoEntityId}: ${validTrk}`, state => {
          const shp = (state.logistics?.tplShipments || []).find(s => s.id === task.autoEntityId);
          if (shp) { shp.tracking = validTrk; shp.status = 'DISPATCHED'; shp.dispatchedAt = new Date().toISOString(); }
        });
      } else {
        const currentMails = getMailThreads();
        const target = currentMails.find(m => m.id === (task.linkedMailId || task.autoEntityId));
        if (target) {
          target.related = { ...(target.related || {}), tracking: validTrk };
          target.shipmentDetails = { ...(target.shipmentDetails || {}), trackingNumber: validTrk, carrier, status: 'Tracking Provided' };
        }
        const replyThread = {
          id: 'reply-' + Date.now(),
          senderName: 'Manoj Manne',
          senderCompany: 'MK97 Operations',
          senderEmail: 'supply.chain@mk97.com',
          to: target?.senderEmail || 'orders@globalpartsco.com',
          cc: '',
          subject: target ? (/^re:/i.test(target.subject) ? target.subject : 'Re: ' + target.subject) : `Tracking Provided: ${refCode}`,
          timestamp: 'Just now',
          fullDate: new Date().toLocaleString(),
          unread: false,
          starred: false,
          flagged: false,
          folder: 'sent',
          direction: 'outbound',
          replyToThreadId: target?.id || '',
          category: 'shipping',
          avatar: 'MM',
          avatarBg: '#087f78',
          avatarColor: '#ffffff',
          tags: [{ name: 'Tracking Sent', type: 'shipment' }],
          snippet: `${carrier} Tracking: ${validTrk}`,
          body: `${note}\n\nCarrier: ${carrier}\nTracking Number: ${validTrk}\nReference: ${refCode}`,
          related: { ...(target?.related || {}), tracking: validTrk },
          attachments: []
        };
        currentMails.unshift(replyThread);
        saveMailThreadsToBridge(currentMails);
      }

      const res = runCopilotSync({ silent: false, force: true, notifyResolved: true });
      if (!res.resolved.length) {
        setStatus(taskId, 'DONE');
      }
      render();
    }, 'Send Tracking & Verify', { system: true });

    dialog.querySelector('.sys-modal').style.width = 'min(540px, 96vw)';
    return dialog;
  }

  function quickCreateVendorPO(taskId) {
    const task = tasks().find(t => t.id === taskId);
    if (!task) return;
    const state = S.getState();
    const item = (state.enterprise?.inventory || []).find(i => i.sku === task.autoEntityId) ||
      (state.enterprise?.inventory || []).find(i => (task.title + ' ' + task.notes).toUpperCase().includes((i.model || i.sku).toUpperCase()));
    if (!item) {
      location.assign(S.url('procurement/index.html'));
      return;
    }
    const vendors = state.enterprise?.vendors || [];
    const suggestedQty = task.suggestedQty || Math.max(25, Math.ceil((Number(item.safety || 25) * 2 - Math.max(0, Number(item.onHand || 0) - Number(item.reserved || 0))) / 5) * 5);
    const nextPoNum = 'PO-2026-' + String(888100 + (state.enterprise?.purchaseOrders?.length || 0) * 17);
    const defaultEta = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const dialog = window.StarkSystemUI.dialog('🛒 Issue Covering Vendor PO', `
      <div class="tsk-modal-body">
        <div class="tsk-remind-banner">
          <strong>${esc(item.model || item.sku)} · ${esc(item.brand || '')} ${esc(item.title || '')}</strong>
          <span>Free: <b>${Math.max(0, Number(item.onHand || 0) - Number(item.reserved || 0))}</b> · Safety Floor: <b>${Number(item.safety || 0)}</b> · Unit Cost: <b>$${Number(item.cost || 0)}</b></span>
        </div>
        <div class="tsk-form-row2">
          <label class="tsk-label">PO Number<input id="tsk-po-num" value="${esc(nextPoNum)}" required></label>
          <label class="tsk-label">Order Quantity<input id="tsk-po-qty" type="number" min="1" max="100000" value="${suggestedQty}" required></label>
        </div>
        <div class="tsk-form-row2">
          <label class="tsk-label">Supplier
            <select id="tsk-po-vendor">
              ${vendors.map(v => `<option value="${esc(v.id)}">${esc(v.name)} (${esc(v.leadTime ?? 7)}d lead)</option>`).join('')}
            </select>
          </label>
          <label class="tsk-label">Expected Arrival (ETA)<input id="tsk-po-eta" type="date" value="${defaultEta}" required></label>
        </div>
        <p class="tsk-modal-footnote">Issuing this Vendor PO updates Procurement &amp; Inventory across the entire ERP. MK Co-Pilot will immediately verify safety stock coverage and auto-resolve this task.</p>
      </div>
    `, wrap => {
      const poNum = wrap.querySelector('#tsk-po-num').value.trim();
      const qty = Math.max(1, Number(wrap.querySelector('#tsk-po-qty').value));
      const vendorId = wrap.querySelector('#tsk-po-vendor').value;
      const etaDate = wrap.querySelector('#tsk-po-eta').value;
      if (!poNum) throw new Error('Enter a PO number.');

      S.transaction('VENDOR_PO_CREATED', `${poNum} (${qty} × ${item.model || item.sku})`, draft => {
        draft.enterprise.purchaseOrders ||= [];
        draft.enterprise.purchaseOrders.unshift({
          id: S.uid('vpo'),
          vendorId,
          po: poNum,
          status: 'PO_ISSUED',
          issuedAt: new Date().toISOString(),
          eta: new Date(etaDate + 'T12:00:00Z').toISOString(),
          warehouse: 'MK97 Southeast Distribution Center',
          carrier: 'TBD',
          tracking: '',
          lines: [{ sku: item.sku, qty, received: 0, cost: Number(item.cost || 0) }]
        });
      });

      runCopilotSync({ silent: false, force: true, notifyResolved: true });
      render();
    }, 'Issue Vendor PO', { system: true });

    dialog.querySelector('.sys-modal').style.width = 'min(540px, 96vw)';
    return dialog;
  }

  function edit(id, defaults = {}) {
    const task = id ? tasks().find(t => t.id === id) : null;
    if (id && !task) return;
    const roster = getTeamRoster();
    const initialAssignees = task ? normalizeAssignees(task.assignees) : normalizeAssignees(defaults.assignees || [roster[0]]);
    const selectedKeys = new Set(initialAssignees.map(a => (a.email || a.name).toLowerCase()));
    const customAssignees = initialAssignees.filter(a => !roster.some(r => (r.email || r.name).toLowerCase() === (a.email || a.name).toLowerCase()));

    const dialog = window.StarkSystemUI.dialog(task ? 'Edit Task' : 'Create Task & Assign Team', `
      <div class="tsk-modal-body task-form">
        <div class="tsk-field">
          <label class="tsk-label" for="task-title">Task subject / title <small style="font-weight:500;color:#64748b;">(mention PO #, Order #, SKU, or "escalation" for instant MK analysis)</small></label>
          <input id="task-title" maxlength="160" required placeholder="e.g. Expedite PO-2026-887411 escalation with Sony & Warehouse" value="${esc(task?.title || defaults.title || '')}">
        </div>

        <div id="tsk-live-ai-preview" class="tsk-ai-preview"></div>

        <div class="tsk-field">
          <label class="tsk-label">Assign people involved <small style="font-weight:500;color:#64748b;">(select 1, 2, or more team members)</small></label>
          <div class="tsk-team-picker" id="tsk-team-picker">
            ${[...roster, ...customAssignees].map(m => {
              const key = (m.email || m.name).toLowerCase();
              const isSel = selectedKeys.has(key);
              return `
                <label class="tsk-person-pill ${isSel ? 'is-selected' : ''}">
                  <input type="checkbox" ${isSel ? 'checked' : ''} data-assignee="${esc(JSON.stringify(m))}">
                  <span class="tsk-avatar-sm" style="background:${esc(m.color)}">${esc(m.avatar)}</span>
                  <span><strong>${esc(m.name)}</strong><small>${esc(m.role)}</small></span>
                </label>`;
            }).join('')}
          </div>
          <div class="tsk-inline-add" style="margin-top:8px;">
            <input type="text" id="tsk-new-person-name" placeholder="Add person name">
            <input type="text" id="tsk-new-person-email" placeholder="email@company.com">
            <button type="button" class="sys-btn" id="tsk-add-person-btn">＋ Involve</button>
          </div>
        </div>

        <div class="tsk-form-row2">
          <label class="tsk-label">Due date &amp; time
            <input id="task-due" type="datetime-local" value="${localValue(task?.dueAt || defaults.dueAt)}">
          </label>
          <label class="tsk-label">Reminder date &amp; time
            <input id="task-reminder" type="datetime-local" value="${localValue(task?.reminderAt || defaults.reminderAt)}">
          </label>
        </div>

        <div class="tsk-preset-row">
          <span>Quick reminder presets:</span>
          <button type="button" class="tsk-preset-btn" data-preset="1h">In 1 hour</button>
          <button type="button" class="tsk-preset-btn" data-preset="today5">Today 5 PM</button>
          <button type="button" class="tsk-preset-btn" data-preset="tom9">Tomorrow 9 AM</button>
          <button type="button" class="tsk-preset-btn" data-preset="nextweek">Next Week</button>
        </div>

        <div class="tsk-form-row2">
          <label class="tsk-label">Priority
            <select id="task-priority">
              <option value="AUTO" ${!task ? 'selected' : ''}>✨ Auto (MK Co-Pilot Ranked)</option>
              ${priorities.map(p => `<option value="${p}" ${task && p === task.priority ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </label>
          <label class="tsk-label">Status
            <select id="task-status">
              ${states.map(p => `<option value="${p}" ${p === (task?.status || 'OPEN') ? 'selected' : ''}>${p.replace('_', ' ')}</option>`).join('')}
            </select>
          </label>
        </div>

        <div class="tsk-field">
          <label class="tsk-label" for="task-notes">Notes &amp; context</label>
          <textarea id="task-notes" rows="4" maxlength="20000" placeholder="Add PO numbers, order references, tracking details, or instructions for the involved team…">${esc(task?.notes || defaults.notes || '')}</textarea>
        </div>

        ${!task ? `
          <label class="tsk-notify-check">
            <input type="checkbox" id="task-send-now">
            <span>🔔 Immediately dispatch a reminder via MK97 Mail to everyone involved upon saving</span>
          </label>` : ''}

        <p class="tsk-modal-footnote">Times use ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}. Tasks sync live across Operations, Mail, Orders, Procurement, and MK Co-Pilot.</p>
      </div>
    `, wrap => {
      const val = key => wrap.querySelector('#task-' + key)?.value || '';
      const chosen = [...wrap.querySelectorAll('#tsk-team-picker input[type="checkbox"]:checked')].map(cb => {
        try { return JSON.parse(cb.dataset.assignee); } catch (_) { return null; }
      }).filter(Boolean);
      const savedId = save({
        title: val('title'),
        notes: val('notes'),
        dueAt: localISO(val('due')),
        reminderAt: localISO(val('reminder')),
        priority: val('priority'),
        status: val('status'),
        assignees: chosen,
        linkedMailId: task ? task.linkedMailId : (defaults.linkedMailId || ''),
        sourcePath: task ? task.sourcePath : (defaults.sourcePath || ''),
        expectedUpdatedAt: task?.updatedAt,
        expectedVersion: task ? (task.version || 0) : undefined
      }, id);
      selected = savedId;

      if (!task && wrap.querySelector('#task-send-now')?.checked && chosen.length) {
        try { sendReminder(savedId, { recipients: chosen }); } catch (_) {}
      } else {
        window.StarkSystemUI?.notice(task ? 'Task updated.' : 'Task created & ranked by MK Co-Pilot.');
      }
      render();
    }, task ? 'Save Changes' : 'Create Task', { system: true });

    dialog.querySelector('.sys-modal').style.width = 'min(680px, 96vw)';

    // Wire team pills
    const picker = dialog.querySelector('#tsk-team-picker');
    const bindPill = cb => { cb.onchange = () => { cb.closest('.tsk-person-pill')?.classList.toggle('is-selected', cb.checked); updateLivePreview(); }; };
    picker.querySelectorAll('input[type="checkbox"]').forEach(bindPill);

    dialog.querySelector('#tsk-add-person-btn').onclick = () => {
      const nameIn = dialog.querySelector('#tsk-new-person-name');
      const emailIn = dialog.querySelector('#tsk-new-person-email');
      const email = emailIn.value.trim();
      const name = nameIn.value.trim() || email;
      if (!name) return window.StarkSystemUI?.notice('Enter a person name or email.', true);
      const p = { id: 'ext_' + Date.now(), name, email, role: 'Collaborator', avatar: initials(name), color: colorForName(name) };
      const label = document.createElement('label');
      label.className = 'tsk-person-pill is-selected';
      label.innerHTML = `<input type="checkbox" checked data-assignee="${esc(JSON.stringify(p))}"><span class="tsk-avatar-sm" style="background:${esc(p.color)}">${esc(p.avatar)}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.email || p.role)}</small></span>`;
      bindPill(label.querySelector('input'));
      picker.appendChild(label);
      nameIn.value = '';
      emailIn.value = '';
      updateLivePreview();
    };

    // Quick reminder presets
    dialog.querySelectorAll('[data-preset]').forEach(btn => {
      btn.onclick = () => {
        const now = new Date();
        let rem = new Date(now);
        let due = new Date(now);
        if (btn.dataset.preset === '1h') {
          rem = new Date(now.getTime() + 60 * 60000);
          due = new Date(now.getTime() + 4 * 3600000);
        } else if (btn.dataset.preset === 'today5') {
          rem.setHours(16, 0, 0, 0);
          if (rem <= now) rem = new Date(now.getTime() + 30 * 60000);
          due.setHours(17, 0, 0, 0);
          if (due < rem) due = new Date(rem.getTime() + 60 * 60000);
        } else if (btn.dataset.preset === 'tom9') {
          rem.setDate(rem.getDate() + 1); rem.setHours(9, 0, 0, 0);
          due = new Date(rem.getTime() + 8 * 3600000);
        } else {
          rem.setDate(rem.getDate() + 5); rem.setHours(9, 0, 0, 0);
          due = new Date(rem.getTime() + 48 * 3600000);
        }
        dialog.querySelector('#task-reminder').value = localValue(rem.toISOString());
        dialog.querySelector('#task-due').value = localValue(due.toISOString());
        updateLivePreview();
      };
    });

    // Live MK Co-Pilot ERP Reference Preview while typing!
    const previewBox = dialog.querySelector('#tsk-live-ai-preview');
    const updateLivePreview = () => {
      const title = dialog.querySelector('#task-title')?.value.trim() || '';
      const notes = dialog.querySelector('#task-notes')?.value.trim() || '';
      const dueRaw = dialog.querySelector('#task-due')?.value || '';
      const checkedCount = dialog.querySelectorAll('#tsk-team-picker input[type="checkbox"]:checked').length;
      if (!title && !notes) {
        previewBox.innerHTML = `<div class="tsk-ai-preview-idle">✨ <strong>MK Co-Pilot Live Analyzer:</strong> Mention a PO # (e.g. <code>PO-2026-887411</code>), Order # (<code>SO-89108</code>, <code>87366-HOLD</code>), SKU (<code>AF-200</code>), or <code>escalation</code> to preview ERP impact &amp; priority score.</div>`;
        return;
      }
      let dueAt = '';
      try { if (dueRaw) dueAt = localISO(dueRaw); } catch (_) {}
      const probe = analyzeTask({
        title,
        notes,
        dueAt,
        assignees: Array.from({ length: checkedCount }, (_, i) => ({ id: 'p' + i, name: 'Member ' + i })),
        linkedMailId: task ? task.linkedMailId : (defaults.linkedMailId || '')
      });
      previewBox.innerHTML = `
        <div class="tsk-ai-preview-active tier-${probe.tier.toLowerCase()}">
          <div class="tsk-ai-preview-top">
            <span>✨ <strong>MK Co-Pilot Live Analysis</strong></span>
            <span class="tsk-score-pill tier-${probe.tier.toLowerCase()}">Score ${probe.score}/100 · ${esc(probe.tier)}</span>
          </div>
          ${probe.references.length ? `<div class="tsk-ref-row">${probe.references.slice(0, 5).map(r => `<span class="tsk-ref-chip ref-${r.type.toLowerCase()}">${esc(r.type.replace('_', ' '))}: ${esc(r.code)}</span>`).join('')}</div>` : ''}
          <p class="tsk-ai-preview-reason">${esc(probe.reasons[0] || '')}</p>
        </div>`;
    };
    dialog.querySelector('#task-title').addEventListener('input', updateLivePreview);
    dialog.querySelector('#task-notes').addEventListener('input', updateLivePreview);
    dialog.querySelector('#task-due').addEventListener('change', updateLivePreview);
    updateLivePreview();

    return dialog;
  }

  function safeUrl(path) {
    if (!path) return '';
    try {
      const url = new URL(path, S.rootURL);
      if (url.origin === S.rootURL.origin && url.pathname.startsWith(S.rootURL.pathname)) return url.href;
    } catch (_) {}
    return '';
  }

  function renderInspectorHtml(item, isModal = false) {
    if (!item) {
      return `<div class="tsk-inspector-empty">
        <div class="tsk-empty-icon">🎯</div>
        <h3>Select a task to inspect</h3>
        <p>Click any task card to inspect MK Co-Pilot’s deep ERP reference analysis, linked POs &amp; orders, involved people, and reminder history.</p>
      </div>`;
    }
    const { task, analysis } = item;
    const involved = task.assignees || [];
    const roster = getTeamRoster();
    const involvedKeys = new Set(involved.map(a => (a.email || a.name).toLowerCase()));
    const availableAdd = roster.filter(m => !involvedKeys.has((m.email || m.name).toLowerCase()));
    const sourceUrl = safeUrl(task.sourcePath);
    const isTrackingTask = task.status !== 'DONE' && (task.autoTrigger === 'tracking_request' || task.autoTrigger === 'tpl_delay_tracking' || (analysis.signals?.isTrackingRequest && (task.linkedMailId || analysis.references.some(r => r.type === 'MAIL' || r.type === '3PL'))));
    const isPoTask = task.status !== 'DONE' && (task.autoTrigger === 'low_stock_po' || (analysis.signals?.isProcurementNeed && analysis.references.some(r => r.type === 'SKU')));
    const now = Date.now();
    const isOverdue = task.status !== 'DONE' && task.dueAt && Date.parse(task.dueAt) < now;

    return `
      <div class="tsk-inspector-card ${isModal ? 'is-modal' : ''}" data-inspector-id="${esc(task.id)}">
        <div class="tsk-insp-header">
          <div class="tsk-insp-badges">
            ${analysis.rank ? `<span class="tsk-rank-badge tier-${analysis.tier.toLowerCase()}">Priority #${analysis.rank}</span>` : `<span class="tsk-rank-badge tier-done">${task.autoResolved ? '✨ Auto-Resolved' : 'Completed'}</span>`}
            <span class="tsk-score-pill tier-${analysis.tier.toLowerCase()}">MK ${analysis.score}/100 · ${esc(analysis.tier)}</span>
            ${task.autoCreatedBy === 'mk-copilot' ? `<span class="tsk-auto-badge">✨ MK Auto</span>` : ''}
            <span class="tsk-cat-pill">${esc(analysis.category)}</span>
          </div>
          <h2 class="tsk-insp-title">${esc(task.title)}</h2>
          <div class="tsk-insp-meta-row">
            <span class="${isOverdue ? 'tsk-text-danger' : ''}">📅 Due: <b>${esc(when(task.dueAt))}</b>${isOverdue ? ' (Overdue)' : ''}</span>
            <span>⏰ Reminder: <b>${esc(when(task.reminderAt))}</b></span>
          </div>
          <div class="tsk-insp-actions">
            <select class="tsk-status-select" data-insp-status="${esc(task.id)}" aria-label="Task status">
              ${states.map(st => `<option value="${st}" ${st === task.status ? 'selected' : ''}>${st.replace('_', ' ')}</option>`).join('')}
            </select>
            <button type="button" class="tsk-btn-teal" data-task-remind="${esc(task.id)}">🔔 Send Reminder</button>
            <button type="button" class="tsk-btn-ghost" data-task-edit="${esc(task.id)}">✎ Edit</button>
            <button type="button" class="tsk-btn-danger-ghost" data-task-delete="${esc(task.id)}" title="Delete task">🗑</button>
          </div>
        </div>

        ${task.autoResolved && task.autoResolvedReason ? `
          <div class="tsk-autoresolved-banner">
            <strong>✨ Automatically Resolved &amp; Removed from Active by MK Co-Pilot</strong>
            <p>${esc(task.autoResolvedReason)}</p>
            <small>Resolved ${esc(when(task.autoResolvedAt))}</small>
          </div>` : ''}

        <!-- MK Co-Pilot Deep Website Reference Analysis -->
        <section class="tsk-ai-panel">
          <div class="tsk-ai-panel-head">
            <div>
              <span class="tsk-ai-eyebrow">MK CO-PILOT DEEP ERP ANALYSIS</span>
              <h3>Importance &amp; Cross-Website Impact</h3>
            </div>
            <div class="tsk-score-dial tier-${analysis.tier.toLowerCase()}">
              <strong>${analysis.score}</strong>
              <small>/100</small>
            </div>
          </div>

          <div class="tsk-score-bar-track">
            <div class="tsk-score-bar-fill tier-${analysis.tier.toLowerCase()}" style="width:${analysis.score}%"></div>
          </div>

          <ul class="tsk-ai-reasons">
            ${analysis.reasons.map(r => `<li>${esc(r)}</li>`).join('')}
          </ul>

          ${analysis.references.length ? `
            <div class="tsk-ai-refs">
              <span class="tsk-sublabel">Detected Website Records (${analysis.references.length})</span>
              <div class="tsk-ref-cards">
                ${analysis.references.map(ref => {
                  const href = safeUrl(ref.path);
                  return `<a class="tsk-ref-card severity-${esc(ref.severity || 'normal')}" href="${esc(href || '#')}">
                    <div class="tsk-ref-card-top">
                      <span class="tsk-ref-type">${esc(ref.type.replace('_', ' '))}</span>
                      <span class="tsk-ref-status">${esc(ref.status)}</span>
                    </div>
                    <strong>${esc(ref.label)}</strong>
                    <small>${esc(ref.detail)}</small>
                  </a>`;
                }).join('')}
              </div>
            </div>` : ''}

          <div class="tsk-ai-recommend">
            <strong>Recommended Action:</strong> ${esc(analysis.recommendedAction)}
            <div class="tsk-ai-cta-row">
              ${isTrackingTask ? `<button type="button" class="tsk-btn-ai-cta" data-provide-tracking="${esc(task.id)}">📦 Provide Tracking &amp; Auto-Resolve</button>` : ''}
              ${isPoTask ? `<button type="button" class="tsk-btn-ai-cta" data-create-po="${esc(task.id)}">🛒 Issue Covering Vendor PO</button>` : ''}
              ${sourceUrl ? `<a class="tsk-btn-ai-link" href="${esc(sourceUrl)}">Open Source Record ↗</a>` : ''}
            </div>
          </div>
        </section>

        <!-- People Involved & Reminders -->
        <section class="tsk-insp-section">
          <div class="tsk-section-head">
            <h3>People Involved (${involved.length})</h3>
            <button type="button" class="tsk-link-btn" data-task-remind="${esc(task.id)}">🔔 Remind All (${Math.max(1, involved.length)})</button>
          </div>
          <div class="tsk-involved-list">
            ${involved.length ? involved.map(p => `
              <div class="tsk-involved-chip">
                <span class="tsk-avatar-sm" style="background:${esc(p.color || '#087f78')}">${esc(p.avatar || initials(p.name))}</span>
                <div>
                  <strong>${esc(p.name)}</strong>
                  <small>${esc(p.role || p.email || '')}</small>
                </div>
                <button type="button" class="tsk-chip-remove" data-remove-assignee="${esc(task.id)}" data-person-key="${esc(p.email || p.name)}" title="Remove ${esc(p.name)}" aria-label="Remove ${esc(p.name)}">×</button>
              </div>
            `).join('') : '<p class="tsk-muted">No assignees yet. Add team members below to collaborate and send reminders.</p>'}
          </div>
          ${availableAdd.length ? `
            <div class="tsk-inline-add" style="margin-top:10px;">
              <select class="tsk-quick-add-select" data-quick-add-select="${esc(task.id)}">
                <option value="">＋ Involve another person…</option>
                ${availableAdd.map(m => `<option value="${esc(JSON.stringify(m))}">${esc(m.name)} · ${esc(m.role)}</option>`).join('')}
              </select>
              <button type="button" class="sys-btn" data-quick-add-btn="${esc(task.id)}">Add</button>
            </div>` : ''}

          ${(task.reminderLog || []).length ? `
            <div class="tsk-rem-log">
              <span class="tsk-sublabel">Reminder Dispatch History (${task.reminderLog.length})</span>
              ${task.reminderLog.slice(0, 4).map(log => `
                <div class="tsk-rem-log-item">
                  <div class="tsk-rem-log-top">
                    <strong>🔔 Sent to ${esc((log.recipients || []).map(r => r.name).join(', '))}</strong>
                    <time>${esc(relTime(log.sentAt) || when(log.sentAt))}</time>
                  </div>
                  <p>${esc((log.message || '').slice(0, 140))}</p>
                </div>
              `).join('')}
            </div>` : ''}
        </section>

        <!-- Description & Activity Notes -->
        <section class="tsk-insp-section">
          <h3>Details &amp; Activity</h3>
          <div class="tsk-notes-box">${esc(task.notes || 'No notes recorded yet.')}</div>
          <div class="tsk-comments-list">
            ${(task.comments || []).slice().reverse().map(n => `
              <article class="tsk-comment-item ${n.author === 'MK Co-Pilot' ? 'is-ai' : ''}">
                <div class="tsk-comment-meta"><strong>${esc(n.author || 'Team')}</strong><time>${esc(when(n.time))}</time></div>
                <p>${esc(n.text)}</p>
              </article>
            `).join('')}
          </div>
          <form class="tsk-note-form" data-note-form="${esc(task.id)}">
            <input type="text" placeholder="Add a progress note or handoff update…" maxlength="5000">
            <button type="submit" class="sys-btn" data-tsk-style="note-submit">Post Note</button>
          </form>
        </section>
      </div>`;
  }

  function detail(id) {
    selected = id;
    const allAnalyzed = analyzeAll();
    const item = allAnalyzed.find(x => x.task.id === id);
    if (!item) return;

    // On desktop inside tasks.html, focus the right inspector; on mobile or other pages, open clean detail dialog
    const isTasksPage = !!document.querySelector('#tasks-content');
    if (isTasksPage && window.innerWidth > 1060 && viewMode === 'priority') {
      render();
      const insp = document.querySelector('.tsk-inspector-col');
      if (insp) {
        const rect = insp.getBoundingClientRect();
        if (rect.top < 76 || rect.top > window.innerHeight - 120) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - 84), behavior: 'smooth' });
        }
      }
      return;
    }

    const dialog = window.StarkSystemUI.dialog(item.task.title, renderInspectorHtml(item, true), () => true, 'Done', { system: true });
    dialog.querySelector('.sys-modal').style.width = 'min(720px, 96vw)';
    const cancelBtn = dialog.querySelector('.sys-modal-footer [data-close]');
    if (cancelBtn) cancelBtn.hidden = true;
    bindInspectorInteractions(dialog, () => {
      dialog.remove();
      render();
    });
    return dialog;
  }

  function bindInspectorInteractions(scope, onModalClose) {
    const inModal = el => !!el.closest('.sys-modal-backdrop');
    scope.querySelectorAll('[data-insp-status]').forEach(sel => {
      sel.onchange = () => {
        try {
          setStatus(sel.dataset.inspStatus, sel.value);
          render();
          if (onModalClose && inModal(sel)) onModalClose();
        } catch (err) { window.StarkSystemUI?.notice(err.message, true); }
      };
    });
    scope.querySelectorAll('[data-task-remind]').forEach(btn => {
      btn.onclick = () => openReminderModal(btn.dataset.taskRemind);
    });
    scope.querySelectorAll('[data-task-edit]').forEach(btn => {
      btn.onclick = () => {
        if (onModalClose && inModal(btn)) onModalClose();
        edit(btn.dataset.taskEdit);
      };
    });
    scope.querySelectorAll('[data-task-delete]').forEach(btn => {
      btn.onclick = () => {
        remove(btn.dataset.taskDelete);
        window.StarkSystemUI?.notice('Task removed.');
        if (onModalClose && inModal(btn)) onModalClose();
        render();
      };
    });
    scope.querySelectorAll('[data-provide-tracking]').forEach(btn => {
      btn.onclick = () => {
        if (onModalClose && inModal(btn)) onModalClose();
        provideTrackingForTask(btn.dataset.provideTracking);
      };
    });
    scope.querySelectorAll('[data-create-po]').forEach(btn => {
      btn.onclick = () => {
        if (onModalClose && inModal(btn)) onModalClose();
        quickCreateVendorPO(btn.dataset.createPo);
      };
    });
    scope.querySelectorAll('[data-remove-assignee]').forEach(btn => {
      btn.onclick = () => {
        removeAssigneeFromTask(btn.dataset.removeAssignee, btn.dataset.personKey);
        render();
        if (onModalClose && inModal(btn)) { onModalClose(); detail(btn.dataset.removeAssignee); }
      };
    });
    scope.querySelectorAll('[data-quick-add-btn]').forEach(btn => {
      btn.onclick = () => {
        const tid = btn.dataset.quickAddBtn;
        const sel = scope.querySelector(`[data-quick-add-select="${CSS.escape(tid)}"]`);
        if (!sel?.value) return;
        try {
          addAssigneeToTask(tid, JSON.parse(sel.value));
          window.StarkSystemUI?.notice('Person added to task.');
          render();
          if (onModalClose && inModal(btn)) { onModalClose(); detail(tid); }
        } catch (err) { window.StarkSystemUI?.notice(err.message, true); }
      };
    });
    scope.querySelectorAll('[data-note-form]').forEach(form => {
      form.onsubmit = e => {
        e.preventDefault();
        const tid = form.dataset.noteForm;
        const inp = form.querySelector('input');
        const task = tasks().find(t => t.id === tid);
        if (!task) return;
        if (!inp?.value.trim()) return window.StarkSystemUI?.notice('Enter a note before posting.', true);
        try {
          addNote(tid, inp.value.trim(), task.updatedAt, task.version || 0);
          inp.value = '';
          window.StarkSystemUI?.notice('Note added.');
          render();
          if (onModalClose && inModal(form)) { onModalClose(); detail(tid); }
        } catch (err) { window.StarkSystemUI?.notice(err.message, true); }
      };
    });
  }

  function dueReminders(now = Date.now()) {
    let seen = {};
    try { seen = JSON.parse(store.getItem(REMINDER_SEEN_KEY) || '{}'); } catch (_) {}
    return tasks().filter(t => t.status !== 'DONE' && t.reminderAt && Date.parse(t.reminderAt) <= now && seen[t.id] !== t.reminderAt && (!access().userId || t.ownerUserId === access().userId || t.ownerUserId === 'local'));
  }

  function dismiss(id) {
    const task = tasks().find(t => t.id === id);
    if (!task) return;
    let seen = {};
    try { seen = JSON.parse(store.getItem(REMINDER_SEEN_KEY) || '{}'); } catch (_) {}
    seen[task.id] = task.reminderAt;
    store.setItem(REMINDER_SEEN_KEY, JSON.stringify(seen));
    checkReminders();
  }

  function checkReminders() {
    if (!document.body || !window.StarkSystemUI) return;
    const due = dueReminders();
    let tray = document.querySelector('#task-reminder-tray');
    if (!due.length) { tray?.remove(); return; }
    if (!tray) {
      tray = document.createElement('aside');
      tray.id = 'task-reminder-tray';
      tray.className = 'task-reminder-tray';
      tray.setAttribute('aria-label', 'Task reminders');
      tray.setAttribute('aria-live', 'polite');
      document.body.append(tray);
    }
    const signature = due.slice(0, 3).map(t => t.id + t.reminderAt + t.title + (t.assignees?.length || 0)).join('|');
    if (tray.dataset.signature === signature) return;
    tray.dataset.signature = signature;
    tray.innerHTML = due.slice(0, 3).map(task => {
      const team = (task.assignees || []).map(a => a.name).join(', ');
      return `
        <div class="task-reminder">
          <div class="task-reminder-head">
            <strong>🔔 Task Reminder</strong>
            <span class="tsk-tier-mini tier-${esc((task.priority || 'NORMAL').toLowerCase())}">${esc(task.priority || 'NORMAL')}</span>
          </div>
          <a href="${S.url('tasks.html?task=' + encodeURIComponent(task.id))}">${esc(task.title)}</a>
          <span>${esc(when(task.dueAt || task.reminderAt))}${team ? ' · 👥 ' + esc(team) : ''}</span>
          <div class="task-reminder-actions">
            <button type="button" class="sys-btn" data-tray-remind="${esc(task.id)}">Notify Team</button>
            <button type="button" class="sys-btn" data-dismiss-reminder="${esc(task.id)}">Dismiss</button>
          </div>
        </div>`;
    }).join('');
    tray.querySelectorAll('[data-dismiss-reminder]').forEach(button => { button.onclick = () => dismiss(button.dataset.dismissReminder); });
    tray.querySelectorAll('[data-tray-remind]').forEach(button => { button.onclick = () => openReminderModal(button.dataset.trayRemind); });
  }

  function renderTaskCard(item) {
    const { task, analysis } = item;
    const isSel = selected === task.id;
    const now = Date.now();
    const isOverdue = task.status !== 'DONE' && task.dueAt && Date.parse(task.dueAt) < now;
    const people = task.assignees || [];
    const shownPeople = people.slice(0, 3);
    const extraCount = Math.max(0, people.length - 3);
    const topInsight = analysis.reasons[0] || '';

    return `
      <article class="tsk-card tier-border-${analysis.tier.toLowerCase()} ${isSel ? 'is-selected' : ''} ${task.status === 'DONE' ? 'is-done' : ''}" data-card-id="${esc(task.id)}">
        <div class="tsk-card-top">
          <div class="tsk-card-badges">
            ${analysis.rank ? `<span class="tsk-rank-num tier-${analysis.tier.toLowerCase()}" title="MK Co-Pilot Priority Rank">#${analysis.rank}</span>` : `<span class="tsk-rank-num tier-done">✓</span>`}
            <span class="tsk-score-pill tier-${analysis.tier.toLowerCase()}">MK ${analysis.score} · ${esc(analysis.tier)}</span>
            ${task.autoCreatedBy === 'mk-copilot' ? `<span class="tsk-auto-badge">✨ MK Auto</span>` : ''}
            <span class="tsk-cat-pill">${esc(analysis.category)}</span>
          </div>
          <span class="tsk-status-chip status-${task.status.toLowerCase()}">${esc(task.status.replace('_', ' '))}</span>
        </div>

        <h3 class="tsk-card-title"><button type="button" data-task-open="${esc(task.id)}">${esc(task.title)}</button></h3>
        ${task.notes ? `<p class="tsk-card-snippet">${esc(task.notes.replace(/\s+/g, ' ').slice(0, 145))}${task.notes.length > 145 ? '…' : ''}</p>` : ''}

        ${analysis.references.length ? `
          <div class="tsk-ref-row">
            ${analysis.references.slice(0, 4).map(ref => {
              const href = safeUrl(ref.path);
              return `<a class="tsk-ref-chip ref-${ref.type.toLowerCase()}" href="${esc(href || '#')}" title="${esc(ref.detail)}">${esc(ref.type.replace('_', ' '))}: ${esc(ref.code)} ↗</a>`;
            }).join('')}
          </div>` : ''}

        ${topInsight ? `<div class="tsk-card-insight"><span>✨</span><p>${esc(topInsight)}</p></div>` : ''}

        <div class="tsk-card-foot">
          <div class="tsk-card-people-meta">
            ${people.length ? `
              <div class="tsk-avatar-stack" title="${esc(people.map(p => p.name).join(', '))}">
                ${shownPeople.map(p => `<span class="tsk-avatar-xs" style="background:${esc(p.color || '#087f78')}">${esc(p.avatar || initials(p.name))}</span>`).join('')}
                ${extraCount > 0 ? `<span class="tsk-avatar-xs tsk-avatar-more">+${extraCount}</span>` : ''}
                <span class="tsk-people-names">${esc(people.length === 1 ? people[0].name : `${people[0].name} +${people.length - 1}`)}</span>
              </div>` : `<span class="tsk-unassigned">Unassigned</span>`}
            <span class="tsk-due-chip ${isOverdue ? 'is-overdue' : ''}">
              ${isOverdue ? '⚠ Overdue' : task.dueAt ? '📅 ' + esc(relTime(task.dueAt) || when(task.dueAt)) : 'No due date'}
            </span>
            ${task.lastRemindedAt ? `<span class="tsk-reminded-chip" title="Last reminder sent ${esc(when(task.lastRemindedAt))}">🔔 Reminded ${esc(relTime(task.lastRemindedAt))}</span>` : ''}
          </div>
          <div class="tsk-card-actions">
            <button type="button" class="tsk-act-btn tsk-act-remind" data-task-remind="${esc(task.id)}" title="Send reminder to involved people">🔔 Remind</button>
            <button type="button" class="tsk-act-btn" data-task-edit="${esc(task.id)}" title="Edit task">Edit</button>
            <button type="button" class="tsk-act-btn tsk-act-done" data-task-status="${esc(task.id)}" data-status="${task.status === 'DONE' ? 'OPEN' : 'DONE'}">${task.status === 'DONE' ? 'Reopen' : '✓ Done'}</button>
          </div>
        </div>
      </article>`;
  }

  function render() {
    const host = document.querySelector('#tasks-content');
    if (!host) return;

    const allAnalyzed = analyzeAll();
    const activeItems = allAnalyzed.filter(x => x.task.status !== 'DONE');
    const autoResolvedItems = allAnalyzed.filter(x => x.task.status === 'DONE' && x.task.autoResolved);
    const now = Date.now();
    const criticalHighCount = activeItems.filter(x => ['CRITICAL', 'HIGH'].includes(x.analysis.tier)).length;
    const multiPersonCount = activeItems.filter(x => (x.task.assignees || []).length >= 2).length;
    const overdueSoonCount = activeItems.filter(x => x.task.dueAt && Date.parse(x.task.dueAt) <= now + 86400000).length;
    const roster = getTeamRoster();
    const mailInboxCount = getMailThreads().filter(t => t.folder === 'inbox').length;

    // Filter visible items
    let visible = allAnalyzed.filter(({ task }) => {
      if (viewMode === 'autoresolved') return task.status === 'DONE' && task.autoResolved;
      if (filter === 'active') return task.status !== 'DONE';
      if (filter === 'auto') return task.status !== 'DONE' && task.autoCreatedBy === 'mk-copilot';
      if (filter === 'team') return task.status !== 'DONE' && (task.assignees || []).length >= 2;
      if (filter === 'overdue') return task.status !== 'DONE' && task.dueAt && Date.parse(task.dueAt) < now;
      if (filter === 'done') return task.status === 'DONE';
      return true;
    });

    if (assigneeFilter !== 'all') {
      visible = visible.filter(({ task }) => (task.assignees || []).some(a => (a.email || a.name || a.id).toLowerCase() === assigneeFilter.toLowerCase()));
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      visible = visible.filter(({ task, analysis }) => {
        const hay = [
          task.title,
          task.notes,
          analysis.category,
          analysis.tier,
          ...(task.assignees || []).map(a => `${a.name} ${a.email} ${a.role}`),
          ...(analysis.references || []).map(r => `${r.code} ${r.label}`),
          ...(task.comments || []).map(c => c.text)
        ].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }

    // Ensure valid selection for right inspector
    if (!selected || !allAnalyzed.some(x => x.task.id === selected)) {
      selected = visible[0]?.task.id || activeItems[0]?.task.id || allAnalyzed[0]?.task.id || '';
    }
    const selectedItem = allAnalyzed.find(x => x.task.id === selected) || null;

    let bodyHtml = '';
    if (viewMode === 'priority') {
      bodyHtml = `
        <div class="tsk-split-layout">
          <div class="tsk-queue-col">
            <div class="tsk-queue-header">
              <span>Showing <strong>${visible.length}</strong> task${visible.length === 1 ? '' : 's'} · Ranked by MK Co-Pilot ERP Impact Score</span>
              <span class="tsk-sync-dot"><i></i> Live ERP &amp; Mail Sync</span>
            </div>
            <div class="tsk-list">
              ${visible.length ? visible.map(renderTaskCard).join('') : `
                <div class="tsk-empty-state">
                  <strong>No tasks match this filter</strong>
                  <p>Create a task mentioning any PO #, Order #, or SKU, or run MK Auto-Scan to inspect Mail &amp; Inventory.</p>
                  <button type="button" class="tsk-btn-teal" id="tsk-empty-create">＋ Create Task</button>
                </div>`}
            </div>
          </div>
          <aside class="tsk-inspector-col" aria-label="Task inspector and MK Co-Pilot analysis">
            ${renderInspectorHtml(selectedItem, false)}
          </aside>
        </div>`;
    } else if (viewMode === 'board') {
      const cols = [
        { id: 'OPEN', title: 'Open Queue', items: visible.filter(x => x.task.status === 'OPEN') },
        { id: 'IN_PROGRESS', title: 'In Progress', items: visible.filter(x => x.task.status === 'IN_PROGRESS') },
        { id: 'DONE', title: 'Completed', items: allAnalyzed.filter(x => x.task.status === 'DONE').slice(0, 12) }
      ];
      bodyHtml = `
        <div class="tsk-kanban-grid">
          ${cols.map(col => `
            <section class="tsk-kanban-col">
              <header class="tsk-kanban-head">
                <h3>${esc(col.title)}</h3>
                <span>${col.items.length}</span>
              </header>
              <div class="tsk-kanban-cards">
                ${col.items.length ? col.items.map(renderTaskCard).join('') : '<div class="tsk-kanban-empty">No tasks in this stage</div>'}
              </div>
            </section>
          `).join('')}
        </div>`;
    } else if (viewMode === 'people') {
      const groups = roster.map(person => {
        const pKey = (person.email || person.name).toLowerCase();
        const items = activeItems.filter(({ task }) => (task.assignees || []).some(a => (a.email || a.name).toLowerCase() === pKey));
        return { person, items };
      });
      const unassigned = activeItems.filter(({ task }) => !(task.assignees || []).length);
      bodyHtml = `
        <div class="tsk-people-grid">
          ${groups.map(({ person, items }) => `
            <section class="tsk-person-col">
              <header class="tsk-person-col-head">
                <span class="tsk-avatar-md" style="background:${esc(person.color)}">${esc(person.avatar)}</span>
                <div>
                  <h3>${esc(person.name)}</h3>
                  <small>${esc(person.role)} · ${esc(person.email)}</small>
                </div>
                <span class="tsk-person-count">${items.length}</span>
              </header>
              <div class="tsk-person-tasks">
                ${items.length ? items.map(renderTaskCard).join('') : '<div class="tsk-kanban-empty">No active tasks assigned</div>'}
              </div>
            </section>
          `).join('')}
          ${unassigned.length ? `
            <section class="tsk-person-col">
              <header class="tsk-person-col-head">
                <span class="tsk-avatar-md" style="background:#64748b">?</span>
                <div><h3>Unassigned</h3><small>Tasks awaiting owner assignment</small></div>
                <span class="tsk-person-count">${unassigned.length}</span>
              </header>
              <div class="tsk-person-tasks">${unassigned.map(renderTaskCard).join('')}</div>
            </section>` : ''}
        </div>`;
    } else {
      bodyHtml = `
        <div class="tsk-autoresolved-panel">
          <div class="tsk-autoresolved-head">
            <div>
              <h2>✨ Auto-Resolved by MK Co-Pilot (${autoResolvedItems.length})</h2>
              <p>When a requested tracking number is provided or a covering Vendor PO is issued, MK Co-Pilot automatically verifies the update and removes the task from your Active queue.</p>
            </div>
          </div>
          ${autoResolvedItems.length ? `
            <div class="tsk-autoresolved-list">
              ${autoResolvedItems.map(({ task, analysis }) => `
                <article class="tsk-resolved-card">
                  <div class="tsk-resolved-badge">✨ Auto-Closed · ${esc(relTime(task.autoResolvedAt) || when(task.autoResolvedAt))}</div>
                  <h3><button type="button" data-task-open="${esc(task.id)}">${esc(task.title)}</button></h3>
                  <p class="tsk-resolved-reason">${esc(task.autoResolvedReason || 'Condition verified and resolved by MK Co-Pilot.')}</p>
                  <div class="tsk-resolved-foot">
                    <span>Category: <b>${esc(analysis.category)}</b></span>
                    <span>Resolved: <b>${esc(when(task.autoResolvedAt))}</b></span>
                    ${task.sourcePath ? `<a href="${esc(safeUrl(task.sourcePath))}">Inspect Record ↗</a>` : ''}
                  </div>
                </article>
              `).join('')}
            </div>` : `
            <div class="tsk-empty-state">
              <strong>No auto-resolved tasks yet</strong>
              <p>Reply to a tracking request in MK97 Mail (or use “Provide Tracking &amp; Auto-Resolve” / “Issue Covering Vendor PO” on an MK Auto task) to see it automatically disappear from Active and log here.</p>
            </div>`}
        </div>`;
    }

    host.innerHTML = `
      <div class="tasks-workspace-nav" role="navigation" aria-label="Workspace View">
        <div class="workspace-view-switch" role="tablist" aria-label="Workspace View">
          <a class="workspace-view-tab" href="${S.url('workspace.html?view=operations')}" role="tab">Operations</a>
          <a class="workspace-view-tab" href="${S.url('workspace.html?view=modules')}" role="tab">Modules</a>
          <a class="workspace-view-tab" href="${S.url('workspace.html?view=telemetry')}" role="tab">Analytics</a>
          <a class="workspace-view-tab" href="${S.url('mail.html')}" role="tab">MK97 Mail${mailInboxCount > 0 ? ` <span class="workspace-mail-pill">${mailInboxCount}</span>` : ''}</a>
          <a class="workspace-view-tab active" href="${S.url('tasks.html')}" role="tab" aria-selected="true" aria-current="page">Tasks${activeItems.length > 0 ? ` <span class="workspace-task-pill">${activeItems.length}</span>` : ''}</a>
        </div>
      </div>

      <section class="tsk-shell">
        <header class="tsk-hero">
          <div class="tsk-hero-copy">
            <span class="tsk-hero-eyebrow"><i class="tsk-pulse"></i> MK CO-PILOT AUTONOMOUS TASK ENGINE</span>
            <h1>Tasks &amp; Team Reminders</h1>
            <p>AI-prioritized across Orders, Vendor POs, Inventory, 3PL &amp; MK97 Mail — with multi-person reminders and automatic resolution.</p>
          </div>
          <div class="tsk-hero-actions">
            <button type="button" class="tsk-hero-btn tsk-hero-primary" id="task-create">＋ New Task</button>
            <button type="button" class="tsk-hero-btn tsk-hero-secondary" id="task-auto-scan" title="Scan Mail inbox, Inventory levels &amp; 3PL for new tasks or resolved conditions">⚡ MK Auto-Scan</button>
            <button type="button" class="tsk-hero-btn tsk-hero-ghost" id="task-rerank" title="Re-analyze all task references across the ERP and sort priority order">🎯 Re-Rank Priority</button>
          </div>
        </header>

        <div class="tsk-kpi-grid">
          <button type="button" class="tsk-kpi-card ${viewMode === 'priority' && filter === 'active' ? 'is-active' : ''}" data-kpi-jump="active">
            <span class="tsk-kpi-label">Active Tasks</span>
            <strong>${activeItems.length}</strong>
            <small>Synced across workspace</small>
          </button>
          <button type="button" class="tsk-kpi-card kpi-critical" data-kpi-jump="priority">
            <span class="tsk-kpi-label">Critical / High AI</span>
            <strong>${criticalHighCount}</strong>
            <small>Ranked by MK Co-Pilot</small>
          </button>
          <button type="button" class="tsk-kpi-card kpi-team ${filter === 'team' ? 'is-active' : ''}" data-kpi-jump="team">
            <span class="tsk-kpi-label">Multi-Person (2+)</span>
            <strong>${multiPersonCount}</strong>
            <small>Collaborative team tasks</small>
          </button>
          <button type="button" class="tsk-kpi-card kpi-warn ${filter === 'overdue' ? 'is-active' : ''}" data-kpi-jump="overdue">
            <span class="tsk-kpi-label">Overdue / Due 24h</span>
            <strong>${overdueSoonCount}</strong>
            <small>Needs reminder or action</small>
          </button>
          <button type="button" class="tsk-kpi-card kpi-ai ${viewMode === 'autoresolved' ? 'is-active' : ''}" data-kpi-jump="autoresolved">
            <span class="tsk-kpi-label">Auto-Resolved by MK</span>
            <strong>${autoResolvedItems.length}</strong>
            <small>Cleared on verification</small>
          </button>
        </div>

        <div class="tsk-toolbar">
          <div class="tsk-view-tabs" role="tablist" aria-label="Task Views">
            <button type="button" class="tsk-view-tab ${viewMode === 'priority' ? 'active' : ''}" data-view-mode="priority">🎯 MK Priority Order</button>
            <button type="button" class="tsk-view-tab ${viewMode === 'board' ? 'active' : ''}" data-view-mode="board">📋 Board</button>
            <button type="button" class="tsk-view-tab ${viewMode === 'people' ? 'active' : ''}" data-view-mode="people">👥 By Person</button>
            <button type="button" class="tsk-view-tab ${viewMode === 'autoresolved' ? 'active' : ''}" data-view-mode="autoresolved">✨ Auto-Resolved (${autoResolvedItems.length})</button>
          </div>

          <div class="tsk-controls-right">
            <div class="tsk-filter-pills" role="group" aria-label="Filter tasks">
              ${[['active', 'Active'], ['auto', '✨ MK Auto'], ['team', '2+ People'], ['overdue', 'Overdue'], ['done', 'Completed'], ['all', 'All']].map(([id, label]) => `
                <button type="button" class="tsk-pill ${filter === id && viewMode !== 'autoresolved' ? 'active' : ''}" data-task-filter="${id}" aria-pressed="${filter === id}">${label}</button>
              `).join('')}
            </div>

            <div class="tsk-search-group">
              <select id="tsk-assignee-filter" aria-label="Filter by person">
                <option value="all">All People</option>
                ${roster.map(m => `<option value="${esc(m.email || m.name)}" ${assigneeFilter.toLowerCase() === (m.email || m.name).toLowerCase() ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
              </select>
              <input id="task-search" type="search" value="${esc(query)}" placeholder="Search PO #, Order #, SKU, person…" aria-label="Search tasks">
            </div>
          </div>
        </div>

        ${bodyHtml}
      </section>`;

    // Bind top actions
    host.querySelector('#task-create').onclick = () => edit();
    host.querySelector('#tsk-empty-create')?.addEventListener('click', () => edit());
    host.querySelector('#task-auto-scan').onclick = () => {
      runCopilotSync({ silent: false, force: true });
      render();
    };
    host.querySelector('#task-rerank').onclick = () => {
      viewMode = 'priority';
      filter = 'active';
      render();
      const top = analyzeAll().filter(x => x.task.status !== 'DONE')[0];
      window.StarkSystemUI?.notice(top ? `🎯 MK Co-Pilot ranked ${activeItems.length} active task(s). #1 Priority: "${top.task.title}" (Score ${top.analysis.score}/100).` : 'No active tasks to rank.');
    };

    // Bind KPI jump cards
    host.querySelectorAll('[data-kpi-jump]').forEach(btn => {
      btn.onclick = () => {
        const target = btn.dataset.kpiJump;
        if (target === 'autoresolved') { viewMode = 'autoresolved'; }
        else { viewMode = 'priority'; filter = target === 'priority' ? 'active' : target; }
        render();
      };
    });

    // Bind View Tabs & Filters
    host.querySelectorAll('[data-view-mode]').forEach(btn => {
      btn.onclick = () => { viewMode = btn.dataset.viewMode; render(); };
    });
    host.querySelectorAll('[data-task-filter]').forEach(btn => {
      btn.onclick = () => {
        if (viewMode === 'autoresolved') viewMode = 'priority';
        filter = btn.dataset.taskFilter;
        render();
      };
    });
    host.querySelector('#tsk-assignee-filter').onchange = e => { assigneeFilter = e.target.value; render(); };
    const searchEl = host.querySelector('#task-search');
    searchEl.oninput = event => {
      const cursor = event.target.selectionStart;
      query = event.target.value;
      render();
      const next = document.querySelector('#task-search');
      if (next) { next.focus(); try { next.setSelectionRange(cursor, cursor); } catch (_) {} }
    };

    // Bind Task Cards
    host.querySelectorAll('[data-card-id]').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('button, a, select, input')) return;
        const tid = card.dataset.cardId;
        if (window.innerWidth <= 1060 || viewMode !== 'priority') detail(tid);
        else { selected = tid; render(); }
      });
    });
    host.querySelectorAll('[data-task-open]').forEach(btn => {
      btn.onclick = () => detail(btn.dataset.taskOpen);
    });
    host.querySelectorAll('[data-task-edit]').forEach(btn => {
      btn.onclick = () => edit(btn.dataset.taskEdit);
    });
    host.querySelectorAll('[data-task-remind]').forEach(btn => {
      btn.onclick = () => openReminderModal(btn.dataset.taskRemind);
    });
    host.querySelectorAll('[data-task-status]').forEach(btn => {
      btn.onclick = () => {
        try {
          setStatus(btn.dataset.taskStatus, btn.dataset.status);
          render();
        } catch (err) { window.StarkSystemUI?.notice(err.message, true); }
      };
    });

    // Bind Right Inspector
    const inspCol = host.querySelector('.tsk-inspector-col');
    if (inspCol) bindInspectorInteractions(inspCol);
  }

  function updateGlobalTaskPills() {
    const activeCount = tasks().filter(t => t.status !== 'DONE').length;
    document.querySelectorAll('.workspace-task-pill').forEach(pill => {
      pill.textContent = String(activeCount);
      pill.hidden = activeCount === 0;
    });
  }

  function initialize() {
    // Run autonomous MK Co-Pilot sync once on load so Mail tracking requests & Low-Stock POs stay live site-wide
    try { runCopilotSync({ silent: true }); } catch (err) { console.warn('[MK97 Tasks] Initial sync note:', err); }
    render();
    checkReminders();
    updateGlobalTaskPills();
    if (document.querySelector('#tasks-content')) {
      const id = new URLSearchParams(location.search).get('task');
      if (id) detail(id);
    }
    timer = setInterval(() => {
      checkReminders();
    }, 30000);
  }

  window.MK97Tasks = window.StarkTasks = {
    save,
    addNote,
    setStatus,
    remove,
    tasks,
    edit,
    detail,
    dueReminders,
    dismiss,
    checkReminders,
    localISO,
    getTeamRoster,
    getMailThreads,
    analyzeTask,
    analyzeAll,
    runCopilotSync,
    sendReminder,
    openReminderModal,
    provideTrackingForTask,
    quickCreateVendorPO
  };

  window.addEventListener('stark:system-change', () => {
    if (!syncInProgress) {
      try { runCopilotSync({ silent: true }); } catch (_) {}
    }
    render();
    checkReminders();
    updateGlobalTaskPills();
  });
  window.addEventListener('mk97:mail-updated', () => {
    if (!syncInProgress) {
      try { runCopilotSync({ silent: true, notifyResolved: true }); } catch (_) {}
    }
    render();
    updateGlobalTaskPills();
  });
  window.addEventListener('storage', e => {
    if (e.key === MAIL_BRIDGE_KEY && !syncInProgress) {
      try { runCopilotSync({ silent: true, notifyResolved: true }); } catch (_) {}
      render();
      updateGlobalTaskPills();
    }
  });
  window.addEventListener('stark:cloud-status', render);
  window.addEventListener('focus', () => {
    if (!syncInProgress) {
      try { runCopilotSync({ silent: true, notifyResolved: true }); } catch (_) {}
    }
    checkReminders();
    render();
  });
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      clearInterval(timer);
      timer = setInterval(checkReminders, 30000);
      checkReminders();
      render();
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();

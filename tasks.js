(function () {
  'use strict';
  const S=window.StarkSystem;if(!S || window.StarkTasks)return;
  const store=window.StarkWorkspace?.localStorage || window.localStorage;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const states=['OPEN','IN_PROGRESS','DONE'],priorities=['NORMAL','HIGH','LOW'];
  const when=value=>value?new Date(value).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'Not set';
  const tasks=()=>S.getState().tasks || [];
  const access=()=>window.StarkSystemCloud?.getAccess?.() || {};
  let filter='active',query='',selected='',timer;
  function iso(value) {
    if(!value)return '';
    const d=new Date(value);if(!Number.isFinite(d.getTime()))throw new Error('Choose a valid date and time.');
    return d.toISOString();
  }
  function localValue(value) {
    if(!value)return '';const d=new Date(value);
    return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  }
  function localISO(value) {
    if(!value)return '';
    const result=iso(value);if(localValue(result)!==value)throw new Error('This local time does not exist in your time zone. Choose another time.');
    return result;
  }
  function save(input,id) {
    const title=String(input.title||'').trim(),notes=String(input.notes||'').trim();
    if(!title || title.length>160)throw new Error('Enter a task title of 1–160 characters.');
    if(notes.length>20000)throw new Error('Keep notes within 20,000 characters.');
    const dueAt=iso(input.dueAt),reminderAt=iso(input.reminderAt);
    if(reminderAt && dueAt && reminderAt>dueAt)throw new Error('Set the reminder at or before the due time.');
    if(!priorities.includes(input.priority || 'NORMAL') || !states.includes(input.status || 'OPEN'))throw new Error('Choose a valid task status and priority.');
    let savedId;
    S.transaction(id?'TASK_UPDATED':'TASK_CREATED',title,state=>{
      state.tasks ||= [];
      let task=id?state.tasks.find(t=>t.id===id):null;
      if(id && !task)throw new Error('This task was removed. Refresh the page.');
      if((input.expectedVersion!==undefined && (task?.version || 0)!==input.expectedVersion) || (input.expectedUpdatedAt && task?.updatedAt!==input.expectedUpdatedAt))throw new Error('This task changed in another tab. Reopen it before saving.');
      if(reminderAt && reminderAt!==task?.reminderAt && new Date(reminderAt)<=new Date())throw new Error('Choose a future reminder time.');
      const now=new Date().toISOString();
      if(!task){task={id:S.uid('task'),createdAt:now,createdBy:access().userId || 'local',ownerUserId:access().userId || 'local',comments:[]};state.tasks.push(task);}
      task.version=(task.version || 0)+1;
      Object.assign(task,{title,notes,dueAt,reminderAt,priority:input.priority || 'NORMAL',status:input.status || 'OPEN',updatedAt:now});
      task.completedAt=task.status==='DONE'?(task.completedAt || now):'';savedId=task.id;
    });return savedId;
  }
  function addNote(id,text,expectedUpdatedAt,expectedVersion) {
    text=String(text||'').trim();if(!text || text.length>5000)throw new Error('Enter a note of 1–5,000 characters.');
    S.transaction('TASK_NOTE_ADDED',id,state=>{
      const task=(state.tasks||[]).find(t=>t.id===id);if(!task)throw new Error('Task not found.');
      if((expectedVersion!==undefined && (task.version || 0)!==expectedVersion) || (expectedUpdatedAt && task.updatedAt!==expectedUpdatedAt))throw new Error('This task changed. Reopen it before adding a note.');
      task.comments ||= [];if(task.comments.length>=200)throw new Error('This task already has 200 notes. Edit its description instead.');
      task.version=(task.version || 0)+1;task.updatedAt=new Date().toISOString();task.comments.push({id:S.uid('note'),text,time:task.updatedAt,author:access().userId || 'local'});
    });
  }
  function edit(id) {
    const task=tasks().find(t=>t.id===id);if(id && !task)return;
    const dialog=window.StarkSystemUI.dialog(task?'Edit task':'Create task',`
      <div class="task-form"><label>Task title<input id="task-title" maxlength="160" required value="${esc(task?.title || '')}"></label>
      <div class="form-grid"><label>Due date and time<input id="task-due" type="datetime-local" value="${localValue(task?.dueAt)}"></label>
      <label>Reminder<input id="task-reminder" type="datetime-local" value="${localValue(task?.reminderAt)}"></label>
      <label>Priority<select id="task-priority">${priorities.map(p=>`<option ${p===(task?.priority || 'NORMAL')?'selected':''}>${p}</option>`).join('')}</select></label>
      <label>Status<select id="task-status">${states.map(p=>`<option value="${p}" ${p===(task?.status || 'OPEN')?'selected':''}>${p.replace('_',' ')}</option>`).join('')}</select></label></div>
      <label>Notes<textarea id="task-notes" rows="5" maxlength="20000">${esc(task?.notes || '')}</textarea></label>
      <p class="task-help">Times use ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}. Reminders appear while a workspace page is open. Connected organization tasks also support scheduled email reminders.</p></div>`,wrap=>{
        const value=key=>wrap.querySelector('#task-'+key).value;
        selected=save({title:value('title'),notes:value('notes'),dueAt:localISO(value('due')),reminderAt:localISO(value('reminder')),priority:value('priority'),status:value('status'),expectedUpdatedAt:task?.updatedAt,expectedVersion:task?(task.version || 0):undefined},id);
        render();window.StarkSystemUI.notice(task?'Task updated.':'Task created.');
      },'Save task',{system:true});
    return dialog;
  }
  function setStatus(id,status) {
    S.transaction('TASK_STATUS_CHANGED',id,state=>{
      const task=(state.tasks||[]).find(t=>t.id===id);if(!task || !states.includes(status))throw new Error('Task not found.');
      task.version=(task.version || 0)+1;task.status=status;task.updatedAt=new Date().toISOString();task.completedAt=status==='DONE'?task.updatedAt:'';
    });
  }
  function detail(id) {
    selected=id;const task=tasks().find(t=>t.id===id);if(!task)return;
    const dialog=window.StarkSystemUI.dialog(task.title,`
      <p><strong>${esc(task.status.replace('_',' '))}</strong> · ${esc(task.priority)} priority</p>
      <p>Due: ${esc(when(task.dueAt))}<br>Reminder: ${esc(when(task.reminderAt))}</p>
      <p class="task-note-text">${esc(task.notes || 'No notes yet.')}</p>
      <div class="task-comments">${(task.comments||[]).map(n=>`<article><time>${esc(when(n.time))}</time><p class="task-note-text">${esc(n.text)}</p></article>`).join('')}</div>
      <label>Add a note<textarea id="task-new-note" rows="3" maxlength="5000" required></textarea></label>`,wrap=>{
        addNote(id,wrap.querySelector('#task-new-note').value,task.updatedAt,task.version || 0);window.StarkSystemUI.notice('Note added.');
      },'Add note',{system:true});return dialog;
  }
  function dueReminders(now=Date.now()) {
    let seen={};try{seen=JSON.parse(store.getItem('stark.tasks.remindersSeen.v1')||'{}');}catch(_){}
    return tasks().filter(t=>t.status!=='DONE' && t.reminderAt && Date.parse(t.reminderAt)<=now && seen[t.id]!==t.reminderAt && (!access().userId || t.ownerUserId===access().userId || t.ownerUserId==='local'));
  }
  function dismiss(id) {
    const task=tasks().find(t=>t.id===id);if(!task)return;
    let seen={};try{seen=JSON.parse(store.getItem('stark.tasks.remindersSeen.v1')||'{}');}catch(_){}
    seen[task.id]=task.reminderAt;store.setItem('stark.tasks.remindersSeen.v1',JSON.stringify(seen));checkReminders();
  }
  function checkReminders() {
    if(!document.body || !window.StarkSystemUI)return;
    const due=dueReminders();let tray=document.querySelector('#task-reminder-tray');
    if(!due.length){tray?.remove();return;}
    if(!tray){tray=document.createElement('aside');tray.id='task-reminder-tray';tray.className='task-reminder-tray';tray.setAttribute('aria-label','Task reminders');tray.setAttribute('aria-live','polite');document.body.append(tray);}
    const signature=due.slice(0,3).map(t=>t.id+t.reminderAt+t.title).join('|');if(tray.dataset.signature===signature)return;tray.dataset.signature=signature;
    tray.innerHTML=due.slice(0,3).map(task=>`<div class="task-reminder"><strong>Task reminder</strong><a href="${S.url('tasks.html?task='+encodeURIComponent(task.id))}">${esc(task.title)}</a><span>${esc(when(task.dueAt || task.reminderAt))}</span><button class="sys-btn" data-dismiss-reminder="${esc(task.id)}">Dismiss</button></div>`).join('');
    tray.querySelectorAll('[data-dismiss-reminder]').forEach(button=>button.onclick=()=>dismiss(button.dataset.dismissReminder));
  }
  function render() {
    const host=document.querySelector('#tasks-content');if(!host)return;
    const all=tasks(),active=all.filter(t=>t.status!=='DONE'),now=Date.now();
    let visible=all.filter(t=>filter==='all' || (filter==='done'?t.status==='DONE':filter==='overdue'?t.status!=='DONE' && t.dueAt && Date.parse(t.dueAt)<now:t.status!=='DONE'));
    visible=visible.filter(t=>(t.title+' '+t.notes+' '+(t.comments||[]).map(n=>n.text).join(' ')).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(a.dueAt || '9999').localeCompare(b.dueAt || '9999'));
    host.innerHTML=`<header class="tasks-heading"><div><span class="task-eyebrow">OPERATIONS WORKSPACE</span><h1>Tasks &amp; reminders</h1><p>Keep follow-ups, deadlines and notes together.</p></div><button class="sys-btn primary" id="task-create">＋ Create task</button></header>
      <div class="tasks-summary"><div><strong>${active.length}</strong><span>Active</span></div><div><strong>${active.filter(t=>t.dueAt && Date.parse(t.dueAt)<now).length}</strong><span>Overdue</span></div><div><strong>${all.filter(t=>t.status==='DONE').length}</strong><span>Completed</span></div></div>
      <section class="tasks-board"><div class="tasks-toolbar"><div role="group" aria-label="Filter tasks">${[['active','Active'],['overdue','Overdue'],['done','Completed'],['all','All tasks']].map(([id,label])=>`<button class="sys-btn ${filter===id?'primary':''}" data-task-filter="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div><label class="task-search">Search tasks<input id="task-search" type="search" value="${esc(query)}" placeholder="Search titles and notes"></label></div>
      <div class="task-list">${visible.length?visible.map(t=>`<article class="task-row ${t.status==='DONE'?'task-complete':''}"><div><span class="task-priority">${esc(t.priority)}</span><h2><button data-task-open="${esc(t.id)}">${esc(t.title)}</button></h2><p>${esc(t.notes.slice(0,150) || 'Add notes to keep the details together.')}</p><small>Due ${esc(when(t.dueAt))}${t.reminderAt?' · Reminder '+esc(when(t.reminderAt)):''}</small></div><div class="task-row-actions"><span>${esc(t.status.replace('_',' '))}</span><button class="sys-btn" data-task-edit="${esc(t.id)}">Edit</button><button class="sys-btn" data-task-status="${esc(t.id)}" data-status="${t.status==='DONE'?'OPEN':'DONE'}">${t.status==='DONE'?'Reopen':'Complete'}</button></div></article>`).join(''):'<div class="tasks-empty"><strong>No tasks here yet</strong><p>Create a task to save a follow-up, reminder or note.</p></div>'}</div></section>
      <p class="task-help">Reminders appear while your workspace is open. ${window.StarkWorkspace?.isDemo?'Demo tasks stay separate from working records.':window.StarkSystemCloud?.getStatus().active?'Email reminders use your signed-in account and the configured notification service.':'Connect your organization in Data Center to synchronize tasks and enable server email reminders.'}</p>`;
    host.querySelector('#task-create').onclick=()=>edit();
    host.querySelector('#task-search').oninput=event=>{const cursor=event.target.selectionStart;query=event.target.value;render();const search=host.querySelector('#task-search');search.focus();try{search.setSelectionRange(cursor,cursor);}catch(_){}};
    host.querySelectorAll('[data-task-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.taskFilter;render();});
    host.querySelectorAll('[data-task-edit]').forEach(button=>button.onclick=()=>edit(button.dataset.taskEdit));
    host.querySelectorAll('[data-task-open]').forEach(button=>button.onclick=()=>detail(button.dataset.taskOpen));
    host.querySelectorAll('[data-task-status]').forEach(button=>button.onclick=()=>{try{setStatus(button.dataset.taskStatus,button.dataset.status);}catch(error){window.StarkSystemUI.notice(error.message,true);}});
  }
  function initialize() {
    render();checkReminders();
    if(document.querySelector('#tasks-content')){const id=new URLSearchParams(location.search).get('task');if(id)detail(id);}
    timer=setInterval(()=>{checkReminders();},30000);
  }
  window.StarkTasks={save,addNote,setStatus,tasks,edit,detail,dueReminders,dismiss,checkReminders,localISO};
  window.addEventListener('stark:system-change',()=>{render();checkReminders();});
  window.addEventListener('stark:cloud-status',render);
  window.addEventListener('focus',checkReminders);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  window.addEventListener('pageshow',event=>{if(event.persisted){clearInterval(timer);timer=setInterval(checkReminders,30000);checkReminders();}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();

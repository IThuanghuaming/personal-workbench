const $ = selector => document.querySelector(selector);
const icons = {
  list: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m7 8 1 1 2-2m3 1h4m-10 6 1 1 2-2m3 1h4"/>',
  chart: '<path d="M4 4v16h16M8 16v-4m5 4V8m5 8V5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-3-3L5 16z"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dayKey = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
const dateLabel = value => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Hong_Kong', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const labels = { high: '高优先级', medium: '中优先级', low: '低优先级' };
const pages = {
  tasks: ['待办事项', '把每一天，安排得更从容。', '从一件小事开始，让计划一步步变成成果。', '新建事项'],
  progress: ['完成情况', '每一步前进，都看得见。', '回顾工作进展，让下一步更有方向。', '新建事项'],
  tools: ['常用工具', '好用的工具，就在手边。', '把常用的网站收在一起，让工作少一点来回。', '添加工具'],
};
let tasks = [], tools = [], filter = 'pending', page = 'tasks', editId = null, editType = 'tasks', loaded = false;
let toastTimer;
function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => $('#toast').hidden = true, 3200);
}
async function request(path, method = 'GET', body) {
  const response = await fetch(`/api/${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  let data;
  try { data = await response.json(); } catch { throw new Error('服务暂时无法访问，请稍后重试'); }
  if (!response.ok) throw new Error(data.error || '操作失败，请重试');
  return data;
}
async function load() {
  $('#retry').disabled = true;
  try {
    const result = await Promise.all([request('tasks'), request('tools')]);
    [tasks, tools] = result; loaded = true; $('#load-error').hidden = true; render();
  } catch (error) { $('#load-error span').textContent = error.message; $('#load-error').hidden = false; }
  finally { $('#retry').disabled = false; $('#add-button').disabled = !loaded; }
}
const empty = (title, description, action) => `<div class="empty"><span class="empty-icon">${icon(page === 'tools' ? 'grid' : 'list')}</span><h3>${escape(title)}</h3><p>${escape(description)}</p>${action ? `<button class="secondary" data-action="add">${escape(action)}</button>` : ''}</div>`;
function actions(id, type) {
  return `<div class="row-actions"><button class="icon-button" data-action="edit" data-id="${id}" data-type="${type}" aria-label="编辑">${icon('edit')}</button><button class="icon-button" data-action="delete" data-id="${id}" data-type="${type}" aria-label="删除">${icon('trash')}</button></div>`;
}
function taskRow(task, history = false) {
  const overdue = !task.completed && task.due_date && task.due_date < dayKey(new Date());
  return `<div class="task-row ${task.completed ? 'completed' : ''}"><button class="task-check ${task.completed ? 'checked' : ''}" data-action="toggle" data-id="${task.id}" aria-label="${task.completed ? '恢复待办' : '标记完成'}" aria-pressed="${Boolean(task.completed)}">${task.completed ? icon('check') : ''}</button><div class="task-info"><div class="task-title">${escape(task.title)}</div>${task.notes ? `<div class="task-notes">${escape(task.notes)}</div>` : ''}<div class="task-meta"><span class="badge priority-${task.priority}">${labels[task.priority]}</span>${task.due_date ? `<span class="${overdue ? 'overdue' : ''}">${overdue ? '已逾期 · ' : '截止 '}${escape(task.due_date)}</span>` : ''}${history && task.completed_at ? `<span>完成于 ${dateLabel(task.completed_at)}</span>` : ''}</div></div>${actions(task.id, 'tasks')}</div>`;
}
function render() {
  const done = tasks.filter(t => t.completed), pending = tasks.filter(t => !t.completed);
  const today = dayKey(new Date()), todayDone = done.filter(t => t.completed_at && dayKey(t.completed_at) === today).length;
  const rate = tasks.length ? Math.round(done.length / tasks.length * 100) : 0;
  $('#nav-count').textContent = pending.length;
  const stats = [['待完成事项', pending.length, '件', '为下一步，做好准备', 'list'], ['已完成事项', done.length, '件', '每一次完成，都是进步', 'check'], ['整体完成率', rate, '%', `共 ${tasks.length} 件事项`, 'chart'], ['今日完成', todayDone, '件', '记录今天的小小成就', 'clock']];
  $('#stats').innerHTML = stats.map(([label, value, unit, detail, image]) => `<div class="stat-card"><div class="stat-top">${label}<span class="stat-icon">${icon(image)}</span></div><div class="stat-value">${value}<small>${unit}</small></div><div class="stat-detail">${detail}</div></div>`).join('');
  const query = $('#search').value.trim().toLowerCase();
  const filtered = tasks.filter(t => (filter === 'all' || Boolean(t.completed) === (filter === 'done')) && `${t.title} ${t.notes}`.toLowerCase().includes(query)).sort((a, b) => a.completed - b.completed || ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));
  $('#task-count').textContent = filtered.length ? `${filtered.length} 件` : '';
  $('#task-list').innerHTML = filtered.length ? filtered.map(t => taskRow(t)).join('') : empty(query ? '没有找到匹配的事项' : filter === 'done' ? '还没有完成记录' : tasks.length ? '当前清单已全部完成' : '从第一件小事开始', query ? '试试其他关键词。' : '写下计划，让今天更有方向。', query || filter === 'done' ? '' : '＋ 新建事项');
  $('#quick-tools').innerHTML = tools.length ? tools.slice(0, 3).map(t => `<a class="quick-tool" href="${escape(t.url)}" target="_blank" rel="noopener noreferrer"><span class="tool-letter">${escape(t.name.charAt(0).toUpperCase())}</span><div>${escape(t.name)}<small>${escape(new URL(t.url).hostname)}</small></div><span>↗</span></a>`).join('') : '<div class="empty"><p>收藏常用网站，随时一键打开。</p><a class="secondary" href="#tools">添加你的工具 ↗</a></div>';
  $('#tools-grid').innerHTML = tools.length ? tools.map(t => `<div class="tool-card"><a href="${escape(t.url)}" target="_blank" rel="noopener noreferrer"><span class="tool-letter">${escape(t.name.charAt(0).toUpperCase())}</span><h3>${escape(t.name)}</h3><p>${escape(t.description || '你的常用网站')}</p><div class="tool-domain">${escape(new URL(t.url).hostname)}<span>↗</span></div></a>${actions(t.id, 'tools')}</div>`).join('') : empty('把常用工具收在这里', '添加一个网站，下次就能一键打开。', '＋ 添加工具');
  const days = Array.from({ length: 7 }, (_, i) => {
    const key = dayKey(new Date(Date.now() - (6 - i) * 86400000));
    return { key, count: done.filter(t => t.completed_at && dayKey(t.completed_at) === key).length };
  });
  const max = Math.max(1, ...days.map(d => d.count));
  $('#trend-chart').innerHTML = `<div class="bars" role="img" aria-label="最近七天完成数量：${days.map(d => `${d.key}：${d.count}件`).join('，')}">${days.map(d => `<div class="bar-group"><span class="bar-value">${d.count}</span><div class="bar" style="height:${d.count / max * 155}px"></div><span>${d.key.slice(5).replace('-', '/')}</span></div>`).join('')}</div>`;
  $('#donut-chart').innerHTML = `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(#80adf3 ${rate}%, #eaf1fb 0)" role="img" aria-label="完成率 ${rate}%"><div class="donut-hole">${rate}%<small>整体完成率</small></div></div><div class="legend"><span><i></i>已完成 ${done.length}</span><span><i></i>待完成 ${pending.length}</span></div></div>`;
  $('#history-list').innerHTML = done.length ? done.sort((a, b) => b.completed_at.localeCompare(a.completed_at)).map(t => taskRow(t, true)).join('') : empty('成果从第一次完成开始', '完成一个待办事项，就会在这里留下记录。');
}
function navigate() {
  page = location.hash.slice(1); if (!pages[page]) page = 'tasks';
  const [name, title, description, add] = pages[page];
  $('#breadcrumb').textContent = name; $('#page-title').textContent = title; $('#page-description').textContent = description; $('#add-label').textContent = add;
  Object.keys(pages).forEach(key => $(`#${key}-page`).hidden = key !== page);
  document.querySelectorAll('nav a').forEach(link => { const active = link.dataset.page === page; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
}
function editor(type = page === 'tools' ? 'tools' : 'tasks', id = null) {
  if (!loaded) return toast('请先等待数据加载完成');
  editType = type; editId = id; const item = (type === 'tasks' ? tasks : tools).find(t => t.id === id) || {};
  $('#dialog-title').textContent = `${id ? '编辑' : '新建'}${type === 'tasks' ? '事项' : '工具'}`;
  $('#form-fields').innerHTML = type === 'tasks' ? `<label>事项标题<input name="title" required maxlength="150" placeholder="准备做些什么？" value="${escape(item.title || '')}"></label><label>备注<textarea name="notes" maxlength="2000" placeholder="记录补充信息或具体步骤">${escape(item.notes || '')}</textarea></label><div class="field-pair"><label>优先级<select name="priority">${Object.entries(labels).map(([v, name]) => `<option value="${v}" ${v === (item.priority || 'medium') ? 'selected' : ''}>${name}</option>`).join('')}</select></label><label>截止日期<input type="date" name="due_date" value="${escape(item.due_date || '')}"></label></div>` : `<label>工具名称<input name="name" required maxlength="80" placeholder="例如：在线文档" value="${escape(item.name || '')}"></label><label>网站地址<input type="url" name="url" required maxlength="2000" placeholder="https://example.com" value="${escape(item.url || '')}"></label><label>简介<textarea name="description" maxlength="300" placeholder="这个工具可以帮你做什么？">${escape(item.description || '')}</textarea></label>`;
  $('#form-error').textContent = ''; $('#editor').showModal();
}
$('#editor-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('#save-button'); if (button.disabled) return;
  button.disabled = true; button.textContent = '保存中…';
  try {
    await request(`${editType}${editId ? `/${editId}` : ''}`, editId ? 'PATCH' : 'POST', Object.fromEntries(new FormData(event.target)));
    $('#editor').close(); toast('已保存'); await load();
  } catch (error) { $('#form-error').textContent = error.message; }
  finally { button.disabled = false; button.textContent = '保存'; }
});
for (const selector of ['#close-dialog', '#cancel-dialog']) $(selector).onclick = () => { if (!$('#save-button').disabled) $('#editor').close(); };
$('#editor').addEventListener('cancel', event => { if ($('#save-button').disabled) event.preventDefault(); });
$('#add-button').onclick = () => editor();
$('#retry').onclick = load;
$('#search').addEventListener('input', render);
document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('selected', b === button)); render(); });
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  const { action, id, type } = button.dataset;
  if (action === 'add') return editor();
  if (action === 'edit') return editor(type, id);
  if (action === 'delete') {
    const dialog = $('#confirm-dialog'); dialog.returnValue = 'cancel'; dialog.showModal();
    const answer = await new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));
    if (answer !== 'delete') return;
  }
  button.disabled = true;
  try {
    if (action === 'toggle') {
      const task = tasks.find(t => t.id === id);
      await request(`tasks/${id}`, 'PATCH', { completed: !task.completed }); toast(task.completed ? '已恢复为待办' : '又完成一件事，继续加油！');
    } else if (action === 'delete') { await request(`${type}/${id}`, 'DELETE'); toast('已删除'); }
    await load();
  } catch (error) { toast(error.message); button.disabled = false; }
});
$('#today').textContent = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
window.addEventListener('hashchange', navigate);
$('#add-button').disabled = true; navigate(); render(); load();

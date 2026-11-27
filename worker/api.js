const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (message, status = 400) => json({ error: message }, status);
function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('请检查输入内容及长度');
  return value.trim();
}
export async function api(request, env) {
  const { pathname, origin } = new URL(request.url);
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) return fail('不支持的请求方法', 405);
  if (request.method !== 'GET' && request.headers.get('Origin') && request.headers.get('Origin') !== origin) return fail('请求来源不允许', 403);
  const match = pathname.match(/^\/api\/(tasks|tools)(?:\/([\w-]+))?$/);
  if (!match) return fail('接口不存在', 404);
  const [, table, id] = match;
  if (!env.DB) return fail('数据库未连接', 503);
  try {
    let body;
    if (request.method === 'GET' && !id) {
      const { results } = await env.DB.prepare(`SELECT * FROM ${table} ORDER BY created_at DESC, id DESC`).all();
      return json(results);
    }
    if (id) {
      const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
      if (!row) return fail('记录不存在', 404);
      if (request.method === 'DELETE') {
        await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
        return json({ ok: true });
      }
      if (request.method === 'PATCH' && table === 'tasks') {
        try { body = await request.json(); } catch { return fail('请求内容不是有效 JSON'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('请求内容必须是对象');
        if (typeof body.completed === 'boolean' && Object.keys(body).length === 1) {
          await env.DB.prepare('UPDATE tasks SET completed = ?, completed_at = ? WHERE id = ?').bind(body.completed ? 1 : 0, body.completed ? new Date().toISOString() : null, id).run();
          return json({ ok: true });
        }
      }
    }
    if (request.method !== 'POST' && request.method !== 'PATCH') return fail('接口不存在', 404);
    if ((request.method === 'POST' && id) || (request.method === 'PATCH' && !id)) return fail('接口不存在', 404);
    if (body === undefined) {
      try { body = await request.json(); } catch { return fail('请求内容不是有效 JSON'); }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('请求内容必须是对象');
    const key = id || crypto.randomUUID();
    const now = new Date().toISOString();
    let values;
    try {
      if (table === 'tasks') {
        const title = text(body.title, 150, true), notes = text(body.notes ?? '', 2000), due = text(body.due_date ?? '', 10);
        const priority = body.priority ?? 'medium';
        if (!['high', 'medium', 'low'].includes(priority)) throw new Error('优先级无效');
        if (due) {
          const date = new Date(due);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== due) throw new Error('截止日期无效');
        }
        values = [title, notes, priority, due];
      } else {
        const name = text(body.name, 80, true), url = text(body.url, 2000, true), description = text(body.description ?? '', 300);
        const parsed = new URL(url);
        if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('请输入 http 或 https 网站地址');
        values = [name, parsed.href, description];
      }
    } catch (error) { return fail(error.message === 'Invalid URL' ? '请输入有效的网站地址' : error.message); }
    const columns = table === 'tasks' ? ['title', 'notes', 'priority', 'due_date'] : ['name', 'url', 'description'];
    if (id) {
      await env.DB.prepare(`UPDATE ${table} SET ${columns.map(c => `${c} = ?`).join(', ')} WHERE id = ?`).bind(...values, key).run();
    } else {
      await env.DB.prepare(`INSERT INTO ${table} (id, ${columns.join(', ')}, created_at) VALUES (${Array(values.length + 2).fill('?').join(', ')})`).bind(key, ...values, now).run();
    }
    return json({ id: key }, id ? 200 : 201);
  } catch (error) {
    console.error('API failure:', error.message);
    return fail('保存失败，请稍后重试', 500);
  }
}

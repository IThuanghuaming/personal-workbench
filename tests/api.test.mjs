import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('API CRUD, validation, assets and persistence across server restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'workbench-test-'));
  let child, base;
  async function start() {
    child = spawn(process.execPath, ['--experimental-sqlite', 'scripts/dev.mjs'], { env: { ...process.env, DATA_DIR: directory, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
      child.stdout.on('data', chunk => { const match = String(chunk).match(/Local: (http:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
      child.on('error', reject); child.on('exit', code => { if (code) reject(new Error(`Server exited: ${code}`)); });
    });
  }
  async function stop() { if (child.exitCode === null) { const ended = new Promise(resolve => child.once('exit', resolve)); child.kill(); await ended; } }
  async function call(path, method = 'GET', body) {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json() };
  }
  try {
    await start();
    for (const path of ['/', '/app.js', '/style.css', '/favicon.svg']) assert.equal((await fetch(base + path)).status, 200);
    assert.deepEqual((await call('/api/tasks')).data, []);
    assert.equal((await call('/api/tasks', 'POST', { title: '   ' })).status, 400);
    assert.equal((await call('/api/tasks', 'POST', { title: '事项', due_date: '2026-02-30' })).status, 400);
    assert.deepEqual(await call('/api/tasks', 'POST', { title: '事项', due_date: '2026-13-01' }), {
      status: 400, data: { error: '截止日期无效' },
    });
    assert.equal((await call('/api/tools', 'POST', { name: '不安全链接', url: 'javascript:alert(1)' })).status, 400);
    const task = await call('/api/tasks', 'POST', { title: '中文事项 ✓', notes: '保留中文备注', priority: 'high', due_date: '2026-10-20' });
    assert.equal(task.status, 201); const id = task.data.id;
    assert.equal((await call(`/api/tasks/${id}`, 'PATCH', { completed: true })).status, 200);
    assert.ok((await call('/api/tasks')).data[0].completed_at);
    const tool = await call('/api/tools', 'POST', { name: '文档', url: 'https://example.com', description: '常用文档' });
    assert.equal(tool.status, 201);
    await stop(); await start();
    const restored = (await call('/api/tasks')).data[0];
    assert.equal(restored.title, '中文事项 ✓'); assert.equal(restored.notes, '保留中文备注'); assert.equal(restored.completed, 1);
    assert.equal((await call('/api/tools')).data[0].name, '文档');
    await call(`/api/tasks/${id}`, 'PATCH', { completed: false });
    assert.equal((await call('/api/tasks')).data[0].completed_at, null);
    await call(`/api/tasks/${id}`, 'PATCH', { title: '编辑事项', notes: '新备注', priority: 'low', due_date: '' });
    assert.equal((await call('/api/tasks')).data[0].title, '编辑事项');
    await call(`/api/tools/${tool.data.id}`, 'PATCH', { name: '新工具', url: 'https://example.org', description: '' });
    assert.equal((await call('/api/tools')).data[0].url, 'https://example.org/');
    assert.equal((await fetch(base + `/api/tasks/${id}`, { method: 'DELETE', headers: { Origin: 'https://other.example' } })).status, 403);
    assert.equal((await call(`/api/tasks/${id}`, 'DELETE')).status, 200);
    assert.equal((await call(`/api/tools/${tool.data.id}`, 'DELETE')).status, 200);
    assert.equal((await call(`/api/tasks/${id}`, 'DELETE')).status, 404);
    assert.deepEqual((await call('/api/tasks')).data, []);
    assert.deepEqual((await call('/api/tools')).data, []);
  } finally { if (child) await stop(); await rm(directory, { recursive: true, force: true }); }
});

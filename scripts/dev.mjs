import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import worker from '../dist/server/index.js';
const dataDirectory = resolve(process.env.DATA_DIR || 'data');
await mkdir(dataDirectory, { recursive: true });
const db = new DatabaseSync(resolve(dataDirectory, 'workbench.sqlite'));
db.exec('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY);');
const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'));
for (const { tag } of journal.entries) {
  if (!db.prepare('SELECT name FROM _migrations WHERE name = ?').get(tag)) {
    const sql = await readFile(`drizzle/${tag}.sql`, 'utf8');
    db.exec('BEGIN');
    try { db.exec(sql); db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(tag); db.exec('COMMIT'); }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
}
export function d1(database) {
  return { prepare(sql) {
    let values = [];
    return { bind(...args) { values = args; return this; }, async all() { return { results: database.prepare(sql).all(...values) }; }, async first() { return database.prepare(sql).get(...values) || null; }, async run() { return database.prepare(sql).run(...values); } };
  } };
}
const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks = []; for await (const chunk of incoming) chunks.push(chunk);
    const method = incoming.method;
    const request = new Request(`http://${incoming.headers.host}${incoming.url}`, { method, headers: incoming.headers, body: ['GET', 'HEAD'].includes(method) ? undefined : Buffer.concat(chunks) });
    const response = await worker.fetch(request, { DB: d1(db) });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { console.error(error); outgoing.writeHead(500); outgoing.end('Internal server error'); }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${server.address().port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));

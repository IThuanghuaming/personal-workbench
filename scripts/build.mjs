import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
const assets = {};
for (const [name, mime] of [['index.html', 'text/html'], ['style.css', 'text/css'], ['app.js', 'text/javascript'], ['favicon.svg', 'image/svg+xml']]) {
  assets[name === 'index.html' ? '/' : `/${name}`] = { body: await readFile(`frontend/${name}`, 'utf8'), mime };
}
const api = (await readFile('worker/api.js', 'utf8')).replace('export async function api', 'async function api');
const server = `${api}\nconst assets = ${JSON.stringify(assets)};\nexport default { async fetch(request, env) {\n const path = new URL(request.url).pathname;\n if(path.startsWith('/api/')) return api(request, env);\n if(!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed', {status:405});\n const asset = assets[path];\n if(!asset) return new Response('Not found', {status:404});\n return new Response(request.method === 'HEAD' ? null : asset.body, {headers:{'Content-Type':asset.mime+'; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'"}});\n} };\n`;
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await writeFile('dist/server/index.js', server, 'utf8');
if (process.argv.includes('--sites')) {
  await cp('.openai/hosting.json', 'dist/.openai/hosting.json');
}
await cp('drizzle', 'dist/.openai/drizzle', { recursive: true });
console.log('Built frontend assets, backend API and database migrations.');

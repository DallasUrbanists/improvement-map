import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { root: { type: 'string', default: 'storybook-static' }, prefix: { type: 'string', default: '/storybook/' }, port: { type: 'string', default: '6007' } } });
const root = path.resolve(values.root), prefix = values.prefix;
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(prefix)) { response.writeHead(404).end(); return; }
    const file = path.resolve(root, pathname.slice(prefix.length) || 'index.html');
    if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const target = (await stat(file)).isDirectory() ? path.join(file, 'index.html') : file;
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(target));
  } catch { response.writeHead(404).end(); }
}).listen(Number(values.port), '127.0.0.1', () => console.log(`Storybook: http://127.0.0.1:${values.port}${prefix}`));

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedSuggestions } from '../../dev/fixtures.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

export function createMockServer({ dataDir = path.join(root, 'node_modules/.cache/local-mock') } = {}) {
  mkdirSync(dataDir, { recursive: true });
  const storeFile = path.join(dataDir, 'suggestions.json');
  let suggestions = existsSync(storeFile) ? JSON.parse(readFileSync(storeFile, 'utf8')) : seedSuggestions();
  const uploads = new Map();
  const save = () => {
    writeFileSync(`${storeFile}.tmp`, JSON.stringify(suggestions, null, 2));
    renameSync(`${storeFile}.tmp`, storeFile);
  };
  const json = (response, status, body) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)); };
  const fail = (response, status, message) => json(response, status, { error: 'LOCAL_MOCK_ERROR', message });
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://mock');
      const pathname = url.pathname;
      const method = request.method;
      if (pathname === '/__mock/health') return json(response, 200, { status: 'ok', environment: 'local-mock' });
      if (pathname === '/__mock/reset' && method === 'POST') { suggestions = seedSuggestions(); uploads.clear(); save(); return json(response, 200, { reset: true }); }
      if (pathname === '/__mock/crossing.svg' && method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
        return response.end(readFileSync(path.join(root, 'stories/assets/crossing.svg')));
      }
      if (pathname.startsWith('/__uploads/')) {
        const id = pathname.slice('/__uploads/'.length);
        if (!/^[a-f0-9-]+$/.test(id)) return fail(response, 400, 'Invalid local upload ID.');
        const target = path.join(dataDir, id);
        if (method === 'PUT') {
          if (!uploads.has(id)) return fail(response, 403, 'Request a local upload URL before uploading.');
          const chunks = []; let size = 0;
          for await (const chunk of request) { size += chunk.length; if (size > 10 * 1024 * 1024) return fail(response, 413, 'Image exceeds the local 10 MiB limit.'); chunks.push(chunk); }
          if (!size) return fail(response, 400, 'Image bytes are required.');
          const contentType = uploads.get(id);
          if (request.headers['content-type'] !== contentType) return fail(response, 400, 'Upload content type does not match the issued URL.');
          writeFileSync(target, Buffer.concat(chunks)); writeFileSync(`${target}.type`, contentType);
          response.writeHead(200); return response.end();
        }
        if (method === 'GET' && existsSync(target)) {
          response.writeHead(200, { 'Content-Type': readFileSync(`${target}.type`, 'utf8'), 'Cache-Control': 'no-store' });
          return response.end(readFileSync(target));
        }
        return fail(response, 404, 'Local image not found.');
      }
      if (pathname.startsWith('/__overpass') && method === 'POST') {
        // This is the existing attributed Elm Street snapshot, never invented live geometry.
        const fixture = JSON.parse(readFileSync(path.join(root, 'src/data/test-location-osm.json'), 'utf8'));
        const elements = fixture.elements.filter(item => Number.isSafeInteger(Number(item.id)) && item.geometry?.length).map(item => ({
          type: 'way', id: Number(item.id), geometry: item.geometry,
          tags: Object.fromEntries(Object.entries(item.tags || {}).filter(([, value]) => value !== null)),
        }));
        return json(response, 200, { version: 0.6, generator: 'local-recorded-fixture', elements });
      }
      const chunks = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > 1024 * 1024) return fail(response, 413, 'Request too large.'); chunks.push(chunk); }
      let body = {};
      if (chunks.length) {
        try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { return fail(response, 400, 'Invalid JSON.'); }
      }
      if (/^\/api\/(?:public-improvements\/)?suggestions\/upload-url$/.test(pathname) && method === 'POST') {
        if (!['image/webp', 'image/png', 'image/jpeg', 'image/svg+xml'].includes(body.contentType)) return fail(response, 400, 'Unsupported image content type.');
        const id = randomUUID(); uploads.set(id, body.contentType);
        const origin = `http://${String(request.headers['x-forwarded-host'] || request.headers.host).split(',')[0].trim()}`;
        const imageUrl = `${origin}/__uploads/${id}`;
        return json(response, 200, { data: { uploadUrl: imageUrl, publicUrl: imageUrl, filePath: id, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() } });
      }
      if (/^\/api\/(?:public-improvements\/)?suggestions$/.test(pathname)) {
        if (method === 'GET') return json(response, 200, { data: suggestions });
        if (method === 'POST') {
          if (!body.content?.details?.trim() || !Number.isFinite(body.location?.latitude) || !Number.isFinite(body.location?.longitude)) return fail(response, 422, 'A description and location are required.');
          const suggestion = { ...body, id: Math.max(0, ...suggestions.map(item => Number(item.id))) + 1, creationDate: new Date().toISOString(), status: 'open' };
          suggestions.unshift(suggestion); save(); return json(response, 201, { data: suggestion });
        }
      }
      const itemMatch = pathname.match(/^\/api\/(?:public-improvements\/)?suggestions\/(\d+)(?:\/(.*))?$/);
      if (itemMatch) {
        const item = suggestions.find(value => String(value.id) === itemMatch[1]);
        if (!item) return fail(response, 404, 'Suggestion not found.');
        if (method === 'GET' && !itemMatch[2]) return json(response, 200, { data: item });
        if (method === 'GET' && itemMatch[2] === 'representatives') return json(response, 200, []);
        if (method === 'GET' && ['boundaries', 'recommended-actions'].includes(itemMatch[2])) return json(response, 200, { data: [] });
        if (method === 'GET' && itemMatch[2] === 'streetmix') return json(response, 200, { streetmix: null, result: null, activeRequest: null });
      }
      if (pathname === '/api/recommendables/match' && method === 'POST') return json(response, 200, { data: [] });
      if (/^\/api\/assist\/(grammar|clarity|summarize)$/.test(pathname) && method === 'POST') {
        if (typeof body.text !== 'string') return fail(response, 422, 'Text is required.');
        const text = pathname.endsWith('/summarize') ? body.text.trim().split(/[.!?]/)[0].slice(0, 120) : body.text;
        return json(response, 200, { data: { text } });
      }
      return fail(response, 404, 'Endpoint not implemented in the local starter mock. No live fallback was attempted.');
    } catch (error) {
      console.error('[mock]', error.message);
      if (!response.headersSent) fail(response, 500, 'Local mock failed. See the mock service logs.');
      else response.end();
    }
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createMockServer({ dataDir: process.env.MOCK_DATA_DIR });
  server.listen(Number(process.env.MOCK_PORT || 4010), process.env.MOCK_HOST || '127.0.0.1', () => console.log('Local mock service listening on port', server.address().port));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
}

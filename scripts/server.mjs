import { createServer } from 'node:http';
import { access, readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'Permissions-Policy': 'tools=(self)',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-store',
};

function send(response, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, { ...SECURITY_HEADERS, 'Content-Type': contentType });
  response.end(body);
}

function resolveRequestPath(root, rawUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(rawUrl ?? '/', 'http://localhost').pathname);
  } catch {
    return undefined;
  }
  if (pathname.includes('\0')) return undefined;
  const normalized = pathname === '/' ? '/index.html' : pathname;
  const candidate = resolve(root, `.${normalized}`);
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  return candidate === root || candidate.startsWith(prefix) ? candidate : undefined;
}

export async function startServer({
  root = resolve(process.cwd(), 'dist'),
  host = process.env.HOST ?? '127.0.0.1',
  port = Number(process.env.PORT ?? 4173),
  quiet = false,
} = {}) {
  const resolvedRoot = resolve(root);
  await access(resolvedRoot);
  const server = createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
      send(response, 405, 'Method not allowed.');
      return;
    }
    const path = resolveRequestPath(resolvedRoot, request.url);
    if (!path) {
      send(response, 400, 'Invalid path.');
      return;
    }
    try {
      const metadata = await stat(path);
      if (!metadata.isFile()) {
        send(response, 404, 'Not found.');
        return;
      }
      const body = request.method === 'HEAD' ? undefined : await readFile(path);
      response.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': MIME.get(extname(path).toLowerCase()) ?? 'application/octet-stream',
        'Content-Length': String(metadata.size),
      });
      response.end(body);
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      send(response, code === 'ENOENT' ? 404 : 500, code === 'ENOENT' ? 'Not found.' : 'Internal server error.');
    }
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolveListen();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not expose a TCP address.');
  const url = `http://${host}:${address.port}`;
  if (!quiet) console.log(`SignalUI Interface on Demand: ${url}`);
  return {
    url,
    port: address.port,
    close: () => new Promise((resolveClose, reject) => {
      server.close((error) => error ? reject(error) : resolveClose());
    }),
  };
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;
if (invokedDirectly) {
  const root = process.env.SIGNALUI_ROOT ?? resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist');
  await startServer({ root });
}

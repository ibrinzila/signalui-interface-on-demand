import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, normalize, posix, resolve } from 'node:path';
import { CdpClient } from '../scripts/cdp-client.mjs';

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

export function resolveChromiumExecutable({ env = process.env, platform = process.platform, exists = existsSync } = {}) {
  if (env.CHROMIUM_PATH) return env.CHROMIUM_PATH;

  const candidates = platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : ['/usr/bin/chromium'];
  const executable = candidates.find(exists);
  if (executable) return executable;

  throw new Error(`Chromium executable not found. Set CHROMIUM_PATH explicitly or install a supported browser. Attempted: ${candidates.join(', ')}`);
}

async function waitForDevTools(process, executable, timeout = 15_000) {
  return new Promise((resolveReady, reject) => {
    let buffer = '';
    let settled = false;
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => settle(reject, new Error(`Chromium DevTools endpoint timed out. ${buffer.slice(-500)}`)), timeout);
    const inspect = (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (!match) return;
      settle(resolveReady, match[1]);
    };
    process.stderr.on('data', inspect);
    process.once('error', (error) => {
      settle(reject, new Error(`Unable to start Chromium at ${executable}: ${error.code ?? error.message}`));
    });
    process.once('exit', (code) => {
      settle(reject, new Error(`Chromium exited before DevTools was ready (${code}). ${buffer.slice(-500)}`));
    });
  });
}

async function waitForExit(process, timeout = 5_000) {
  if (process.exitCode !== null || process.signalCode !== null) return;
  await Promise.race([
    new Promise((resolveExit) => process.once('exit', resolveExit)),
    delay(timeout).then(() => process.kill('SIGKILL')),
  ]);
}

function moduleSpecifiers(source) {
  const found = [];
  const expression = /(?:from\s+|import\s+)(['"])(\.{1,2}\/[^'"]+)\1/g;
  for (const match of source.matchAll(expression)) found.push(match[2]);
  return [...new Set(found)];
}

function resolveModuleId(moduleId, specifier) {
  return normalize(posix.join(posix.dirname(moduleId), specifier)).replaceAll('\\', '/');
}

async function assetDataUri(root, relativePath) {
  const body = await readFile(resolve(root, relativePath));
  const mime = relativePath.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
  return `data:${mime};base64,${body.toString('base64')}`;
}

async function moduleGraph(root, entry = 'src/ui/app.js') {
  const modules = new Map();
  const assets = new Map([
    ['/assets/meter-104.svg', await assetDataUri(root, 'assets/meter-104.svg')],
    ['/assets/meter-305.svg', await assetDataUri(root, 'assets/meter-305.svg')],
    ['/assets/meter-411.svg', await assetDataUri(root, 'assets/meter-411.svg')],
  ]);

  async function visit(moduleId) {
    if (modules.has(moduleId)) return;
    let source = await readFile(resolve(root, moduleId), 'utf8');
    source = source.replace(/^\/\/# sourceMappingURL=.*$/gm, '');
    for (const [assetPath, dataUri] of assets) source = source.replaceAll(assetPath, dataUri);
    const dependencies = moduleSpecifiers(source).map((specifier) => ({
      specifier,
      target: resolveModuleId(moduleId, specifier),
    }));
    for (const dependency of dependencies) await visit(dependency.target);
    modules.set(moduleId, { id: moduleId, source, dependencies });
  }

  await visit(entry);
  return [...modules.values()];
}

async function browserDocument(root) {
  const [index, css] = await Promise.all([
    readFile(resolve(root, 'index.html'), 'utf8'),
    readFile(resolve(root, 'styles.css'), 'utf8'),
  ]);
  const withoutExternalAssets = index
    .replace(/\s*<link rel="stylesheet" href="\/styles\.css">/, '')
    .replace(/\s*<script type="module" src="\/src\/ui\/app\.js"><\/script>/, '');
  return withoutExternalAssets.replace('</head>', `<style data-signalui-test-styles>${css.replaceAll('</style>', '<\\/style>')}</style></head>`);
}

async function injectApplication(client, root) {
  const [graph, contracts] = await Promise.all([
    moduleGraph(root),
    readFile(resolve(root, 'contracts/capabilities.json'), 'utf8').then(JSON.parse),
  ]);
  const payload = JSON.stringify({ graph, contracts, entry: 'src/ui/app.js' });
  await client.evaluate(`(async () => {
    const payload = ${payload};
    const contractJson = JSON.stringify(payload.contracts);
    const originalFetch = globalThis.fetch?.bind(globalThis);
    globalThis.fetch = async (input, init) => {
      const raw = typeof input === 'string' ? input : input?.url;
      const path = new URL(raw, 'https://signalui.invalid/').pathname;
      if (path === '/contracts/capabilities.json') {
        return new Response(contractJson, { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (originalFetch) return originalFetch(input, init);
      throw new Error('Network access is disabled in the managed Chromium harness.');
    };
    const urls = Object.create(null);
    for (const module of payload.graph) {
      let source = module.source;
      for (const dependency of module.dependencies) {
        const replacement = urls[dependency.target];
        if (!replacement) throw new Error('Module dependency was not ordered: ' + dependency.target);
        source = source.replaceAll("'" + dependency.specifier + "'", "'" + replacement + "'");
        source = source.replaceAll('"' + dependency.specifier + '"', '"' + replacement + '"');
      }
      urls[module.id] = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    }
    await import(urls[payload.entry]);
    globalThis.__signalUiBlobUrls = urls;
    return { moduleCount: payload.graph.length };
  })()`);
}

export async function launchBrowserHarness({ width = 1440, height = 1000, root = 'dist' } = {}) {
  const resolvedRoot = resolve(root);
  const profile = await mkdtemp(join(tmpdir(), 'signalui-chromium-'));
  const executable = resolveChromiumExecutable();
  const browser = spawn(executable, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  try {
    const browserWs = await waitForDevTools(browser, executable);
    const debugPort = new URL(browserWs).port;
    const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' });
    if (!targetResponse.ok) throw new Error(`Unable to create Chromium target (${targetResponse.status}).`);
    const target = await targetResponse.json();
    const client = new CdpClient(target.webSocketDebuggerUrl);
    await client.open();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Accessibility.enable');
    await client.viewport(width, height, 1, width <= 600);

    const diagnostics = [];
    client.on('Runtime.exceptionThrown', (params) => diagnostics.push({ type: 'exception', params }));
    client.on('Log.entryAdded', (params) => diagnostics.push({ type: 'log', params }));

    const frameTree = await client.send('Page.getFrameTree');
    await client.send('Page.setDocumentContent', {
      frameId: frameTree.frameTree.frame.id,
      html: await browserDocument(resolvedRoot),
    });
    await injectApplication(client, resolvedRoot);

    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (await client.evaluate('Boolean(window.SignalUIDemo?.ready)')) break;
      if (attempt === 119) {
        const state = await client.evaluate(`({
          readyState: document.readyState,
          fatalHidden: document.getElementById('fatal-error')?.hidden,
          fatalText: document.getElementById('fatal-error')?.textContent,
          appText: document.getElementById('app')?.textContent?.slice(0, 1000)
        })`);
        throw new Error(`SignalUI demo did not become ready. DOM=${JSON.stringify(state)} Browser=${JSON.stringify(diagnostics).slice(0, 4000)}`);
      }
      await delay(50);
    }

    return {
      client,
      browser,
      profile,
      url: 'about:blank#signalui-interface-on-demand',
      async close() {
        client.close();
        browser.kill('SIGTERM');
        await waitForExit(browser);
        await rm(profile, { recursive: true, force: true });
      },
    };
  } catch (error) {
    browser.kill('SIGTERM');
    await waitForExit(browser);
    await rm(profile, { recursive: true, force: true });
    throw error;
  }
}

export function browserAssert(condition, message) {
  if (!condition) throw new Error(message);
}

import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const unfinishedPattern = new RegExp(`\\b(?:${['TO' + 'DO', 'T' + 'BD', 'FIX' + 'ME'].join('|')})\\b`);
const required = ['README.md', 'LICENSE', 'SECURITY.md', 'CHANGELOG.md', 'llms.txt', 'docs/architecture.md', 'docs/webmcp-tools.md', 'docs/demo-script.md', 'docs/adoption-path.md', 'docs/verification.md', 'docs/deployment.md', 'docs/devpost-submission.md', 'docs/judge-testing.md', 'docs/release-evidence.md'];
const publicSourceUrl = 'https://github.com/ibrinzila/signalui-interface-on-demand';
const liveDemoUrl = 'https://signalui-interface-on-demand.pages.dev';

function visibleMarkdown(body) {
  const visible = [];
  let fenced = false;
  let commented = false;
  for (const line of body.split('\n')) {
    if (fenced) {
      if (/^\s{0,3}(?:`{3,}|~{3,})/.test(line)) fenced = false;
      continue;
    }
    if (commented) {
      if (line.includes('-->')) commented = false;
      continue;
    }
    if (/^\s{0,3}(?:`{3,}|~{3,})/.test(line)) {
      fenced = true;
      continue;
    }
    if (line.includes('<!--')) {
      if (!line.includes('-->')) commented = true;
      continue;
    }
    visible.push(line);
  }
  return visible;
}

function section(body, heading) {
  const lines = visibleMarkdown(body);
  const start = lines.findIndex((line) => line.match(/^## (.+?)\s*$/)?.[1].trim() === heading);
  if (start < 0) return null;
  const end = lines.findIndex((line, index) => index > start && /^## .+?\s*$/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

async function exists(root, path) {
  try { await access(resolve(root, path)); return true; } catch { return false; }
}

async function markdownFiles(root, directory = '.') {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = directory === '.' ? entry.name : `${directory}/${entry.name}`;
    if (entry.isDirectory() && !['.git', 'node_modules', 'dist', '.build', 'artifacts'].includes(entry.name)) files.push(...await markdownFiles(root, relative));
    else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') files.push(relative);
  }
  return files;
}

function requireText(path, body, text) {
  if (!body.includes(text)) throw new Error(`${path} is missing required release content: ${text}`);
}

export async function checkDocs({ root = process.cwd() } = {}) {
  for (const path of required) if (!await exists(root, path)) throw new Error(`Required release document is missing: ${path}`);
  if (await exists(root, '.bootstrap')) throw new Error('Transient .bootstrap marker must not ship.');
  const [devpost, judgeTesting, releaseEvidence] = await Promise.all([
    readFile(resolve(root, 'docs/devpost-submission.md'), 'utf8'),
    readFile(resolve(root, 'docs/judge-testing.md'), 'utf8'),
    readFile(resolve(root, 'docs/release-evidence.md'), 'utf8'),
  ]);
  const visibleDevpost = visibleMarkdown(devpost).join('\n');
  const visibleJudgeTesting = visibleMarkdown(judgeTesting).join('\n');
  const visibleReleaseEvidence = visibleMarkdown(releaseEvidence).join('\n');
  for (const heading of ['WebMCP leverage', 'People and agents together', 'Implementation', 'Impact', 'Testing']) {
    if (section(devpost, heading) === null) throw new Error(`docs/devpost-submission.md is missing required release content: ## ${heading}`);
  }
  for (const [path, body] of [['docs/devpost-submission.md', visibleDevpost], ['docs/judge-testing.md', visibleJudgeTesting], ['docs/release-evidence.md', visibleReleaseEvidence]]) {
    requireText(path, body, publicSourceUrl);
    requireText(path, body, liveDemoUrl);
  }
  const native = section(judgeTesting, 'Native WebMCP check');
  const fallback = section(judgeTesting, 'Fallback console check');
  if (!native?.includes('document.modelContext.registerTool') || !/only path that establishes native WebMCP availability/i.test(native)) throw new Error('docs/judge-testing.md is missing a precise Native WebMCP check boundary.');
  if (!fallback?.includes('not native WebMCP') || !/same catalog as native WebMCP tools/i.test(fallback) || !/same `?CommandBus\.execute`? path as human controls/i.test(fallback)) throw new Error('docs/judge-testing.md is missing a precise fallback console boundary.');
  for (const field of ['**Source commit:**', `**Deployment URL:** ${liveDemoUrl}`, '**Deployment timestamp:**', '**Smoke results:**', `**Public source URL:** ${publicSourceUrl}`]) requireText('docs/release-evidence.md', visibleReleaseEvidence, field);

  const markdown = await markdownFiles(root);
  let linksChecked = 0;
  for (const file of markdown) {
    const body = await readFile(resolve(root, file), 'utf8');
    if (unfinishedPattern.test(body)) throw new Error(`${file} contains an unfinished marker.`);
    for (const match of body.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const raw = match[1].trim().replace(/^<|>$/g, '');
      if (!raw || /^(?:https?:|mailto:|#|data:)/i.test(raw)) continue;
      const path = decodeURIComponent(raw.split(/\s+["']/)[0].split('#')[0]);
      if (!path) continue;
      try { await access(resolve(root, dirname(file), path)); } catch { throw new Error(`${file} links to missing path: ${raw}`); }
      linksChecked += 1;
    }
  }
  return { requiredFiles: required.length, linksChecked };
}

const invokedDirectly = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false;
if (invokedDirectly) {
  const report = await checkDocs();
  console.log(`Release documentation passed (${report.requiredFiles} required files, ${report.linksChecked} local links).`);
}

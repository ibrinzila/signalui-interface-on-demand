import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';

const root = process.cwd();
const unfinishedPattern = new RegExp(`\\b(?:${['TO' + 'DO', 'T' + 'BD', 'FIX' + 'ME'].join('|')})\\b`);
const required = [
  'README.md', 'LICENSE', 'SECURITY.md', 'CHANGELOG.md', 'llms.txt',
  'docs/architecture.md', 'docs/webmcp-tools.md', 'docs/demo-script.md',
  'docs/adoption-path.md', 'docs/verification.md', 'docs/deployment.md',
];

async function exists(path) {
  try { await access(resolve(root, path)); return true; } catch { return false; }
}

for (const path of required) {
  if (!await exists(path)) throw new Error(`Required release document is missing: ${path}`);
}
if (await exists('.bootstrap')) throw new Error('Transient .bootstrap marker must not ship.');

async function markdownFiles(directory) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = directory === '.' ? entry.name : `${directory}/${entry.name}`;
    if (entry.isDirectory() && !['.git', 'node_modules', 'dist', '.build', 'artifacts'].includes(entry.name)) {
      files.push(...await markdownFiles(relative));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
      files.push(relative);
    }
  }
  return files;
}

const markdown = await markdownFiles('.');
let linksChecked = 0;
for (const file of markdown) {
  const body = await readFile(resolve(root, file), 'utf8');
  if (unfinishedPattern.test(body)) throw new Error(`${file} contains an unfinished marker.`);
  for (const match of body.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1].trim().replace(/^<|>$/g, '');
    if (!raw || /^(?:https?:|mailto:|#|data:)/i.test(raw)) continue;
    const withoutTitle = raw.split(/\s+["']/)[0];
    const path = decodeURIComponent(withoutTitle.split('#')[0]);
    if (!path) continue;
    const target = resolve(root, dirname(file), path);
    try { await access(target); } catch { throw new Error(`${file} links to missing path: ${raw}`); }
    linksChecked += 1;
  }
}

console.log(`Release documentation passed (${required.length} required files, ${linksChecked} local links).`);

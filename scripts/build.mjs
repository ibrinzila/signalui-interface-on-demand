import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

async function listFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, absolute));
    else if (entry.isFile()) files.push(relative(root, absolute).replaceAll('\\', '/'));
  }
  return files;
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function copyFile(source, destination) {
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
}

export async function build({ root = process.cwd(), quiet = false } = {}) {
  const dist = resolve(root, 'dist');
  const compiled = resolve(root, '.build');
  await rm(dist, { recursive: true, force: true });
  await rm(compiled, { recursive: true, force: true });
  execFileSync('npm', ['run', 'compile', '--silent'], { cwd: root, stdio: 'inherit' });

  await mkdir(dist, { recursive: true });
  await copyFile(resolve(root, 'index.html'), resolve(dist, 'index.html'));
  await copyFile(resolve(root, 'src/styles.css'), resolve(dist, 'styles.css'));
  await copyFile(resolve(root, 'llms.txt'), resolve(dist, 'llms.txt'));
  await cp(resolve(compiled, 'src'), resolve(dist, 'src'), { recursive: true });
  await cp(resolve(root, 'contracts'), resolve(dist, 'contracts'), { recursive: true });
  await cp(resolve(root, 'public'), dist, { recursive: true });

  const filesBeforeManifest = await listFiles(dist);
  const fileEntries = [];
  for (const file of filesBeforeManifest) {
    fileEntries.push({ path: file, sha256: await sha256(resolve(dist, file)) });
  }
  const manifest = {
    product: 'SignalUI Interface on Demand',
    version: '1.0.0',
    format: 1,
    deterministic: true,
    files: fileEntries,
  };
  await writeFile(resolve(dist, 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const files = await listFiles(dist);
  if (!quiet) console.log(`Built SignalUI Interface on Demand (${files.length} files).`);
  return { root: dist, files, manifest };
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;
if (invokedDirectly) await build();

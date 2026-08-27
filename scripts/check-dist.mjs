import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUIRED_DIST_FILES = Object.freeze([
  'index.html',
  'styles.css',
  'llms.txt',
  'src/ui/app.js',
  'src/core/command-bus.js',
  'src/webmcp/bridge.js',
  'contracts/capabilities.json',
  'contracts/surface-recipes.json',
  'assets/favicon.svg',
  'assets/meter-104.svg',
  'assets/meter-305.svg',
  'assets/meter-411.svg',
  '_headers',
  'manifest.webmanifest',
  'build-manifest.json',
]);

export async function checkDistribution(root = resolve(process.cwd(), 'dist')) {
  const missing = [];
  for (const relativePath of REQUIRED_DIST_FILES) {
    try {
      await access(resolve(root, relativePath));
    } catch {
      missing.push(relativePath);
    }
  }
  if (missing.length > 0) {
    return { ok: false, missing, root };
  }
  const manifest = JSON.parse(await readFile(resolve(root, 'build-manifest.json'), 'utf8'));
  const validManifest = manifest?.product === 'SignalUI Interface on Demand'
    && manifest?.version === '1.0.0'
    && Array.isArray(manifest?.files)
    && manifest.files.length >= REQUIRED_DIST_FILES.length - 1;
  return {
    ok: validManifest,
    missing: validManifest ? [] : ['build-manifest.json:invalid'],
    root,
    manifest,
  };
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (invokedDirectly) {
  const result = await checkDistribution();
  if (!result.ok) {
    console.error(`Distribution check failed: ${result.missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Distribution check passed (${result.manifest.files.length} files).`);
  }
}

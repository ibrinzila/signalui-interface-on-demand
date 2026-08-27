import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from './build.mjs';

function digest(content) {
  return createHash('sha256').update(content).digest('hex');
}

export async function checkReproducible(root = process.cwd()) {
  await build({ root, quiet: true });
  const first = await readFile(resolve(root, 'dist/build-manifest.json'));
  await build({ root, quiet: true });
  const second = await readFile(resolve(root, 'dist/build-manifest.json'));
  const firstHash = digest(first);
  const secondHash = digest(second);
  return { ok: firstHash === secondHash, firstHash, secondHash };
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (invokedDirectly) {
  const result = await checkReproducible();
  if (!result.ok) {
    console.error(`Build manifest is not reproducible: ${result.firstHash} != ${result.secondHash}`);
    process.exitCode = 1;
  } else {
    console.log(`Build reproducibility passed (${result.firstHash}).`);
  }
}

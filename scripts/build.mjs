import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
if (dist !== root + sep + 'dist') throw new Error('Unexpected build directory');
await mkdir(dist, { recursive: true });
// Windows dev watchers can lock directories. Remove stale files but keep directories.
async function clearFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = resolve(directory, entry.name);
    if (!target.startsWith(dist + sep) || entry.isSymbolicLink()) throw new Error('Unsafe build entry');
    if (entry.isDirectory()) await clearFiles(target);
    else await rm(target, { force: true });
  }
}
await clearFiles(dist);
// Explicit asset allowlist: no DB files, tests, docs, server, or dependencies.
for (const item of ['index.html', 'styles.css', 'src', 'assets', 'minesweeper', 'memory']) await cp(resolve(root, item), resolve(dist, item), { recursive: true });
await rm(resolve(dist, 'memory', 'README.md'), { force: true });
await cp(resolve(root, 'public'), dist, { recursive: true });
console.log('Static assets built in dist/');

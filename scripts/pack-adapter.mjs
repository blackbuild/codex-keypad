import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = resolve(import.meta.dirname, '..');
const packageDirectory = resolve(repositoryRoot, 'dist-adapter');
const artifactDirectory = resolve(repositoryRoot, 'artifacts');
const artifact = resolve(artifactDirectory, 'CodexKeypad_0_2_16.lplug4');

await mkdir(artifactDirectory, { recursive: true });
await rm(artifact, { force: true });

const zip = spawnSync('/usr/bin/zip', ['-r', '-q', artifact, '.'], {
  cwd: packageDirectory,
  stdio: 'inherit',
});
if (zip.error) {
  throw zip.error;
}
if (zip.status !== 0) {
  throw new Error(`zip exited with status ${zip.status ?? 'unknown'}`);
}

console.log(artifact);

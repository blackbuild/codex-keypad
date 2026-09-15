import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import { configuredProjectRoot } from './project-configuration.ts';

let homeDirectory: string;

before(async () => {
  homeDirectory = await mkdtemp(join(tmpdir(), 'codex-keypad-home-'));
});

after(async () => {
  await rm(homeDirectory, { recursive: true, force: true });
});

test('reads the project root from the persistent macOS configuration file', async () => {
  const configurationDirectory = join(homeDirectory, 'Library', 'Application Support', 'Codex Keypad');
  await mkdir(configurationDirectory, { recursive: true });
  await writeFile(
    join(configurationDirectory, 'config.json'),
    JSON.stringify({ projectRoot: '/projects/codex-keypad' }),
  );

  assert.equal(configuredProjectRoot({}, homeDirectory), '/projects/codex-keypad');
});

test('fails explicitly when neither process nor persistent configuration identifies a project', () => {
  assert.throws(
    () => configuredProjectRoot({}, join(homeDirectory, 'missing')),
    /CODEX_KEYPAD_PROJECT_ROOT is not set and Codex Keypad configuration is missing/,
  );
});

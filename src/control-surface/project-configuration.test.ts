import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import { configuredProjects } from './project-configuration.ts';

let homeDirectory: string;

before(async () => {
  homeDirectory = await mkdtemp(join(tmpdir(), 'codex-keypad-home-'));
});

after(async () => {
  await rm(homeDirectory, { recursive: true, force: true });
});

test('reads configured project identity, root, and custom icon', async () => {
  const configurationDirectory = join(homeDirectory, 'Library', 'Application Support', 'Codex Keypad');
  await mkdir(configurationDirectory, { recursive: true });
  await writeFile(
    join(configurationDirectory, 'config.json'),
    JSON.stringify({
      projects: [
        {
          id: 'architecture',
          name: 'Architecture',
          root: '/projects/architecture',
          icon: '/icons/architecture.png',
        },
        { id: 'codex-keypad', name: 'Codex Keypad', root: '/projects/codex-keypad' },
      ],
    }),
  );

  assert.deepEqual(configuredProjects({}, homeDirectory), [
    {
      id: 'architecture',
      name: 'Architecture',
      root: '/projects/architecture',
      icon: '/icons/architecture.png',
    },
    { id: 'codex-keypad', name: 'Codex Keypad', root: '/projects/codex-keypad' },
  ]);
});

test('keeps the issue 4 single-project configuration compatible', async () => {
  const configurationDirectory = join(homeDirectory, 'Library', 'Application Support', 'Codex Keypad');
  await mkdir(configurationDirectory, { recursive: true });
  await writeFile(
    join(configurationDirectory, 'config.json'),
    JSON.stringify({ projectRoot: '/projects/codex-keypad' }),
  );

  assert.deepEqual(configuredProjects({}, homeDirectory), [{
    id: 'codex-keypad',
    name: 'Codex Keypad',
    root: '/projects/codex-keypad',
  }]);
});

test('fails explicitly when neither process nor persistent configuration identifies a project', () => {
  assert.throws(
    () => configuredProjects({}, join(homeDirectory, 'missing')),
    /CODEX_KEYPAD_PROJECT_ROOT is not set and Codex Keypad configuration is missing/,
  );
});

test('rejects duplicate project identities and relative icon paths', async () => {
  const configurationDirectory = join(homeDirectory, 'Library', 'Application Support', 'Codex Keypad');
  await mkdir(configurationDirectory, { recursive: true });
  const configurationPath = join(configurationDirectory, 'config.json');

  await writeFile(configurationPath, JSON.stringify({
    projects: [
      { id: 'same', name: 'First', root: '/projects/first' },
      { id: 'same', name: 'Second', root: '/projects/second' },
    ],
  }));
  assert.throws(() => configuredProjects({}, homeDirectory), /project ids must be unique/);

  await writeFile(configurationPath, JSON.stringify({
    projects: [{ id: 'safe', name: 'Safe', root: '/projects/safe', icon: 'icon.png' }],
  }));
  assert.throws(() => configuredProjects({}, homeDirectory), /icon must be an absolute PNG path/);
});

test('observes project additions without retaining a startup snapshot', async () => {
  const configurationDirectory = join(homeDirectory, 'Library', 'Application Support', 'Codex Keypad');
  await mkdir(configurationDirectory, { recursive: true });
  const configurationPath = join(configurationDirectory, 'config.json');
  await writeFile(configurationPath, JSON.stringify({
    projects: [{ id: 'first', name: 'First', root: '/projects/first' }],
  }));
  assert.deepEqual(configuredProjects({}, homeDirectory).map(({ id }) => id), ['first']);

  await writeFile(configurationPath, JSON.stringify({
    projects: [
      { id: 'first', name: 'First', root: '/projects/first' },
      { id: 'second', name: 'Second', root: '/projects/second' },
    ],
  }));
  assert.deepEqual(configuredProjects({}, homeDirectory).map(({ id }) => id), ['first', 'second']);
});

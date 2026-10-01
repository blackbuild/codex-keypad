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
      coordinatorTaskPattern: '* Hive',
      projects: [
        {
          id: 'architecture',
          name: 'Architecture',
          root: '/projects/architecture',
          repositories: ['/repositories/architecture'],
          coordinatorTaskId: 'codex://threads/thread-coordinator',
          coordinatorTaskPattern: 'Architecture Coordinator',
          icon: '/icons/architecture.png',
          workflowRules: [{ marker: '(PR:CI)', state: 'done' }],
          compactLabelPatterns: ['#[0-9]{1,6}'],
        },
        { id: 'codex-keypad', name: 'Codex Keypad', root: '/projects/codex-keypad' },
      ],
    }),
  );

  const [architecture, keypad] = configuredProjects({}, homeDirectory);
  assert.deepEqual({
    id: architecture?.id,
    name: architecture?.name,
    root: architecture?.root,
    repositories: architecture?.repositories,
    coordinatorTaskId: architecture?.coordinatorTaskId,
    coordinatorTaskPattern: architecture?.coordinatorTaskPattern,
    icon: architecture?.icon,
    workflowRules: architecture?.workflowRules,
    compactLabelPatterns: architecture?.compactLabelPatterns,
    secondId: keypad?.id,
    secondPattern: keypad?.coordinatorTaskPattern,
  }, {
      id: 'architecture',
      name: 'Architecture',
      root: '/projects/architecture',
      repositories: ['/repositories/architecture'],
      coordinatorTaskId: 'thread-coordinator',
      coordinatorTaskPattern: 'Architecture Coordinator',
      icon: '/icons/architecture.png',
      workflowRules: [
        { marker: '(PR:CI)', state: 'done' },
        { marker: '(PR:REVIEW)', state: 'waiting-for-review' },
        { marker: '(PR:CHANGES)', state: 'changes-requested' },
        { marker: '(INPUT)', state: 'waiting-for-input' },
        { marker: '(APPROVAL)', state: 'waiting-for-approval' },
        { marker: '(BLOCKED)', state: 'blocked' },
        { marker: '(HANDOFF:FAILED)', state: 'handoff-failed' },
        { marker: '(HANDOFF)', state: 'handoff-failed' },
        { marker: '(DONE)', state: 'done' },
      ],
      compactLabelPatterns: ['#[0-9]{1,6}'],
      secondId: 'codex-keypad',
      secondPattern: '* Hive',
  });
});

test('keeps the issue 4 single-project configuration compatible', async () => {
  const configurationDirectory = join(homeDirectory, 'Library', 'Application Support', 'Codex Keypad');
  await mkdir(configurationDirectory, { recursive: true });
  await writeFile(
    join(configurationDirectory, 'config.json'),
    JSON.stringify({ projectRoot: '/projects/codex-keypad' }),
  );

  const [single] = configuredProjects({}, homeDirectory);
  assert.deepEqual(single?.workflowRules?.map(({ state }) => state), [
    'waiting-for-ci', 'waiting-for-review', 'changes-requested', 'waiting-for-input',
    'waiting-for-approval', 'blocked', 'handoff-failed', 'handoff-failed', 'done',
  ]);
  assert.deepEqual(single?.compactLabelPatterns, ['\\b[A-Z]{2,10}-[0-9]{1,6}\\b']);
});

test('fails explicitly when neither process nor persistent configuration identifies a project', () => {
  assert.throws(
    () => configuredProjects({}, join(homeDirectory, 'missing')),
    /CODEX_KEYPAD_PROJECT_ROOT is not set and Codex Keypad configuration is missing/,
  );
});

test('rejects duplicate project identities and relative repository or icon paths', async () => {
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
    projects: [{
      id: 'safe',
      name: 'Safe',
      root: '/projects/safe',
      repositories: ['repositories/safe'],
    }],
  }));
  assert.throws(
    () => configuredProjects({}, homeDirectory),
    /repositories\[0\] must be an absolute project directory/,
  );

  await writeFile(configurationPath, JSON.stringify({
    projects: [{ id: 'safe', name: 'Safe', root: '/projects/safe', icon: 'icon.png' }],
  }));
  assert.throws(() => configuredProjects({}, homeDirectory), /icon must be an absolute PNG path/);

  await writeFile(configurationPath, JSON.stringify({
    projects: [{
      id: 'safe',
      name: 'Safe',
      root: '/projects/safe',
      coordinatorTaskId: '../unsafe',
    }],
  }));
  assert.throws(() => configuredProjects({}, homeDirectory), /coordinatorTaskId must be a safe/);

  await writeFile(configurationPath, JSON.stringify({
    projects: [{
      id: 'safe',
      name: 'Safe',
      root: '/projects/safe',
      coordinatorTaskId: 'codex://threads/safe-task?view=review',
    }],
  }));
  assert.throws(() => configuredProjects({}, homeDirectory), /coordinatorTaskId must be a safe/);

  await writeFile(configurationPath, JSON.stringify({
    coordinatorTaskPattern: '   ',
    projects: [{ id: 'safe', name: 'Safe', root: '/projects/safe' }],
  }));
  assert.throws(() => configuredProjects({}, homeDirectory), /coordinatorTaskPattern must contain/);

  await writeFile(configurationPath, JSON.stringify({
    projects: [{ id: 'safe', name: 'Safe', root: '/projects/safe', workflowRules: [
      { marker: '(BAD)', state: 'invented' },
    ] }],
  }));
  assert.throws(() => configuredProjects({}, homeDirectory), /supported workflow state/);

  await writeFile(configurationPath, JSON.stringify({
    projects: [{ id: 'safe', name: 'Safe', root: '/projects/safe', compactLabelPatterns: ['(a+)+'] }],
  }));
  assert.throws(() => configuredProjects({}, homeDirectory), /bounded compact-label pattern/);

  await writeFile(configurationPath, JSON.stringify({
    projects: [{ id: 'safe', name: 'Safe', root: '/projects/safe',
      compactLabelPatterns: Array.from({ length: 9 }, (_, index) => `ID${index}{1,3}`) }],
  }));
  assert.throws(() => configuredProjects({}, homeDirectory), /at most 8 patterns/);

  await writeFile(configurationPath, JSON.stringify({
    workflowRules: Array.from({ length: 24 }, (_, index) => ({
      marker: `[CUSTOM-${index}]`, state: 'blocked',
    })),
    projects: [{ id: 'safe', name: 'Safe', root: '/projects/safe' }],
  }));
  assert.throws(() => configuredProjects({}, homeDirectory), /effective workflow rules must contain at most 32/);
});

test('global workflow rules and project overrides/additions inherit while label rules stay independent', async () => {
  const configurationDirectory = join(homeDirectory, 'Library', 'Application Support', 'Codex Keypad');
  await mkdir(configurationDirectory, { recursive: true });
  await writeFile(join(configurationDirectory, 'config.json'), JSON.stringify({
    workflowRules: [
      { marker: '(PR:CI)', state: 'waiting-for-review' },
      { marker: '[WAITING]', state: 'waiting-for-input' },
    ],
    compactLabelPatterns: ['#[0-9]{1,6}'],
    projects: [
      { id: 'global', name: 'Global', root: '/projects/global' },
      { id: 'custom', name: 'Custom', root: '/projects/custom', workflowRules: [
        { marker: '(PR:CI)', state: 'waiting-for-ci' },
        { marker: '[OPS]', state: 'blocked' },
      ], compactLabelPatterns: ['DIST-[0-9]{1,6}'] },
    ],
  }));
  const [global, custom] = configuredProjects({}, homeDirectory);
  assert.equal(global?.workflowRules?.find(({ marker }) => marker === '(PR:CI)')?.state, 'waiting-for-review');
  assert.equal(custom?.workflowRules?.find(({ marker }) => marker === '(PR:CI)')?.state, 'waiting-for-ci');
  assert.equal(custom?.workflowRules?.some(({ marker }) => marker === '[WAITING]'), true);
  assert.equal(custom?.workflowRules?.some(({ marker }) => marker === '[OPS]'), true);
  assert.deepEqual(custom?.compactLabelPatterns, ['DIST-[0-9]{1,6}']);
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

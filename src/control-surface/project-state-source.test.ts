import assert from 'node:assert/strict';
import test from 'node:test';

import type { CodexTaskSource } from '../codex/codex-task-source.ts';
import { readProjectStates } from './project-state-source.ts';

test('reports all current workers exactly while preserving project order', () => {
  const requestedRoots: Array<readonly string[]> = [];
  const states = readProjectStates(
    [
      { id: 'second', name: 'Second', root: '/projects/second', icon: '/icons/second.png' },
      { id: 'first', name: 'First', root: '/projects/first' },
    ],
    (roots) => {
      requestedRoots.push(roots);
      return source(roots[0] === '/projects/second' ? 2 : 0);
    },
    {
      readIconMetadata: () => ({ isFile: true, size: 4096, modifiedAt: 1234 }),
      isProjectDirectory: () => true,
      now: () => 1000,
    },
  );

  assert.deepEqual(requestedRoots, [
    ['/projects/second'],
    ['/projects/first'],
  ]);
  assert.deepEqual(states.map(({ project, activeWorkerCount }) => ({ project, activeWorkerCount })), [
    {
      project: {
        id: 'second',
        name: 'Second',
        icon: { path: '/icons/second.png', modifiedAt: 1234 },
      },
      activeWorkerCount: { availability: 'available', count: 2, truncated: false },
    },
    {
      project: { id: 'first', name: 'First' },
      activeWorkerCount: { availability: 'available', count: 0, truncated: false },
    },
  ]);
  assert.deepEqual(states[0]?.tasks.map(({ id }) => id), ['task-0', 'task-1']);
  assert.deepEqual(states[1]?.tasks, []);
});

test('includes configured repository roots with the Codex project root', () => {
  const requestedRoots: Array<readonly string[]> = [];
  const states = readProjectStates(
    [{
      id: 'hive',
      name: 'Hive',
      root: '/projects/hive',
      repositories: ['/projects/hive/repo', '/projects/hive/other-repo'],
      coordinatorTaskId: 'hive-thread',
      coordinatorTaskPattern: '* Hive',
    }],
    (roots) => {
      requestedRoots.push(roots);
      return source(0);
    },
    { isProjectDirectory: () => true, now: () => 1000 },
  );

  assert.deepEqual(requestedRoots, [[
    '/projects/hive',
    '/projects/hive/repo',
    '/projects/hive/other-repo',
  ]]);
  assert.equal(states[0]?.coordinatorTaskId, 'hive-thread');
  assert.equal(states[0]?.coordinatorTaskPattern, '* Hive');
});

test('includes every active project task independently of the worker count', () => {
  const tasks = [
    { id: 'coordinator', title: 'Project coordinator', status: 'working' as const, updatedAt: 3000 },
    { id: 'worker', title: 'Bounded worker', status: 'working' as const, updatedAt: 2000 },
  ];
  const states = readProjectStates(
    [{ id: 'project', name: 'Project', root: '/projects/project' }],
    () => ({
      listTasks: (limit) => tasks.slice(0, limit),
      listActiveWorkerTasks: () => [tasks[1]!],
    }),
    { isProjectDirectory: () => true, now: () => 3000 },
  );

  assert.deepEqual(states[0]?.tasks, tasks);
  assert.deepEqual(states[0]?.activeWorkerCount, {
    availability: 'available',
    count: 1,
    truncated: false,
  });
});

test('reports an unavailable source independently and bounds large current counts', () => {
  const states = readProjectStates(
    [
      { id: 'missing', name: 'Missing', root: '/projects/missing' },
      { id: 'busy', name: 'Busy', root: '/projects/busy' },
    ],
    (roots) => {
      if (roots[0]?.endsWith('/missing')) {
        throw new Error('database unavailable');
      }
      return source(100);
    },
    { isProjectDirectory: () => true, now: () => 1000 },
  );

  assert.deepEqual(states[0]?.activeWorkerCount, { availability: 'unavailable' });
  assert.deepEqual(states[1]?.activeWorkerCount, {
    availability: 'available',
    count: 100,
    truncated: true,
  });
});

test('marks a missing or oversized custom icon unavailable without dropping the project', () => {
  const states = readProjectStates(
    [{ id: 'project', name: 'Project', root: '/projects/project', icon: '/icons/project.png' }],
    () => source(0),
    {
      readIconMetadata: () => ({
        isFile: true,
        size: 2 * 1024 * 1024,
        modifiedAt: 1234,
      }),
      isProjectDirectory: () => true,
      now: () => 1000,
    },
  );

  assert.deepEqual(states[0]?.project.icon, {
    path: '/icons/project.png',
    modifiedAt: 'unavailable',
  });
});

test('does not report a missing configured project root as idle', () => {
  const states = readProjectStates(
    [{ id: 'missing', name: 'Missing', root: '/projects/missing' }],
    () => source(0),
    { isProjectDirectory: () => false },
  );

  assert.deepEqual(states[0]?.activeWorkerCount, { availability: 'unavailable' });
});

test('reports only stale worker evidence as stale', () => {
  const states = readProjectStates(
    [{ id: 'stale', name: 'Stale', root: '/projects/stale' }],
    () => source(1),
    { isProjectDirectory: () => true, now: () => 25 * 60 * 60 * 1000 },
  );

  assert.deepEqual(states[0]?.activeWorkerCount, { availability: 'stale' });
});

test('preserves current workers as a lower bound when stale workers are also returned', () => {
  const now = 25 * 60 * 60 * 1000;
  const states = readProjectStates(
    [{ id: 'mixed', name: 'Mixed', root: '/projects/mixed' }],
    () => sourceWithUpdatedAt(now - 1000, 0),
    { isProjectDirectory: () => true, now: () => now },
  );

  assert.deepEqual(states[0]?.activeWorkerCount, {
    availability: 'available',
    count: 1,
    truncated: true,
    staleEvidence: true,
  });
  assert.equal(states[0]?.tasks[0]?.id, 'task-0');
});

test('reports implausibly future-dated worker evidence as unavailable', () => {
  const now = 1000;
  const states = readProjectStates(
    [{ id: 'future', name: 'Future', root: '/projects/future' }],
    () => sourceWithUpdatedAt(now + 5 * 60 * 1000 + 1),
    { isProjectDirectory: () => true, now: () => now },
  );

  assert.deepEqual(states[0]?.activeWorkerCount, { availability: 'unavailable' });
  assert.equal(states[0]?.tasks[0]?.id, 'task-0');
});

function source(count: number): CodexTaskSource {
  return sourceWithUpdatedAt(...Array.from({ length: count }, (_, index) => index));
}

function sourceWithUpdatedAt(...updatedAt: readonly number[]): CodexTaskSource {
  return {
    listTasks: (limit) => updatedAt
      .slice(0, limit)
      .map((timestamp, index) => ({
        id: `task-${index}`,
        title: `Task ${index}`,
        status: 'working',
        updatedAt: timestamp,
      })),
    listActiveWorkerTasks: (limit) => updatedAt
      .slice(0, limit)
      .map((timestamp, index) => ({
        id: `thread-${index}`,
        title: `Task ${index}`,
        status: 'working',
        updatedAt: timestamp,
      }),
    ),
  };
}

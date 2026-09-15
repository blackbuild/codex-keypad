import assert from 'node:assert/strict';
import test from 'node:test';

import type { CodexTaskSource } from '../codex/codex-task-source.ts';
import { readProjectStates } from './project-state-source.ts';

test('reads each configured project independently and preserves configuration order', () => {
  const requestedRoots: string[] = [];
  const states = readProjectStates(
    [
      { id: 'second', name: 'Second', root: '/projects/second', icon: '/icons/second.png' },
      { id: 'first', name: 'First', root: '/projects/first' },
    ],
    (root) => {
      requestedRoots.push(root);
      return source(root === '/projects/second' ? 2 : 0);
    },
    {
      readIconMetadata: () => ({ isFile: true, size: 4096, modifiedAt: 1234 }),
      isProjectDirectory: () => true,
      now: () => 1000,
    },
  );

  assert.deepEqual(requestedRoots, ['/projects/second', '/projects/first']);
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
});

test('isolates missing project state and bounds exceptionally large counts', () => {
  const states = readProjectStates(
    [
      { id: 'missing', name: 'Missing', root: '/projects/missing' },
      { id: 'busy', name: 'Busy', root: '/projects/busy' },
    ],
    (root) => {
      if (root.endsWith('/missing')) {
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

test('does not report an implausibly stale active worker as current', () => {
  const states = readProjectStates(
    [{ id: 'stale', name: 'Stale', root: '/projects/stale' }],
    () => source(1),
    { isProjectDirectory: () => true, now: () => 25 * 60 * 60 * 1000 },
  );

  assert.deepEqual(states[0]?.activeWorkerCount, { availability: 'unavailable' });
});

function source(count: number): CodexTaskSource {
  return {
    listActiveTasks: () => [],
    listActiveWorkerTasks: (limit) => Array.from(
      { length: Math.min(limit, count) },
      (_, index) => ({
        id: `thread-${index}`,
        title: `Task ${index}`,
        status: 'working',
        updatedAt: index,
      }),
    ),
  };
}

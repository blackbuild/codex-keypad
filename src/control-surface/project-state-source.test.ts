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
    () => ({ isFile: true, size: 4096, modifiedAt: 1234 }),
  );

  assert.deepEqual(requestedRoots, ['/projects/second', '/projects/first']);
  assert.deepEqual(states.map(({ project, activeWorkerCount }) => ({ project, activeWorkerCount })), [
    {
      project: {
        id: 'second',
        name: 'Second',
        icon: { path: '/icons/second.png', modifiedAt: 1234 },
      },
      activeWorkerCount: 2,
    },
    { project: { id: 'first', name: 'First' }, activeWorkerCount: 0 },
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
  );

  assert.equal(states[0]?.activeWorkerCount, undefined);
  assert.equal(states[1]?.activeWorkerCount, '100+');
});

test('marks a missing or oversized custom icon unavailable without dropping the project', () => {
  const states = readProjectStates(
    [{ id: 'project', name: 'Project', root: '/projects/project', icon: '/icons/project.png' }],
    () => source(0),
    () => ({ isFile: true, size: 2 * 1024 * 1024, modifiedAt: 1234 }),
  );

  assert.deepEqual(states[0]?.project.icon, {
    path: '/icons/project.png',
    modifiedAt: 'unavailable',
  });
});

function source(count: number): CodexTaskSource {
  return {
    listActiveTasks: (limit) => Array.from(
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

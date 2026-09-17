import assert from 'node:assert/strict';
import test from 'node:test';

import type { CodexTask } from '../codex/codex-task-source.ts';
import {
  buildProjectControlSurface,
  exactActiveWorkerCount,
  truncatedActiveWorkerCount,
  unavailableActiveWorkerCount,
  type CodexProjectState,
} from './control-surface-state.ts';

const task: CodexTask = {
  id: 'thread-123',
  title: 'Implement the live project overview',
  status: 'working',
  updatedAt: 1234,
};

const olderTask: CodexTask = {
  id: 'thread-older',
  title: 'Review the adapter contract',
  status: 'completed',
  updatedAt: 1200,
};

test('normalizes configured projects in stable order with icons and active-worker counts', () => {
  const state = buildProjectControlSurface([
    project('architecture', 'Architecture', 2, '/icons/architecture.png'),
    project('codex-keypad', 'Codex Keypad', 1),
    project('idle', 'Idle Project', 0),
  ]);

  assert.equal(state.schemaVersion, 6);
  assert.deepEqual(state.view.tiles, [
    {
      id: 'project:architecture',
      label: 'Architecture · 2 active',
      iconPath: '/icons/architecture.png',
      action: { type: 'open-task-view', projectId: 'architecture' },
    },
    {
      id: 'project:codex-keypad',
      label: 'Codex Keypad · 1 active',
      action: { type: 'open-task-view', projectId: 'codex-keypad' },
    },
    {
      id: 'project:idle',
      label: 'Idle Project · Idle',
      action: { type: 'open-task-view', projectId: 'idle' },
    },
  ]);
  assert.equal(state.entry.label, 'Codex · 3 active');
});

test('orders every configured project for native device pagination', () => {
  const projects = Array.from({ length: 15 }, (_, index) =>
    project(`project-${String(index + 1).padStart(2, '0')}`, `Project ${index + 1}`, 0));

  const state = buildProjectControlSurface(projects);

  assert.equal(state.view.tiles.length, 15);
  assert.deepEqual(state.view.tiles.map((tile) => tile.id), [
    'project:project-01',
    'project:project-02',
    'project:project-03',
    'project:project-04',
    'project:project-05',
    'project:project-06',
    'project:project-07',
    'project:project-08',
    'project:project-09',
    'project:project-10',
    'project:project-11',
    'project:project-12',
    'project:project-13',
    'project:project-14',
    'project:project-15',
  ]);
});

test('publishes an empty project overview without a redundant Back tile', () => {
  const state = buildProjectControlSurface([]);

  assert.equal(state.view.level, 'project-overview');
  assert.deepEqual(state.view.tiles, []);
});

test('presents unavailable and bounded counts without claiming idle state', () => {
  const state = buildProjectControlSurface([
    project('missing', 'Missing', undefined),
    project('busy', 'Very Busy', '100+'),
  ]);

  assert.equal(state.entry.label, 'Codex · count unavailable');
  assert.equal(state.view.tiles[0]?.label, 'Missing · Count unavailable');
  assert.equal(state.view.tiles[1]?.label, 'Very Busy · 100+ active');
});

test('normalizes every selected-project task in deterministic recency order', () => {
  const selected = {
    ...project('codex-keypad', 'Codex Keypad', 1),
    tasks: [olderTask, task],
  };
  const state = buildProjectControlSurface([selected], {
    level: 'task-view',
    selectedProjectId: 'codex-keypad',
  });

  assert.equal(state.schemaVersion, 6);
  assert.deepEqual(state.view.tiles.slice(1), [
    {
      id: 'task:thread-123',
      label: 'Implement the live project overview · Working',
      status: 'working',
      action: { type: 'open-codex-task', threadId: 'thread-123' },
    },
    {
      id: 'task:thread-older',
      label: 'Review the adapter contract · Completed',
      status: 'completed',
      action: { type: 'open-codex-task', threadId: 'thread-older' },
    },
  ]);
});

test('places the configured coordinator before Back and gives it the project icon', () => {
  const selected: CodexProjectState = {
    ...project('codex-keypad', 'Codex Keypad', 1, '/icons/codex-keypad.png'),
    coordinatorTaskId: olderTask.id,
    tasks: [task, olderTask],
  };
  const state = buildProjectControlSurface([selected], {
    level: 'task-view',
    selectedProjectId: 'codex-keypad',
  });

  assert.equal(state.schemaVersion, 6);
  assert.deepEqual(state.view.tiles, [
    {
      id: 'task:thread-older',
      label: 'Review the adapter contract · Completed',
      iconPath: '/icons/codex-keypad.png',
      role: 'coordinator',
      status: 'completed',
      action: { type: 'open-codex-task', threadId: 'thread-older' },
    },
    { id: 'nav.back', label: 'Back', action: { type: 'open-project-overview' } },
    {
      id: 'task:thread-123',
      label: 'Implement the live project overview · Working',
      status: 'working',
      action: { type: 'open-codex-task', threadId: 'thread-123' },
    },
  ]);
});

test('bounds task identity without dropping its normalized state', () => {
  const selected = {
    ...project('codex-keypad', 'Codex Keypad', 1),
    tasks: [{ ...task, title: 'A'.repeat(100) }],
  };
  const state = buildProjectControlSurface([selected], {
    level: 'task-view',
    selectedProjectId: 'codex-keypad',
  });

  assert.equal(state.view.tiles[1]?.label, `${'A'.repeat(69)}… · Working`);
});

test('orders every task for native device pagination and reuses vacated slots', () => {
  const tasks = Array.from({ length: 10 }, (_, index): CodexTask => ({
    id: `thread-${String(index + 1).padStart(2, '0')}`,
    title: `Task ${index + 1}`,
    status: 'working',
    updatedAt: 10_000 - index,
  }));
  const selected = { ...project('codex-keypad', 'Codex Keypad', 10), tasks };

  const first = buildProjectControlSurface([selected], {
    level: 'task-view',
    selectedProjectId: 'codex-keypad',
  });
  const afterRemoval = buildProjectControlSurface([{
    ...selected,
    tasks: tasks.filter(({ id }) => id !== 'thread-03'),
  }], {
    level: 'task-view',
    selectedProjectId: 'codex-keypad',
  });

  assert.deepEqual(first.view.tiles.map(({ id }) => id), [
    'nav.back',
    'task:thread-01',
    'task:thread-02',
    'task:thread-03',
    'task:thread-04',
    'task:thread-05',
    'task:thread-06',
    'task:thread-07',
    'task:thread-08',
    'task:thread-09',
    'task:thread-10',
  ]);
  assert.deepEqual(afterRemoval.view.tiles.slice(1).map(({ id }) => id), [
    'task:thread-01',
    'task:thread-02',
    'task:thread-04',
    'task:thread-05',
    'task:thread-06',
    'task:thread-07',
    'task:thread-08',
    'task:thread-09',
    'task:thread-10',
  ]);
});

function project(
  id: string,
  name: string,
  activeWorkerCount: number | '100+' | undefined,
  iconPath?: string,
): CodexProjectState {
  return {
    project: {
      id,
      name,
      ...(iconPath ? { icon: { path: iconPath, modifiedAt: 1234 } } : {}),
    },
    activeWorkerCount: activeWorkerCount === undefined
      ? unavailableActiveWorkerCount
      : activeWorkerCount === '100+'
        ? truncatedActiveWorkerCount(100)
        : exactActiveWorkerCount(activeWorkerCount),
    tasks: [],
  };
}

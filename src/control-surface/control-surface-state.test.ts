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

test('normalizes configured projects in stable order with icons and active-worker counts', () => {
  const state = buildProjectControlSurface([
    project('architecture', 'Architecture', 2, '/icons/architecture.png'),
    project('codex-keypad', 'Codex Keypad', 1),
    project('idle', 'Idle Project', 0),
  ]);

  assert.equal(state.schemaVersion, 2);
  assert.deepEqual(state.view.tiles, [
    { id: 'nav.back', label: 'Back', action: { type: 'close-control-surface' } },
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

test('paginates configured projects deterministically within nine LCD keys', () => {
  const projects = Array.from({ length: 15 }, (_, index) =>
    project(`project-${String(index + 1).padStart(2, '0')}`, `Project ${index + 1}`, 0));

  const first = buildProjectControlSurface(projects, { projectPage: 0 });
  const second = buildProjectControlSurface(projects, { projectPage: 1 });
  const third = buildProjectControlSurface(projects, { projectPage: 2 });

  assert.equal(first.view.tiles.length, 9);
  assert.deepEqual(first.view.tiles.slice(1, -1).map((tile) => tile.id), [
    'project:project-01',
    'project:project-02',
    'project:project-03',
    'project:project-04',
    'project:project-05',
    'project:project-06',
    'project:project-07',
  ]);
  assert.deepEqual(first.view.tiles.at(-1), {
    id: 'page.next',
    label: 'Next · 2/3',
    action: { type: 'open-project-page', page: 1 },
  });

  assert.equal(second.view.tiles.length, 9);
  assert.deepEqual(second.view.tiles.slice(2, -1).map((tile) => tile.id), [
    'project:project-08',
    'project:project-09',
    'project:project-10',
    'project:project-11',
    'project:project-12',
    'project:project-13',
  ]);
  assert.deepEqual(third.view.tiles.slice(2).map((tile) => tile.id), [
    'project:project-14',
    'project:project-15',
  ]);
});

test('presents unavailable and bounded counts without claiming idle state', () => {
  const state = buildProjectControlSurface([
    project('missing', 'Missing', undefined),
    project('busy', 'Very Busy', '100+'),
  ]);

  assert.equal(state.entry.label, 'Codex · count unavailable');
  assert.equal(state.view.tiles[1]?.label, 'Missing · Count unavailable');
  assert.equal(state.view.tiles[2]?.label, 'Very Busy · 100+ active');
});

test('normalizes the selected project task view and validated task action', () => {
  const selected = { ...project('codex-keypad', 'Codex Keypad', 1), task };
  const state = buildProjectControlSurface([selected], {
    level: 'task-view',
    selectedProjectId: 'codex-keypad',
  });

  assert.deepEqual(state.view.tiles[1], {
    id: 'task:thread-123',
    label: task.title,
    status: 'working',
    action: { type: 'open-codex-task', threadId: 'thread-123' },
  });
});

test('bounds task labels for the Logitech contract', () => {
  const selected = {
    ...project('codex-keypad', 'Codex Keypad', 1),
    task: { ...task, title: 'A'.repeat(100) },
  };
  const state = buildProjectControlSurface([selected], {
    level: 'task-view',
    selectedProjectId: 'codex-keypad',
  });

  assert.equal(state.view.tiles[1]?.label, `${'A'.repeat(39)}…`);
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
  };
}

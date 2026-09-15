import assert from 'node:assert/strict';
import test from 'node:test';

import type { CodexTask } from '../codex/codex-task-source.ts';
import { buildSingleProjectControlSurface } from './control-surface-state.ts';

const task: CodexTask = {
  id: 'thread-123',
  title: 'Implement three-level Codex navigation',
  status: 'working',
  updatedAt: 1234,
};
const project = { id: 'codex-keypad', name: 'Codex Keypad' };

test('normalizes the project overview and its semantic actions', () => {
  const state = buildSingleProjectControlSurface(project, task);

  assert.deepEqual(state.view, {
    level: 'project-overview',
    title: 'Projects',
    tiles: [
      { id: 'nav.back', label: 'Back', action: { type: 'close-control-surface' } },
      {
        id: 'project:codex-keypad',
        label: 'Codex Keypad · 1 active',
        action: { type: 'open-task-view', projectId: 'codex-keypad' },
      },
    ],
  });
});

test('normalizes the exact task view and validated task action', () => {
  const state = buildSingleProjectControlSurface(project, task, 'task-view');

  assert.deepEqual(state.view.tiles[1], {
    id: 'task:thread-123',
    label: task.title,
    status: 'working',
    action: { type: 'open-codex-task', threadId: 'thread-123' },
  });
});

test('keeps the one-project path visibly idle when no task is active', () => {
  const state = buildSingleProjectControlSurface(project, undefined);

  assert.equal(state.entry.label, 'Codex · idle');
  assert.equal(state.view.tiles[1]?.label, 'Codex Keypad · Idle');
});

test('bounds task labels for the Logitech contract', () => {
  const state = buildSingleProjectControlSurface(
    project,
    { ...task, title: 'A'.repeat(100) },
    'task-view',
  );

  assert.equal(state.view.tiles[1]?.label, `${'A'.repeat(39)}…`);
});

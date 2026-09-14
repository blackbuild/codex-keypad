import assert from 'node:assert/strict';
import test from 'node:test';

import type { CodexTask } from '../codex/codex-task-source.ts';
import { buildSingleProjectControlSurface } from './control-surface-state.ts';

const task: CodexTask = {
  id: '01a0a08b-0015-7071-ab33-c3a44dfe8cb8',
  title: 'Implement three-level Codex navigation',
  status: 'working',
  updatedAt: 1234,
};

test('describes one live project and its exact Codex task with semantic actions', () => {
  assert.deepEqual(
    buildSingleProjectControlSurface(
      { id: 'codex-keypad', name: 'Codex Keypad' },
      task,
    ),
    {
      schemaVersion: 1,
      revision: '01a0a08b-0015-7071-ab33-c3a44dfe8cb8:1234',
      entry: {
        id: 'codex',
        label: 'Codex · 1 active',
        action: { type: 'open-project-overview' },
      },
      projects: [
        {
          id: 'codex-keypad',
          label: 'Codex Keypad',
          summary: '1 active',
          action: {
            type: 'open-task-view',
            projectId: 'codex-keypad',
          },
          tasks: [
            {
              id: '01a0a08b-0015-7071-ab33-c3a44dfe8cb8',
              label: 'Implement three-level Codex navigation',
              status: 'working',
              action: {
                type: 'open-codex-task',
                threadId: '01a0a08b-0015-7071-ab33-c3a44dfe8cb8',
              },
            },
          ],
        },
      ],
    },
  );
});

test('keeps the project path present and visibly idle when no task is active', () => {
  const state = buildSingleProjectControlSurface(
    { id: 'codex-keypad', name: 'Codex Keypad' },
    undefined,
  );

  assert.equal(state.revision, 'idle');
  assert.equal(state.entry.label, 'Codex · idle');
  assert.equal(state.projects[0]?.summary, 'Idle');
  assert.deepEqual(state.projects[0]?.tasks, []);
});

test('bounds task labels for the Logitech contract', () => {
  const state = buildSingleProjectControlSurface(
    { id: 'codex-keypad', name: 'Codex Keypad' },
    { ...task, title: 'A'.repeat(100) },
  );

  assert.equal(state.projects[0]?.tasks[0]?.label, `${'A'.repeat(39)}…`);
});

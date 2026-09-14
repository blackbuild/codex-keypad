import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';

import type { CodexTaskSource } from '../codex/codex-task-source.ts';
import { ControlSurfaceStatePublisher } from './control-surface-state-publisher.ts';
import { refreshSingleProjectControlSurface } from './control-surface-state-service.ts';

test('refreshes the handoff from the currently active task', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'codex-keypad-refresh-'));
  const output = join(directory, 'state.json');
  const source: CodexTaskSource = {
    listActiveTasks: (limit) => {
      assert.equal(limit, 1);
      return [{
        id: 'thread-123',
        title: 'Live task',
        status: 'working',
        updatedAt: 456,
      }];
    },
  };

  try {
    await refreshSingleProjectControlSurface(
      source,
      new ControlSurfaceStatePublisher(output),
      { id: 'codex-keypad', name: 'Codex Keypad' },
    );

    const state = JSON.parse(await readFile(output, 'utf8')) as {
      projects: Array<{ tasks: Array<{ action: unknown }> }>;
    };
    assert.deepEqual(state.projects[0]?.tasks[0]?.action, {
      type: 'open-codex-task',
      threadId: 'thread-123',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

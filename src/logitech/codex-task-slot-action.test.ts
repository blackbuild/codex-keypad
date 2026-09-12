import assert from 'node:assert/strict';
import test from 'node:test';

import type { CodexTask } from '../codex/codex-task-source.ts';
import { CodexTaskSlotAction } from './codex-task-slot-action.ts';

const task: CodexTask = {
  id: 'thread-123',
  title: 'Investigate the Codex Desktop integration',
  status: 'working',
  updatedAt: 123,
};

test('keeps a stable slot action name and opens its captured task', async () => {
  const opened: string[] = [];
  const action = new CodexTaskSlotAction(3, task, async (threadId) => {
    opened.push(threadId);
  });

  assert.equal(action.name, 'open_active_task_3');
  assert.equal(action.displayName, task.title);
  await action.onKeyDown();
  assert.deepEqual(opened, ['thread-123']);
});

test('an empty slot remains inert', async () => {
  let opened = false;
  const action = new CodexTaskSlotAction(9, undefined, async () => {
    opened = true;
  });

  assert.equal(action.displayName, 'Slot 9: No active task');
  await action.onKeyDown();
  assert.equal(opened, false);
});

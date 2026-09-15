import assert from 'node:assert/strict';
import test from 'node:test';

import type { CodexTask } from '../codex/codex-task-source.ts';
import { SingleProjectNavigation } from './single-project-navigation.ts';

const project = { id: 'codex-keypad', name: 'Codex Keypad' };
const task: CodexTask = {
  id: 'thread-123',
  title: 'Exact task',
  status: 'working',
  updatedAt: 456,
};

test('project and Back actions move between normalized views', async () => {
  const navigation = new SingleProjectNavigation(project, async () => undefined);

  assert.equal(await navigation.perform(
    { type: 'open-task-view', projectId: 'codex-keypad' },
    task,
  ), true);
  assert.equal(navigation.snapshot(task).view.level, 'task-view');
  assert.equal(await navigation.perform({ type: 'open-project-overview' }, task), true);
  assert.equal(navigation.snapshot(task).view.level, 'project-overview');
});

test('the task action opens only the exact current Codex task', async () => {
  const opened: string[] = [];
  const navigation = new SingleProjectNavigation(project, async (threadId) => {
    opened.push(threadId);
  });

  assert.equal(await navigation.perform(
    { type: 'open-codex-task', threadId: 'another-task' },
    task,
  ), false);
  assert.equal(await navigation.perform(
    { type: 'open-codex-task', threadId: 'thread-123' },
    task,
  ), true);
  assert.deepEqual(opened, ['thread-123']);
});

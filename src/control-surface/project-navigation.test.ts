import assert from 'node:assert/strict';
import test from 'node:test';

import type { CodexTask } from '../codex/codex-task-source.ts';
import { exactActiveWorkerCount, type CodexProjectState } from './control-surface-state.ts';
import { ProjectNavigation } from './project-navigation.ts';

const task: CodexTask = {
  id: 'thread-123',
  title: 'Exact task',
  status: 'working',
  updatedAt: 456,
};
const projects: readonly CodexProjectState[] = [
  project('architecture'),
  { ...project('codex-keypad'), tasks: [task] },
];

test('opens the task view for the matching project and returns to its overview', async () => {
  const navigation = new ProjectNavigation(async () => undefined);

  assert.equal(await navigation.perform(
    { type: 'open-task-view', projectId: 'codex-keypad' },
    projects,
  ), true);
  assert.equal(navigation.snapshot(projects).view.title, 'codex-keypad');
  assert.equal(await navigation.perform({ type: 'open-project-overview' }, projects), true);
  assert.equal(navigation.snapshot(projects).view.level, 'project-overview');
});

test('accepts only project pages that exist for the current configuration', async () => {
  const navigation = new ProjectNavigation(async () => undefined);
  const manyProjects = Array.from({ length: 15 }, (_, index) => project(`project-${index}`));

  assert.equal(await navigation.perform({ type: 'open-project-page', page: 2 }, manyProjects), true);
  assert.equal(navigation.snapshot(manyProjects).view.tiles[2]?.id, 'project:project-13');
  assert.equal(await navigation.perform({ type: 'open-project-page', page: 3 }, manyProjects), false);
  assert.equal(await navigation.perform(
    { type: 'open-project-page', page: 2 },
    manyProjects.slice(0, 14),
  ), false);
});

test('returns safely to the overview when the selected project is removed', async () => {
  const navigation = new ProjectNavigation(async () => undefined);
  await navigation.perform({ type: 'open-task-view', projectId: 'codex-keypad' }, projects);

  assert.equal(navigation.snapshot([projects[0]!]).view.level, 'project-overview');
});

test('opens only the exact current task in the selected project', async () => {
  const opened: string[] = [];
  const navigation = new ProjectNavigation(async (threadId) => {
    opened.push(threadId);
  });
  await navigation.perform({ type: 'open-task-view', projectId: 'codex-keypad' }, projects);

  assert.equal(await navigation.perform(
    { type: 'open-codex-task', threadId: 'another-task' },
    projects,
  ), false);
  assert.equal(await navigation.perform(
    { type: 'open-codex-task', threadId: 'thread-123' },
    projects,
  ), true);
  assert.deepEqual(opened, ['thread-123']);
});

test('validates task pages and clamps them when live tasks are removed', async () => {
  const navigation = new ProjectNavigation(async () => undefined);
  const tasks = Array.from({ length: 10 }, (_, index): CodexTask => ({
    id: `thread-${index}`,
    title: `Task ${index}`,
    status: 'working',
    updatedAt: 10 - index,
  }));
  const populated = [{ ...project('codex-keypad'), tasks }];
  await navigation.perform({ type: 'open-task-view', projectId: 'codex-keypad' }, populated);

  assert.equal(await navigation.perform({ type: 'open-task-page', page: 1 }, populated), true);
  assert.equal(navigation.snapshot(populated).view.tiles[2]?.id, 'task:thread-7');
  assert.equal(await navigation.perform({ type: 'open-task-page', page: 2 }, populated), false);

  const reduced = [{ ...project('codex-keypad'), tasks: tasks.slice(0, 3) }];
  assert.deepEqual(navigation.snapshot(reduced).view.tiles.map(({ id }) => id), [
    'nav.back',
    'task:thread-0',
    'task:thread-1',
    'task:thread-2',
  ]);
});

test('reflects newly active and removed tasks without resetting navigation', async () => {
  const navigation = new ProjectNavigation(async () => undefined);
  await navigation.perform({ type: 'open-task-view', projectId: 'codex-keypad' }, projects);

  const newlyActive: CodexTask = {
    id: 'thread-new',
    title: 'New task',
    status: 'working',
    updatedAt: 999,
  };
  const updated = [
    project('architecture'),
    { ...project('codex-keypad'), tasks: [newlyActive] },
  ];

  assert.deepEqual(navigation.snapshot(updated).view.tiles.map(({ id }) => id), [
    'nav.back',
    'task:thread-new',
  ]);
  assert.equal(await navigation.perform(
    { type: 'open-codex-task', threadId: 'thread-123' },
    updated,
  ), false);
});

function project(id: string): CodexProjectState {
  return { project: { id, name: id }, activeWorkerCount: exactActiveWorkerCount(0), tasks: [] };
}

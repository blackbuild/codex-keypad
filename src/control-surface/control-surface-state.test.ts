import assert from 'node:assert/strict';
import test from 'node:test';

import type { CodexTask } from '../codex/codex-task-source.ts';
import {
  buildProjectControlSurface,
  exactActiveWorkerCount,
  staleActiveWorkerCount,
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

  assert.equal(state.schemaVersion, 8);
  assert.deepEqual(state.view.tiles.map(({ id, label, iconPath, action }) => ({
    id,
    label,
    ...(iconPath ? { iconPath } : {}),
    action,
  })), [
    {
      id: 'project:architecture',
      label: 'Architecture',
      iconPath: '/icons/architecture.png',
      action: { type: 'open-task-view', projectId: 'architecture' },
    },
    {
      id: 'project:codex-keypad',
      label: 'Codex Keypad',
      action: { type: 'open-task-view', projectId: 'codex-keypad' },
    },
    {
      id: 'project:idle',
      label: 'Idle Project',
      action: { type: 'open-task-view', projectId: 'idle' },
    },
  ]);
  assert.deepEqual(state.view.tiles.map(({ visual }) => visual.badge), ['2', '1', '0']);
  assert.equal(state.entry.label, 'Codex · Working x2 · 3 active');
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

test('publishes an empty project overview without a redundant Up tile', () => {
  const state = buildProjectControlSurface([]);

  assert.equal(state.view.level, 'project-overview');
  assert.deepEqual(state.view.tiles, []);
});

test('presents unavailable and bounded counts without claiming idle state', () => {
  const state = buildProjectControlSurface([
    project('missing', 'Missing', undefined),
    project('busy', 'Very Busy', '100+'),
  ]);

  assert.equal(state.entry.label, 'Codex · Unavailable +1 state · count unavailable');
  assert.equal(state.view.tiles[0]?.label, 'Missing');
  assert.equal(state.view.tiles[0]?.visual.badge, '?');
  assert.equal(state.view.tiles[1]?.label, 'Very Busy');
  assert.equal(state.view.tiles[1]?.visual.badge, '100+');
});

test('aggregates task attention across project and entry tiles with bounded composition', () => {
  const failing = { ...task, id: 'failed', status: 'failed' as const };
  const approval = {
    ...task,
    id: 'approval',
    status: 'waiting-for-approval' as const,
  };
  const state = buildProjectControlSurface([
    { ...project('first', 'First', 1), tasks: [task, failing] },
    {
      ...project('second', 'Second', 0),
      activeWorkerCount: staleActiveWorkerCount,
      tasks: [approval],
    },
  ]);

  assert.equal(state.schemaVersion, 8);
  assert.deepEqual(state.entry.attention, {
    primary: 'failed',
    indicators: [
      { state: 'failed', count: 1 },
      { state: 'waiting-for-approval', count: 1 },
      { state: 'stale', count: 1 },
    ],
    additionalStates: 1,
  });
  assert.deepEqual(state.entry.visual, {
    icon: 'entry',
    glyph: 'C',
    tone: 'failed',
    backgroundColor: '#7F1D1D',
    foregroundColor: '#FFFFFF',
    borderColors: ['#F87171', '#FACC15', '#FDBA74'],
    badge: '!A~+1',
  });
  assert.deepEqual(state.view.tiles.map((tile) => ({
    id: tile.id,
    primary: tile.attention?.primary,
    icon: tile.visual.icon,
    glyph: tile.visual.glyph,
    action: tile.action,
  })), [
    {
      id: 'project:first',
      primary: 'failed',
      icon: 'project',
      glyph: 'P',
      action: { type: 'open-task-view', projectId: 'first' },
    },
    {
      id: 'project:second',
      primary: 'waiting-for-approval',
      icon: 'project',
      glyph: 'P',
      action: { type: 'open-task-view', projectId: 'second' },
    },
  ]);
});

test('shows a valid lower-bound worker count with unavailable concurrent evidence', () => {
  const state = buildProjectControlSurface([{
    ...project('mixed', 'Mixed', 1),
    activeWorkerCount: {
      availability: 'available',
      count: 1,
      truncated: true,
      unavailableEvidence: true,
    },
    tasks: [task],
  }]);

  assert.equal(state.view.tiles[0]?.label, 'Mixed');
  assert.equal(state.view.tiles[0]?.visual.badge, '?1+');
  assert.deepEqual(state.view.tiles[0]?.attention?.indicators, [
    { state: 'unavailable', count: 1 },
    { state: 'working', count: 1 },
  ]);
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

  assert.equal(state.schemaVersion, 8);
  assert.deepEqual(state.view.tiles.slice(1).map(({ id, label, status, action }) => ({
    id,
    label,
    status,
    action,
  })), [
    {
      id: 'task:thread-123',
      label: 'Implement the liv… · Working',
      status: 'working',
      action: { type: 'open-codex-task', threadId: 'thread-123' },
    },
    {
      id: 'task:thread-older',
      label: 'Review the adapte… · Completed',
      status: 'completed',
      action: { type: 'open-codex-task', threadId: 'thread-older' },
    },
  ]);
  assert.equal(state.view.tiles[1]?.visual.glyph, 'T');
  assert.equal(state.view.tiles[1]?.visual.badge, '>');
  assert.equal(state.view.tiles[2]?.visual.badge, 'OK');
});

test('labels the configured coordinator with its project name', () => {
  const selected: CodexProjectState = {
    ...project('codex-keypad', 'Codex Keypad', 1, '/icons/codex-keypad.png'),
    coordinatorTaskId: olderTask.id,
    coordinatorTaskPattern: '*live*',
    tasks: [task, olderTask],
  };
  const state = buildProjectControlSurface([selected], {
    level: 'task-view',
    selectedProjectId: 'codex-keypad',
  });

  assert.equal(state.schemaVersion, 8);
  assert.deepEqual(state.view.tiles.map(({ id, label, iconPath, role, status, action }) => ({
    id,
    label,
    ...(iconPath ? { iconPath } : {}),
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    action,
  })), [
    {
      id: 'task:thread-older',
      label: 'Codex Keypad',
      iconPath: '/icons/codex-keypad.png',
      role: 'coordinator',
      status: 'completed',
      action: { type: 'open-codex-task', threadId: 'thread-older' },
    },
    { id: 'nav.back', label: 'Up', action: { type: 'open-project-overview' } },
    {
      id: 'task:thread-123',
      label: 'Implement the liv… · Working',
      status: 'working',
      action: { type: 'open-codex-task', threadId: 'thread-123' },
    },
  ]);
  assert.equal(state.view.tiles[0]?.visual.glyph, 'T');
  assert.equal(state.view.tiles[1]?.visual.glyph, '^');
});

test('uses the first deterministic wildcard match when an exact coordinator is absent', () => {
  const newerHive = { ...task, id: 'newer-hive', title: 'Replacement HIVE', updatedAt: 5000 };
  const olderHive = { ...olderTask, id: 'older-hive', title: 'Original Hive', updatedAt: 4000 };
  const selected: CodexProjectState = {
    ...project('codex-keypad', 'Codex Keypad', 1, '/icons/codex-keypad.png'),
    coordinatorTaskId: 'retired-hive',
    coordinatorTaskPattern: '*hive',
    tasks: [olderHive, task, newerHive],
  };
  const state = buildProjectControlSurface([selected], {
    level: 'task-view',
    selectedProjectId: 'codex-keypad',
  });

  assert.deepEqual(state.view.tiles.map(({ id }) => id), [
    'task:newer-hive',
    'nav.back',
    'task:older-hive',
    'task:thread-123',
  ]);
  assert.equal(state.view.tiles[0]?.label, 'Codex Keypad');
  assert.equal(state.view.tiles[0]?.role, 'coordinator');
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

  assert.equal(state.view.tiles[1]?.label, `${'A'.repeat(17)}… · Working`);
  assert.equal(state.view.tiles[1]?.action.type, 'open-codex-task');
  assert.equal(
    state.view.tiles[1]?.action.type === 'open-codex-task'
      ? state.view.tiles[1].action.threadId
      : undefined,
    'thread-123',
  );
});

test('renders the bounded normalized unavailable state without exposing a raw status', () => {
  const selected = {
    ...project('codex-keypad', 'Codex Keypad', 1),
    tasks: [{ ...task, status: 'unavailable' as const }],
  };
  const state = buildProjectControlSurface([selected], {
    level: 'task-view',
    selectedProjectId: 'codex-keypad',
  });

  assert.equal(state.view.tiles[1]?.status, 'unavailable');
  assert.equal(
    state.view.tiles[1]?.label,
    'Implement the liv… · State unavailable',
  );
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

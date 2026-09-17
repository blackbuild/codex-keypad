import { createHash } from 'node:crypto';

import type { CodexTask, CodexTaskStatus } from '../codex/codex-task-source.ts';

export interface CodexProjectIdentity {
  readonly id: string;
  readonly name: string;
  readonly icon?: {
    readonly path: string;
    readonly modifiedAt: number | 'unavailable';
  };
}

export interface CodexProjectState {
  readonly project: CodexProjectIdentity;
  readonly coordinatorTaskId?: string;
  readonly activeWorkerCount: ActiveWorkerCount;
  readonly tasks: readonly CodexTask[];
}

export type ActiveWorkerCount =
  | { readonly availability: 'available'; readonly count: number; readonly truncated: boolean }
  | { readonly availability: 'unavailable' };

export function exactActiveWorkerCount(count: number): ActiveWorkerCount {
  return availableActiveWorkerCount(count, false);
}

export function truncatedActiveWorkerCount(minimum: number): ActiveWorkerCount {
  return availableActiveWorkerCount(minimum, true);
}

export const unavailableActiveWorkerCount: ActiveWorkerCount = { availability: 'unavailable' };

function availableActiveWorkerCount(count: number, truncated: boolean): ActiveWorkerCount {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError('active-worker count must be a non-negative integer');
  }
  return { availability: 'available', count, truncated };
}

export type ControlSurfaceLevel = 'project-overview' | 'task-view';

export type SemanticAction =
  | { readonly type: 'open-project-overview' }
  | { readonly type: 'open-task-view'; readonly projectId: string }
  | { readonly type: 'open-codex-task'; readonly threadId: string };

export interface ControlSurfaceTile {
  readonly id: string;
  readonly label: string;
  readonly iconPath?: string;
  readonly status?: CodexTaskStatus;
  readonly role?: 'coordinator';
  readonly action: SemanticAction;
}

export interface CodexControlSurfaceState {
  readonly schemaVersion: 6;
  readonly revision: string;
  readonly entry: {
    readonly id: 'codex';
    readonly label: string;
    readonly action: { readonly type: 'open-project-overview' };
  };
  readonly view: {
    readonly level: ControlSurfaceLevel;
    readonly title: string;
    readonly tiles: readonly ControlSurfaceTile[];
  };
}

export interface ControlSurfaceLocation {
  readonly level?: ControlSurfaceLevel;
  readonly selectedProjectId?: string;
}

export function buildProjectControlSurface(
  projects: readonly CodexProjectState[],
  location: ControlSurfaceLocation = {},
): CodexControlSurfaceState {
  const selected = location.selectedProjectId
    ? projects.find(({ project }) => project.id === location.selectedProjectId)
    : undefined;
  const level: ControlSurfaceLevel = location.level === 'task-view' && selected
    ? 'task-view'
    : 'project-overview';

  const tiles = level === 'task-view'
    ? taskTiles(
        selected!.tasks,
        selected!.coordinatorTaskId,
        selected!.project.icon?.path,
      )
    : overviewTiles(projects);
  const entry = {
    id: 'codex' as const,
    label: `Codex · ${aggregateActiveWorkerSummary(projects)}`,
    action: { type: 'open-project-overview' as const },
  };
  const view = {
    level,
    title: level === 'project-overview' ? 'Projects' : selected!.project.name,
    tiles,
  };

  return {
    schemaVersion: 6,
    revision: createHash('sha256')
      .update(JSON.stringify({ entry, view, icons: projects.map(({ project }) => project.icon) }))
      .digest('hex')
      .slice(0, 24),
    entry,
    view,
  };
}

function overviewTiles(projects: readonly CodexProjectState[]): readonly ControlSurfaceTile[] {
  return projects.map(projectTile);
}

function projectTile(state: CodexProjectState): ControlSurfaceTile {
  return {
    id: `project:${state.project.id}`,
    label: compactLabel(
      `${state.project.name} · ${activeWorkerSummary(state.activeWorkerCount)}`,
      80,
    ),
    ...(state.project.icon ? { iconPath: state.project.icon.path } : {}),
    action: { type: 'open-task-view', projectId: state.project.id },
  };
}

function taskTiles(
  tasks: readonly CodexTask[],
  coordinatorTaskId?: string,
  projectIconPath?: string,
): readonly ControlSurfaceTile[] {
  const ordered = [...tasks].sort((left, right) =>
    right.updatedAt - left.updatedAt || compareDescending(left.id, right.id));
  const coordinator = coordinatorTaskId
    ? ordered.find((task) => task.id === coordinatorTaskId)
    : undefined;
  const remaining = coordinator
    ? ordered.filter((task) => task.id !== coordinator.id)
    : ordered;
  const back: ControlSurfaceTile = {
    id: 'nav.back',
    label: 'Back',
    action: { type: 'open-project-overview' },
  };
  return [
    ...(coordinator ? [taskTile(coordinator, true, projectIconPath), back] : [back]),
    ...remaining.map((task) => taskTile(task)),
  ];
}

function taskTile(
  task: CodexTask,
  coordinator = false,
  projectIconPath?: string,
): ControlSurfaceTile {
  const status = taskStatusLabel(task.status);
  const identity = compactLabel(task.title, 80 - status.length - 3);
  return {
    id: `task:${task.id}`,
    label: `${identity} · ${status}`,
    ...(projectIconPath ? { iconPath: projectIconPath } : {}),
    ...(coordinator ? { role: 'coordinator' as const } : {}),
    status: task.status,
    action: {
      type: 'open-codex-task',
      threadId: task.id,
    },
  };
}

function taskStatusLabel(status: CodexTaskStatus): string {
  switch (status) {
    case 'working': return 'Working';
    case 'waiting-for-approval': return 'Waiting for approval';
    case 'waiting-for-input': return 'Waiting for input';
    case 'completed': return 'Completed';
    case 'failed': return 'Failed';
    case 'interrupted': return 'Interrupted';
  }
}

function compareDescending(left: string, right: string): number {
  return left < right ? 1 : left > right ? -1 : 0;
}

function aggregateActiveWorkerSummary(projects: readonly CodexProjectState[]): string {
  let count = 0;
  let truncated = false;
  for (const project of projects) {
    if (project.activeWorkerCount.availability === 'unavailable') {
      return 'count unavailable';
    }
    count += project.activeWorkerCount.count;
    truncated ||= project.activeWorkerCount.truncated;
  }
  return count === 0
    ? 'idle'
    : `${count}${truncated ? '+' : ''} active`;
}

function activeWorkerSummary(count: ActiveWorkerCount): string {
  if (count.availability === 'unavailable') {
    return 'Count unavailable';
  }
  return count.count === 0
    ? 'Idle'
    : `${count.count}${count.truncated ? '+' : ''} active`;
}

function compactLabel(label: string, maximumLength: number): string {
  const normalized = label.replace(/\s+/g, ' ').trim();
  return normalized.length <= maximumLength
    ? normalized
    : `${normalized.slice(0, maximumLength - 1)}…`;
}

import { createHash } from 'node:crypto';

import type { CodexTask, CodexTaskStatus } from '../codex/codex-task-source.ts';
import {
  aggregateAttention,
  mergeAttentionIndicators,
  navigationVisual,
  summarizeAttentionStates,
  taskAttentionState,
  visualizeAttention,
  type AttentionIndicator,
  type AttentionState,
  type AttentionSummary,
  type VisualPresentation,
} from './attention.ts';

const MAXIMUM_TASK_TITLE_CUE_LENGTH = 18;

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
  readonly coordinatorTaskPattern?: string;
  readonly activeWorkerCount: ActiveWorkerCount;
  readonly tasks: readonly CodexTask[];
}

export type ActiveWorkerCount =
  | {
      readonly availability: 'available';
      readonly count: number;
      readonly truncated: boolean;
      readonly staleEvidence?: true;
      readonly unavailableEvidence?: true;
    }
  | { readonly availability: 'unavailable' }
  | { readonly availability: 'stale' };

export function exactActiveWorkerCount(count: number): ActiveWorkerCount {
  return availableActiveWorkerCount(count, false);
}

export function truncatedActiveWorkerCount(minimum: number): ActiveWorkerCount {
  return availableActiveWorkerCount(minimum, true);
}

export const unavailableActiveWorkerCount: ActiveWorkerCount = { availability: 'unavailable' };
export const staleActiveWorkerCount: ActiveWorkerCount = { availability: 'stale' };

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
  readonly attention?: AttentionSummary;
  readonly visual: VisualPresentation;
  readonly action: SemanticAction;
}

export interface CodexControlSurfaceState {
  readonly schemaVersion: 9;
  readonly revision: string;
  readonly entry: {
    readonly id: 'codex';
    readonly label: string;
    readonly attention: AttentionSummary;
    readonly visual: VisualPresentation;
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
        selected!.project.name,
        selected!.coordinatorTaskId,
        selected!.coordinatorTaskPattern,
        selected!.project.icon?.path,
        projectWorkerIndicators(selected!),
      )
    : overviewTiles(projects);
  const entryAttention = aggregateAttention(projects.flatMap(projectAttentionStates));
  const entryWorkerIndicators = mergeAttentionIndicators(
    projects.flatMap(projectWorkerIndicators),
  );
  const entry = {
    id: 'codex' as const,
    label: 'Codex',
    attention: entryAttention,
    visual: visualizeAttention(entryAttention, 'entry', entryWorkerIndicators),
    action: { type: 'open-project-overview' as const },
  };
  const view = {
    level,
    title: level === 'project-overview' ? 'Projects' : selected!.project.name,
    tiles,
  };

  return {
    schemaVersion: 9,
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
  const attention = aggregateAttention(projectAttentionStates(state));
  const visual = visualizeAttention(attention, 'project', projectWorkerIndicators(state));
  return {
    id: `project:${state.project.id}`,
    label: state.project.name,
    ...(state.project.icon ? { iconPath: state.project.icon.path } : {}),
    attention,
    visual,
    action: { type: 'open-task-view', projectId: state.project.id },
  };
}

function taskTiles(
  tasks: readonly CodexTask[],
  projectName: string,
  coordinatorTaskId?: string,
  coordinatorTaskPattern?: string,
  projectIconPath?: string,
  workerIndicators: readonly AttentionIndicator[] = [],
): readonly ControlSurfaceTile[] {
  const ordered = [...tasks].sort((left, right) =>
    right.updatedAt - left.updatedAt || compareDescending(left.id, right.id));
  const coordinator = (coordinatorTaskId
    ? ordered.find((task) => task.id === coordinatorTaskId)
    : undefined)
    ?? (coordinatorTaskPattern
      ? ordered.find((task) => wildcardMatches(task.title, coordinatorTaskPattern))
      : undefined);
  const remaining = coordinator
    ? ordered.filter((task) => task.id !== coordinator.id)
    : ordered;
  const back: ControlSurfaceTile = {
    id: 'nav.back',
    label: 'Up',
    visual: navigationVisual(),
    action: { type: 'open-project-overview' },
  };
  return [
    ...(coordinator
      ? [taskTile(coordinator, {
          label: projectName,
          role: 'coordinator',
          workerIndicators,
          ...(projectIconPath ? { iconPath: projectIconPath } : {}),
        }), back]
      : [back]),
    ...remaining.map((task) => taskTile(task)),
  ];
}

function wildcardMatches(value: string, pattern: string): boolean {
  const candidate = value.toLowerCase();
  const wildcard = pattern.toLowerCase();
  let candidateIndex = 0;
  let patternIndex = 0;
  let starIndex = -1;
  let retryCandidateIndex = 0;

  while (candidateIndex < candidate.length) {
    if (patternIndex < wildcard.length
      && (wildcard[patternIndex] === '?' || wildcard[patternIndex] === candidate[candidateIndex])) {
      candidateIndex += 1;
      patternIndex += 1;
    } else if (wildcard[patternIndex] === '*') {
      starIndex = patternIndex;
      retryCandidateIndex = candidateIndex;
      patternIndex += 1;
    } else if (starIndex >= 0) {
      patternIndex = starIndex + 1;
      retryCandidateIndex += 1;
      candidateIndex = retryCandidateIndex;
    } else {
      return false;
    }
  }

  while (wildcard[patternIndex] === '*') {
    patternIndex += 1;
  }
  return patternIndex === wildcard.length;
}

function taskTile(
  task: CodexTask,
  override?: {
    readonly label: string;
    readonly role: 'coordinator';
    readonly iconPath?: string;
    readonly workerIndicators: readonly AttentionIndicator[];
  },
): ControlSurfaceTile {
  const identity = compactLabel(task.title, MAXIMUM_TASK_TITLE_CUE_LENGTH);
  const attention = aggregateAttention([taskAttentionState(task.status)]);
  return {
    id: `task:${task.id}`,
    label: override?.label ?? identity,
    ...(override?.iconPath ? { iconPath: override.iconPath } : {}),
    ...(override ? { role: override.role } : {}),
    status: task.status,
    attention,
    visual: visualizeAttention(attention, 'task', override?.workerIndicators),
    action: {
      type: 'open-codex-task',
      threadId: task.id,
    },
  };
}

function projectAttentionStates(state: CodexProjectState): readonly AttentionState[] {
  const taskStates = state.tasks.map(({ status }) => taskAttentionState(status));
  switch (state.activeWorkerCount.availability) {
    case 'unavailable':
      return [...taskStates, 'unavailable'];
    case 'stale':
      return [...taskStates, 'stale'];
    case 'available': {
      const sourceStates: AttentionState[] = [];
      if (state.activeWorkerCount.unavailableEvidence) {
        sourceStates.push('unavailable');
      }
      if (state.activeWorkerCount.staleEvidence) {
        sourceStates.push('stale');
      }
      if (state.activeWorkerCount.count > 0 && !taskStates.includes('working')) {
        sourceStates.push('working');
      }
      return [...taskStates, ...sourceStates];
    }
  }
}

function projectWorkerIndicators(state: CodexProjectState): readonly AttentionIndicator[] {
  const ordered = [...state.tasks].sort((left, right) =>
    right.updatedAt - left.updatedAt || compareDescending(left.id, right.id));
  const coordinator = (state.coordinatorTaskId
    ? ordered.find((task) => task.id === state.coordinatorTaskId)
    : undefined)
    ?? (state.coordinatorTaskPattern
      ? ordered.find((task) => wildcardMatches(task.title, state.coordinatorTaskPattern!))
      : undefined);
  const workerTasks = coordinator
    ? ordered.filter((task) => task.id !== coordinator.id)
    : ordered;
  const observed = summarizeAttentionStates(
    workerTasks.map(({ status }) => taskAttentionState(status)),
  );
  const fallbackWorking = observed.length === 0
    && state.activeWorkerCount.availability === 'available'
    && state.activeWorkerCount.count > 0
    ? [{ state: 'working' as const, count: state.activeWorkerCount.count }]
    : [];
  return mergeAttentionIndicators([
    ...observed,
    ...fallbackWorking,
    ...(state.activeWorkerCount.availability === 'unavailable'
      || state.activeWorkerCount.availability === 'available'
        && state.activeWorkerCount.unavailableEvidence
      ? [{ state: 'unavailable' as const, count: 1 }]
      : []),
    ...(state.activeWorkerCount.availability === 'stale'
      || state.activeWorkerCount.availability === 'available'
        && state.activeWorkerCount.staleEvidence
      ? [{ state: 'stale' as const, count: 1 }]
      : []),
  ]);
}

function compareDescending(left: string, right: string): number {
  return left < right ? 1 : left > right ? -1 : 0;
}

function compactLabel(label: string, maximumLength: number): string {
  const normalized = label.replace(/\s+/g, ' ').trim();
  return normalized.length <= maximumLength
    ? normalized
    : `${normalized.slice(0, maximumLength - 1)}…`;
}

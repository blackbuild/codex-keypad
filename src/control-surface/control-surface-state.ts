import { createHash } from 'node:crypto';

import type { CodexTask, CodexTaskStatus } from '../codex/codex-task-source.ts';

const MAXIMUM_LCD_TILES = 9;

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
  readonly activeWorkerCount: ActiveWorkerCount;
  readonly task?: CodexTask;
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
  | { readonly type: 'open-project-page'; readonly page: number }
  | { readonly type: 'close-control-surface' }
  | { readonly type: 'open-task-view'; readonly projectId: string }
  | { readonly type: 'open-codex-task'; readonly threadId: string };

export interface ControlSurfaceTile {
  readonly id: string;
  readonly label: string;
  readonly iconPath?: string;
  readonly status?: CodexTaskStatus;
  readonly action: SemanticAction;
}

export interface CodexControlSurfaceState {
  readonly schemaVersion: 2;
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
  readonly projectPage?: number;
  readonly selectedProjectId?: string;
}

export function buildProjectControlSurface(
  projects: readonly CodexProjectState[],
  location: ControlSurfaceLocation = {},
): CodexControlSurfaceState {
  const pages = projectPages(projects);
  const requestedPage = location.projectPage ?? 0;
  const projectPage = Math.max(0, Math.min(requestedPage, pages.length - 1));
  const selected = location.selectedProjectId
    ? projects.find(({ project }) => project.id === location.selectedProjectId)
    : undefined;
  const level: ControlSurfaceLevel = location.level === 'task-view' && selected
    ? 'task-view'
    : 'project-overview';

  const tiles = level === 'task-view'
    ? taskTiles(selected!)
    : overviewTiles(pages, projectPage);
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
    schemaVersion: 2,
    revision: createHash('sha256')
      .update(JSON.stringify({ entry, view, icons: projects.map(({ project }) => project.icon) }))
      .digest('hex')
      .slice(0, 24),
    entry,
    view,
  };
}

export function projectPageCount(projectCount: number): number {
  if (!Number.isSafeInteger(projectCount) || projectCount < 0) {
    throw new RangeError('projectCount must be a non-negative integer');
  }
  return projectPageSizes(projectCount).length;
}

function projectPages(projects: readonly CodexProjectState[]): readonly (readonly CodexProjectState[])[] {
  let offset = 0;
  return projectPageSizes(projects.length).map((size) => {
    const page = projects.slice(offset, offset + size);
    offset += size;
    return page;
  });
}

function projectPageSizes(projectCount: number): readonly number[] {
  if (projectCount <= MAXIMUM_LCD_TILES - 1) {
    return [projectCount];
  }

  const sizes = [MAXIMUM_LCD_TILES - 2];
  let remaining = projectCount - sizes[0]!;
  while (remaining > 0) {
    const size = remaining <= MAXIMUM_LCD_TILES - 2
      ? remaining
      : MAXIMUM_LCD_TILES - 3;
    sizes.push(size);
    remaining -= size;
  }
  return sizes;
}

function overviewTiles(
  pages: readonly (readonly CodexProjectState[])[],
  page: number,
): readonly ControlSurfaceTile[] {
  return [
    { id: 'nav.back', label: 'Back', action: { type: 'close-control-surface' } },
    ...(page > 0
      ? [{
          id: 'page.previous',
          label: `Previous · ${page}/${pages.length}`,
          action: { type: 'open-project-page' as const, page: page - 1 },
        }]
      : []),
    ...pages[page]!.map(projectTile),
    ...(page < pages.length - 1
      ? [{
          id: 'page.next',
          label: `Next · ${page + 2}/${pages.length}`,
          action: { type: 'open-project-page' as const, page: page + 1 },
        }]
      : []),
  ];
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

function taskTiles(selected: CodexProjectState): readonly ControlSurfaceTile[] {
  return [
    {
      id: 'nav.back',
      label: 'Back',
      action: { type: 'open-project-overview' },
    },
    ...(selected.task
      ? [{
          id: `task:${selected.task.id}`,
          label: compactLabel(selected.task.title, 40),
          status: selected.task.status,
          action: {
            type: 'open-codex-task' as const,
            threadId: selected.task.id,
          },
        }]
      : []),
  ];
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

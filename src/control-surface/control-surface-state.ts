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
  readonly activeWorkerCount: number | '100+' | undefined;
  readonly task?: CodexTask;
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
  if (projectCount <= MAXIMUM_LCD_TILES - 1) {
    return 1;
  }
  const afterFirstPage = projectCount - (MAXIMUM_LCD_TILES - 2);
  return afterFirstPage <= MAXIMUM_LCD_TILES - 2
    ? 2
    : 2 + Math.ceil(
        (afterFirstPage - (MAXIMUM_LCD_TILES - 2)) / (MAXIMUM_LCD_TILES - 3),
      );
}

export function buildSingleProjectControlSurface(
  project: CodexProjectIdentity,
  task: CodexTask | undefined,
  level: ControlSurfaceLevel = 'project-overview',
): CodexControlSurfaceState {
  return buildProjectControlSurface(
    [{ project, activeWorkerCount: task ? 1 : 0, ...(task ? { task } : {}) }],
    { level, ...(level === 'task-view' ? { selectedProjectId: project.id } : {}) },
  );
}

function projectPages(projects: readonly CodexProjectState[]): readonly (readonly CodexProjectState[])[] {
  if (projects.length <= MAXIMUM_LCD_TILES - 1) {
    return [projects];
  }

  const pages: CodexProjectState[][] = [projects.slice(0, MAXIMUM_LCD_TILES - 2)];
  let offset = MAXIMUM_LCD_TILES - 2;
  while (offset < projects.length) {
    const remaining = projects.length - offset;
    const size = remaining <= MAXIMUM_LCD_TILES - 2
      ? remaining
      : MAXIMUM_LCD_TILES - 3;
    pages.push(projects.slice(offset, offset + size));
    offset += size;
  }
  return pages;
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
  if (projects.some(({ activeWorkerCount }) => activeWorkerCount === undefined)) {
    return 'count unavailable';
  }
  if (projects.some(({ activeWorkerCount }) => activeWorkerCount === '100+')) {
    return '100+ active';
  }
  const count = projects.reduce((sum, project) => sum + (project.activeWorkerCount as number), 0);
  return count === 0 ? 'idle' : `${count} active`;
}

function activeWorkerSummary(count: CodexProjectState['activeWorkerCount']): string {
  if (count === undefined) {
    return 'Count unavailable';
  }
  if (count === '100+') {
    return '100+ active';
  }
  return count === 0 ? 'Idle' : `${count} active`;
}

function compactLabel(label: string, maximumLength: number): string {
  const normalized = label.replace(/\s+/g, ' ').trim();
  return normalized.length <= maximumLength
    ? normalized
    : `${normalized.slice(0, maximumLength - 1)}…`;
}

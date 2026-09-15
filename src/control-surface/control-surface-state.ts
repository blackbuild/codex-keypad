import type { CodexTask, CodexTaskStatus } from '../codex/codex-task-source.ts';

export interface CodexProjectIdentity {
  readonly id: string;
  readonly name: string;
}

export type ControlSurfaceLevel = 'project-overview' | 'task-view';

export type SemanticAction =
  | { readonly type: 'open-project-overview' }
  | { readonly type: 'close-control-surface' }
  | { readonly type: 'open-task-view'; readonly projectId: string }
  | { readonly type: 'open-codex-task'; readonly threadId: string };

export interface ControlSurfaceTile {
  readonly id: string;
  readonly label: string;
  readonly status?: CodexTaskStatus;
  readonly action: SemanticAction;
}

export interface CodexControlSurfaceState {
  readonly schemaVersion: 1;
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

export function buildSingleProjectControlSurface(
  project: CodexProjectIdentity,
  task: CodexTask | undefined,
  level: ControlSurfaceLevel = 'project-overview',
): CodexControlSurfaceState {
  const activeSummary = task ? '1 active' : 'Idle';
  const tiles: ControlSurfaceTile[] = level === 'project-overview'
    ? [
        {
          id: 'nav.back',
          label: 'Back',
          action: { type: 'close-control-surface' },
        },
        {
          id: `project:${project.id}`,
          label: `${project.name} · ${activeSummary}`,
          action: { type: 'open-task-view', projectId: project.id },
        },
      ]
    : [
        {
          id: 'nav.back',
          label: 'Back',
          action: { type: 'open-project-overview' },
        },
        ...(task
          ? [{
              id: `task:${task.id}`,
              label: compactLabel(task.title),
              status: task.status,
              action: {
                type: 'open-codex-task' as const,
                threadId: task.id,
              },
            }]
          : []),
      ];

  return {
    schemaVersion: 1,
    revision: `${level}:${task ? `${task.id}:${task.updatedAt}` : 'idle'}`,
    entry: {
      id: 'codex',
      label: task ? 'Codex · 1 active' : 'Codex · idle',
      action: { type: 'open-project-overview' },
    },
    view: {
      level,
      title: level === 'project-overview' ? 'Projects' : project.name,
      tiles,
    },
  };
}

function compactLabel(label: string): string {
  const normalized = label.replace(/\s+/g, ' ').trim();
  return normalized.length <= 42 ? normalized : `${normalized.slice(0, 39)}…`;
}

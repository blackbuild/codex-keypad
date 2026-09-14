import type { CodexTask, CodexTaskStatus } from '../codex/codex-task-source.ts';

export interface CodexProjectIdentity {
  readonly id: string;
  readonly name: string;
}

export interface OpenProjectOverviewAction {
  readonly type: 'open-project-overview';
}

export interface OpenTaskViewAction {
  readonly type: 'open-task-view';
  readonly projectId: string;
}

export interface OpenCodexTaskAction {
  readonly type: 'open-codex-task';
  readonly threadId: string;
}

export interface CodexControlSurfaceTask {
  readonly id: string;
  readonly label: string;
  readonly status: CodexTaskStatus;
  readonly action: OpenCodexTaskAction;
}

export interface CodexControlSurfaceProject {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly action: OpenTaskViewAction;
  readonly tasks: readonly CodexControlSurfaceTask[];
}

export interface CodexControlSurfaceState {
  readonly schemaVersion: 1;
  readonly revision: string;
  readonly entry: {
    readonly id: 'codex';
    readonly label: string;
    readonly action: OpenProjectOverviewAction;
  };
  readonly projects: readonly CodexControlSurfaceProject[];
}

export function buildSingleProjectControlSurface(
  project: CodexProjectIdentity,
  task: CodexTask | undefined,
): CodexControlSurfaceState {
  const tasks = task
    ? [{
        id: task.id,
        label: compactLabel(task.title),
        status: task.status,
        action: {
          type: 'open-codex-task' as const,
          threadId: task.id,
        },
      }]
    : [];
  const activeSummary = task ? '1 active' : 'Idle';

  return {
    schemaVersion: 1,
    revision: task ? `${task.id}:${task.updatedAt}` : 'idle',
    entry: {
      id: 'codex',
      label: task ? 'Codex · 1 active' : 'Codex · idle',
      action: { type: 'open-project-overview' },
    },
    projects: [{
      id: project.id,
      label: project.name,
      summary: activeSummary,
      action: {
        type: 'open-task-view',
        projectId: project.id,
      },
      tasks,
    }],
  };
}

function compactLabel(label: string): string {
  const normalized = label.replace(/\s+/g, ' ').trim();
  return normalized.length <= 42 ? normalized : `${normalized.slice(0, 39)}…`;
}

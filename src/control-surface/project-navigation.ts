import type {
  CodexControlSurfaceState,
  CodexProjectState,
  ControlSurfaceLevel,
  SemanticAction,
} from './control-surface-state.ts';
import { buildProjectControlSurface } from './control-surface-state.ts';

export type OpenThread = (threadId: string) => Promise<void>;

export class ProjectNavigation {
  private readonly openThread: OpenThread;
  private level: ControlSurfaceLevel = 'project-overview';
  private selectedProjectId: string | undefined;

  constructor(openThread: OpenThread) {
    this.openThread = openThread;
  }

  snapshot(projects: readonly CodexProjectState[]): CodexControlSurfaceState {
    if (this.selectedProjectId
      && !projects.some(({ project }) => project.id === this.selectedProjectId)) {
      this.level = 'project-overview';
      this.selectedProjectId = undefined;
    }
    return buildProjectControlSurface(projects, {
      level: this.level,
      ...(this.selectedProjectId ? { selectedProjectId: this.selectedProjectId } : {}),
    });
  }

  async perform(
    action: SemanticAction,
    projects: readonly CodexProjectState[],
  ): Promise<boolean> {
    switch (action.type) {
      case 'open-project-overview':
        this.level = 'project-overview';
        return true;
      case 'open-task-view':
        if (!projects.some(({ project }) => project.id === action.projectId)) {
          return false;
        }
        this.level = 'task-view';
        this.selectedProjectId = action.projectId;
        return true;
      case 'open-codex-task': {
        const selected = projects.find(({ project }) => project.id === this.selectedProjectId);
        const task = selected?.tasks.find(({ id }) => id === action.threadId);
        if (!task) {
          return false;
        }
        await this.openThread(task.id);
        return true;
      }
    }
  }
}

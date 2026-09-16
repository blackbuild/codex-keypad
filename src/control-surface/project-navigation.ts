import type {
  CodexControlSurfaceState,
  CodexProjectState,
  ControlSurfaceLevel,
  SemanticAction,
} from './control-surface-state.ts';
import { buildProjectControlSurface, projectPageCount } from './control-surface-state.ts';

export type OpenThread = (threadId: string) => Promise<void>;

export class ProjectNavigation {
  private readonly openThread: OpenThread;
  private level: ControlSurfaceLevel = 'project-overview';
  private projectPage = 0;
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
    this.projectPage = Math.min(this.projectPage, projectPageCount(projects.length) - 1);
    return buildProjectControlSurface(projects, {
      level: this.level,
      projectPage: this.projectPage,
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
      case 'open-project-page':
        if (action.page < 0 || action.page >= projectPageCount(projects.length)) {
          return false;
        }
        this.level = 'project-overview';
        this.projectPage = action.page;
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
        if (!selected?.task || action.threadId !== selected.task.id) {
          return false;
        }
        await this.openThread(selected.task.id);
        return true;
      }
      case 'close-control-surface':
        return false;
    }
  }
}

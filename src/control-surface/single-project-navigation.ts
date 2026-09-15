import type { CodexTask } from '../codex/codex-task-source.ts';
import type {
  CodexControlSurfaceState,
  CodexProjectIdentity,
  ControlSurfaceLevel,
  SemanticAction,
} from './control-surface-state.ts';
import { buildSingleProjectControlSurface } from './control-surface-state.ts';

export type OpenThread = (threadId: string) => Promise<void>;

export class SingleProjectNavigation {
  private readonly project: CodexProjectIdentity;
  private readonly openThread: OpenThread;
  private level: ControlSurfaceLevel = 'project-overview';

  constructor(project: CodexProjectIdentity, openThread: OpenThread) {
    this.project = project;
    this.openThread = openThread;
  }

  snapshot(task: CodexTask | undefined): CodexControlSurfaceState {
    return buildSingleProjectControlSurface(this.project, task, this.level);
  }

  async perform(action: SemanticAction, task: CodexTask | undefined): Promise<boolean> {
    switch (action.type) {
      case 'open-project-overview':
        this.level = 'project-overview';
        return true;
      case 'open-task-view':
        if (action.projectId !== this.project.id) {
          return false;
        }
        this.level = 'task-view';
        return true;
      case 'open-codex-task':
        if (!task || action.threadId !== task.id) {
          return false;
        }
        await this.openThread(task.id);
        return true;
      case 'close-control-surface':
        return false;
    }
  }
}

import type { CodexTaskSource } from '../codex/codex-task-source.ts';
import type { ControlSurfaceStatePublisher } from './control-surface-state-publisher.ts';
import {
  buildSingleProjectControlSurface,
  type CodexProjectIdentity,
} from './control-surface-state.ts';

export async function refreshSingleProjectControlSurface(
  taskSource: CodexTaskSource,
  publisher: ControlSurfaceStatePublisher,
  project: CodexProjectIdentity,
): Promise<boolean> {
  const task = taskSource.listActiveTasks(1)[0];
  return publisher.publish(buildSingleProjectControlSurface(project, task));
}

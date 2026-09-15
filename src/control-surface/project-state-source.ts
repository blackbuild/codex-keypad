import { statSync } from 'node:fs';

import type { CodexTaskSource } from '../codex/codex-task-source.ts';
import type { CodexProjectConfiguration } from './project-configuration.ts';
import type { CodexProjectIdentity, CodexProjectState } from './control-surface-state.ts';

const MAXIMUM_EXACT_ACTIVE_WORKERS = 99;
const MAXIMUM_ICON_BYTES = 1024 * 1024;

export type ProjectTaskSourceFactory = (projectRoot: string) => CodexTaskSource;
export type ReadIconMetadata = (path: string) => {
  readonly isFile: boolean;
  readonly size: number;
  readonly modifiedAt: number;
};

export function readProjectStates(
  projects: readonly CodexProjectConfiguration[],
  createTaskSource: ProjectTaskSourceFactory,
  readIconMetadata: ReadIconMetadata = defaultIconMetadata,
): readonly CodexProjectState[] {
  return projects.map((configuration) => {
    const project: CodexProjectIdentity = {
      id: configuration.id,
      name: configuration.name,
      ...(configuration.icon
        ? { icon: readIcon(configuration.icon, readIconMetadata) }
        : {}),
    };

    try {
      const tasks = createTaskSource(configuration.root)
        .listActiveTasks(MAXIMUM_EXACT_ACTIVE_WORKERS + 1);
      return {
        project,
        activeWorkerCount: tasks.length > MAXIMUM_EXACT_ACTIVE_WORKERS
          ? '100+' as const
          : tasks.length,
        ...(tasks[0] ? { task: tasks[0] } : {}),
      };
    } catch {
      return { project, activeWorkerCount: undefined };
    }
  });
}

function readIcon(path: string, readMetadata: ReadIconMetadata): NonNullable<CodexProjectIdentity['icon']> {
  try {
    const metadata = readMetadata(path);
    if (!metadata.isFile || metadata.size > MAXIMUM_ICON_BYTES) {
      return { path, modifiedAt: 'unavailable' };
    }
    return { path, modifiedAt: metadata.modifiedAt };
  } catch {
    return { path, modifiedAt: 'unavailable' };
  }
}

function defaultIconMetadata(path: string): ReturnType<ReadIconMetadata> {
  const metadata = statSync(path);
  return {
    isFile: metadata.isFile(),
    size: metadata.size,
    modifiedAt: metadata.mtimeMs,
  };
}

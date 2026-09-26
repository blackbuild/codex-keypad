import { statSync } from 'node:fs';

import type { CodexTaskSource } from '../codex/codex-task-source.ts';
import type { CodexProjectConfiguration } from './project-configuration.ts';
import {
  exactActiveWorkerCount,
  staleActiveWorkerCount,
  truncatedActiveWorkerCount,
  unavailableActiveWorkerCount,
  type CodexProjectIdentity,
  type CodexProjectState,
  type ReviewAttention,
} from './control-surface-state.ts';

const MAXIMUM_EXACT_ACTIVE_WORKERS = 99;
const MAXIMUM_INCLUDED_TASKS = 256;
const MAXIMUM_ICON_BYTES = 1024 * 1024;
const MAXIMUM_ACTIVE_STATE_AGE_MS = 24 * 60 * 60 * 1000;
const MAXIMUM_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type ProjectTaskSourceFactory = (projectRoots: readonly string[]) => CodexTaskSource;
export type ReadIconMetadata = (path: string) => {
  readonly isFile: boolean;
  readonly size: number;
  readonly modifiedAt: number;
};
export type IsProjectDirectory = (path: string) => boolean;
export type ReviewAttentionSource = { read(repository: string): Promise<ReviewAttention> };
export interface ProjectStateReadOptions {
  readonly readIconMetadata?: ReadIconMetadata;
  readonly isProjectDirectory?: IsProjectDirectory;
  readonly now?: () => number;
  readonly reviewSource?: ReviewAttentionSource;
}

export function readProjectStates(
  projects: readonly CodexProjectConfiguration[],
  createTaskSource: ProjectTaskSourceFactory,
  options: ProjectStateReadOptions = {},
): Promise<readonly CodexProjectState[]> {
  const readIconMetadata = options.readIconMetadata ?? defaultIconMetadata;
  const isProjectDirectory = options.isProjectDirectory ?? defaultIsProjectDirectory;
  const now = options.now ?? Date.now;
  return Promise.all(projects.map(async (configuration) => {
    const project: CodexProjectIdentity = {
      id: configuration.id,
      name: configuration.name,
      ...(configuration.icon
        ? { icon: readIcon(configuration.icon, readIconMetadata) }
        : {}),
    };
    const coordinator = configuration.coordinatorTaskId
      ? { coordinatorTaskId: configuration.coordinatorTaskId }
      : {};
    const coordinatorPattern = configuration.coordinatorTaskPattern
      ? { coordinatorTaskPattern: configuration.coordinatorTaskPattern }
      : {};

    try {
      let reviewAttention: ReviewAttention | undefined;
      if (configuration.reviewRepository && options.reviewSource) {
        try {
          reviewAttention = await options.reviewSource.read(configuration.reviewRepository);
        } catch {
          reviewAttention = { availability: 'unavailable' };
        }
      }
      if (!isProjectDirectory(configuration.root)) {
        return {
          project,
          ...coordinator,
          ...coordinatorPattern,
          activeWorkerCount: unavailableActiveWorkerCount,
          tasks: [],
          ...(reviewAttention ? { reviewAttention } : {}),
        };
      }
      const source = createTaskSource([
        configuration.root,
        ...(configuration.repositories ?? []),
      ]);
      const tasks = source.listTasks(MAXIMUM_INCLUDED_TASKS);
      const workers = source.listActiveWorkerTasks(MAXIMUM_EXACT_ACTIVE_WORKERS + 1);
      const observedAt = now();
      const currentWorkers = workers.filter((task) => task.updatedAt >= observedAt - MAXIMUM_ACTIVE_STATE_AGE_MS
        && task.updatedAt <= observedAt + MAXIMUM_FUTURE_CLOCK_SKEW_MS);
      const staleWorkers = workers.filter((task) =>
        task.updatedAt < observedAt - MAXIMUM_ACTIVE_STATE_AGE_MS);
      const futureWorkers = workers.filter((task) =>
        task.updatedAt > observedAt + MAXIMUM_FUTURE_CLOCK_SKEW_MS);
      const hasUnusableEvidence = currentWorkers.length !== workers.length;
      if (currentWorkers.length === 0 && hasUnusableEvidence) {
        return {
          project,
          ...coordinator,
          ...coordinatorPattern,
          activeWorkerCount: staleWorkers.length > 0 && futureWorkers.length === 0
            ? staleActiveWorkerCount
            : unavailableActiveWorkerCount,
          tasks,
          ...(reviewAttention ? { reviewAttention } : {}),
        };
      }
      const activeWorkerCount = hasUnusableEvidence || workers.length > MAXIMUM_EXACT_ACTIVE_WORKERS
        ? truncatedActiveWorkerCount(currentWorkers.length)
        : exactActiveWorkerCount(currentWorkers.length);
      return {
        project,
        ...coordinator,
        ...coordinatorPattern,
        activeWorkerCount: {
          ...activeWorkerCount,
          ...(staleWorkers.length > 0 ? { staleEvidence: true as const } : {}),
          ...(futureWorkers.length > 0 ? { unavailableEvidence: true as const } : {}),
        },
        tasks,
        ...(reviewAttention ? { reviewAttention } : {}),
      };
    } catch {
      return {
        project,
        ...coordinator,
        ...coordinatorPattern,
        activeWorkerCount: unavailableActiveWorkerCount,
        tasks: [],
        ...(configuration.reviewRepository ? { reviewAttention: { availability: 'unavailable' as const } } : {}),
      };
    }
  }));
}

function defaultIsProjectDirectory(path: string): boolean {
  return statSync(path).isDirectory();
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

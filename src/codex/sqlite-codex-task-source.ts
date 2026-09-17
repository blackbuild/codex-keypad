import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire as createNodeRequire } from 'node:module';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import type { DatabaseSync as NodeDatabaseSync } from 'node:sqlite';

import type { CodexTask, CodexTaskSource, CodexTaskStatus } from './codex-task-source.ts';
import {
  isCodexDesktopWorkerSession,
  isTopLevelCodexDesktopSession,
} from './session-meta.ts';

const MAXIMUM_GIT_POINTER_BYTES = 4096;
const MAXIMUM_LINKED_WORKTREES = 256;
type TaskQuery = 'included-tasks' | 'active-workers';

// esbuild strips the `node:` prefix from this newer built-in when bundling it as
// an external import. Resolve it at runtime so the packaged sidecar keeps the
// unambiguous built-in specifier.
const { DatabaseSync } = createNodeRequire(import.meta.url)(
  ['node', 'sqlite'].join(':'),
) as { readonly DatabaseSync: typeof NodeDatabaseSync };

interface ThreadRow {
  readonly id: string;
  readonly name: string | null;
  readonly rollout_path: string;
  readonly recency_at_ms: number;
}

export interface SqliteCodexTaskSourceOptions {
  readonly stateDatabase: string;
  readonly historyDatabase: string;
  readonly workingDirectories?: readonly string[];
}

export class SqliteCodexTaskSource implements CodexTaskSource {
  private readonly options: SqliteCodexTaskSourceOptions;

  constructor(options: SqliteCodexTaskSourceOptions) {
    this.options = options;
  }

  listTasks(limit: number): CodexTask[] {
    return this.listMatchingTasks(limit, isTopLevelCodexDesktopSession, 'included-tasks');
  }

  listActiveWorkerTasks(limit: number): CodexTask[] {
    return this.listMatchingTasks(limit, isCodexDesktopWorkerSession, 'active-workers');
  }

  private listMatchingTasks(
    limit: number,
    matchesSession: (rolloutPath: string, threadId: string) => boolean,
    query: TaskQuery,
  ): CodexTask[] {
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new RangeError('limit must be a non-negative integer');
    }
    if (limit === 0) {
      return [];
    }

    const statuses = this.readThreadStatuses();
    if (statuses.size === 0) {
      return [];
    }

    const database = new DatabaseSync(this.options.stateDatabase, { readOnly: true });
    try {
      const workingDirectories = [...new Set(
        (this.options.workingDirectories ?? []).flatMap(projectWorkingDirectories),
      )];
      const workingDirectoryFilter = workingDirectories.length > 0
        ? `AND cwd IN (${workingDirectories.map(() => '?').join(', ')})`
        : '';
      const rows = database.prepare(`
        SELECT id, name, rollout_path, recency_at_ms
        FROM threads
        WHERE archived = 0 AND source = 'vscode' ${workingDirectoryFilter}
        ORDER BY recency_at_ms DESC, id DESC
      `).all(
        ...workingDirectories,
      ) as unknown as ThreadRow[];

      return rows
        .filter((row) => statuses.has(row.id))
        .filter((row) => query === 'included-tasks' || statuses.get(row.id) === 'working')
        .filter((row) => matchesSession(row.rollout_path, row.id))
        .slice(0, limit)
        .map((row) => ({
          id: row.id,
          title: taskTitle(row.name, row.id),
          status: statuses.get(row.id)!,
          updatedAt: row.recency_at_ms,
        }));
    } finally {
      database.close();
    }
  }

  private readThreadStatuses(): ReadonlyMap<string, CodexTaskStatus> {
    const database = new DatabaseSync(this.options.historyDatabase, { readOnly: true });
    try {
      const rows = database.prepare(`
        SELECT thread_id, status
        FROM (
          SELECT
            thread_id,
            status,
            ROW_NUMBER() OVER (
              PARTITION BY thread_id
              ORDER BY rollout_ordinal DESC, turn_id DESC
            ) AS newest
          FROM thread_turns
        )
        WHERE newest = 1
      `).all() as unknown as Array<{ readonly thread_id: string; readonly status: string }>;
      return new Map(rows.map((row) =>
        [row.thread_id, normalizedStatus(row.status)] as const));
    } finally {
      database.close();
    }
  }
}

function normalizedStatus(status: string): CodexTaskStatus {
  switch (status) {
    case 'inProgress': return 'working';
    case 'completed': return 'completed';
    case 'failed': return 'failed';
    case 'interrupted': return 'interrupted';
    default: return 'unavailable';
  }
}

function projectWorkingDirectories(configuredRoot: string): readonly string[] {
  const directories = new Set([configuredRoot]);
  const commonDirectory = gitCommonDirectory(configuredRoot);
  if (!commonDirectory) {
    return [...directories];
  }

  if (basename(commonDirectory) === '.git') {
    directories.add(dirname(commonDirectory));
  }

  try {
    const worktreesDirectory = join(commonDirectory, 'worktrees');
    const entries = readdirSync(worktreesDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, MAXIMUM_LINKED_WORKTREES);
    for (const entry of entries) {
      try {
        const gitPointer = readBoundedText(join(worktreesDirectory, entry.name, 'gitdir')).trim();
        if (!isAbsolute(gitPointer) || basename(gitPointer) !== '.git') {
          continue;
        }
        const worktree = dirname(gitPointer);
        if (statSync(worktree).isDirectory()) {
          directories.add(worktree);
        }
      } catch {
        // Ignore stale or unreadable worktree entries without hiding valid siblings.
      }
    }
  } catch {
    // A project without readable linked-worktree metadata still matches its configured root.
  }
  return [...directories];
}

function gitCommonDirectory(workingDirectory: string): string | undefined {
  const marker = join(workingDirectory, '.git');
  try {
    if (statSync(marker).isDirectory()) {
      return marker;
    }

    const pointer = readBoundedText(marker).trim();
    if (!pointer.startsWith('gitdir:')) {
      return undefined;
    }
    const gitDirectoryValue = pointer.slice('gitdir:'.length).trim();
    const gitDirectory = isAbsolute(gitDirectoryValue)
      ? gitDirectoryValue
      : resolve(workingDirectory, gitDirectoryValue);
    try {
      const commonDirectoryValue = readBoundedText(join(gitDirectory, 'commondir')).trim();
      return resolve(gitDirectory, commonDirectoryValue);
    } catch {
      return gitDirectory;
    }
  } catch {
    return undefined;
  }
}

function readBoundedText(path: string): string {
  const metadata = statSync(path);
  if (!metadata.isFile() || metadata.size > MAXIMUM_GIT_POINTER_BYTES) {
    throw new Error(`Git metadata pointer is not a bounded file: ${path}`);
  }
  return readFileSync(path, 'utf8');
}

export function createDefaultCodexTaskSource(
  environment: NodeJS.ProcessEnv = process.env,
  workingDirectories?: readonly string[],
): SqliteCodexTaskSource {
  const codexHome = environment.CODEX_HOME ?? join(homedir(), '.codex');
  const environmentRoot = environment.CODEX_KEYPAD_PROJECT_ROOT;
  const configuredWorkingDirectories = workingDirectories
    ?? (environmentRoot ? [environmentRoot] : []);
  return new SqliteCodexTaskSource({
    stateDatabase: environment.CODEX_STATE_DB
      ?? findLatestVersionedDatabase(codexHome, 'state'),
    historyDatabase: environment.CODEX_THREAD_HISTORY_DB
      ?? findLatestVersionedDatabase(codexHome, 'thread_history'),
    ...(configuredWorkingDirectories.length > 0
      ? { workingDirectories: configuredWorkingDirectories }
      : {}),
  });
}

function findLatestVersionedDatabase(directory: string, stem: string): string {
  const expression = new RegExp(String.raw`^${stem}_(\d+)\.sqlite$`);
  const match = readdirSync(directory)
    .map((fileName) => ({ fileName, version: expression.exec(fileName)?.[1] }))
    .filter((entry): entry is { fileName: string; version: string } => entry.version !== undefined)
    .sort((left, right) => Number(right.version) - Number(left.version))[0];

  if (!match) {
    throw new Error(`No ${stem}_*.sqlite database found in ${directory}`);
  }
  return join(directory, match.fileName);
}

function taskTitle(name: string | null, threadId: string): string {
  const candidate = name?.trim();
  return candidate
    ? candidate.replace(/\s+/g, ' ')
    : `Task · ${threadId.length <= 16 ? threadId : threadId.slice(0, 8)}`;
}

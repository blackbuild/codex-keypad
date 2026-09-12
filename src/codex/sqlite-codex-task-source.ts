import { readdirSync } from 'node:fs';
import { createRequire as createNodeRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync as NodeDatabaseSync } from 'node:sqlite';

import type { CodexTask, CodexTaskSource } from './codex-task-source.ts';
import { isTopLevelCodexDesktopSession } from './session-meta.ts';

// Logitech's ESM build shim currently strips the `node:` prefix from static
// imports that it does not recognize. Resolve this newer built-in at runtime so
// it remains `node:sqlite` inside the packaged plugin.
const { DatabaseSync } = createNodeRequire(import.meta.url)(
  ['node', 'sqlite'].join(':'),
) as { readonly DatabaseSync: typeof NodeDatabaseSync };

interface ThreadRow {
  readonly id: string;
  readonly name: string | null;
  readonly title: string;
  readonly rollout_path: string;
  readonly recency_at_ms: number;
}

export interface SqliteCodexTaskSourceOptions {
  readonly stateDatabase: string;
  readonly historyDatabase: string;
}

export class SqliteCodexTaskSource implements CodexTaskSource {
  private readonly options: SqliteCodexTaskSourceOptions;

  constructor(options: SqliteCodexTaskSourceOptions) {
    this.options = options;
  }

  listActiveTasks(limit: number): CodexTask[] {
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new RangeError('limit must be a non-negative integer');
    }
    if (limit === 0) {
      return [];
    }

    const activeThreadIds = this.readActiveThreadIds();
    if (activeThreadIds.size === 0) {
      return [];
    }

    const database = new DatabaseSync(this.options.stateDatabase, { readOnly: true });
    try {
      const rows = database.prepare(`
        SELECT id, name, title, rollout_path, recency_at_ms
        FROM threads
        WHERE archived = 0 AND source = 'vscode'
        ORDER BY recency_at_ms DESC, id DESC
      `).all() as unknown as ThreadRow[];

      return rows
        .filter((row) => activeThreadIds.has(row.id))
        .filter((row) => isTopLevelCodexDesktopSession(row.rollout_path, row.id))
        .slice(0, limit)
        .map((row) => ({
          id: row.id,
          title: taskTitle(row.name, row.title),
          status: 'working',
          updatedAt: row.recency_at_ms,
        }));
    } finally {
      database.close();
    }
  }

  private readActiveThreadIds(): Set<string> {
    const database = new DatabaseSync(this.options.historyDatabase, { readOnly: true });
    try {
      const rows = database.prepare(`
        SELECT thread_id
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
        WHERE newest = 1 AND status = 'inProgress'
      `).all() as unknown as Array<{ readonly thread_id: string }>;
      return new Set(rows.map((row) => row.thread_id));
    } finally {
      database.close();
    }
  }
}

export function createDefaultCodexTaskSource(
  environment: NodeJS.ProcessEnv = process.env,
): SqliteCodexTaskSource {
  const codexHome = environment.CODEX_HOME ?? join(homedir(), '.codex');
  return new SqliteCodexTaskSource({
    stateDatabase: environment.CODEX_STATE_DB
      ?? findLatestVersionedDatabase(codexHome, 'state'),
    historyDatabase: environment.CODEX_THREAD_HISTORY_DB
      ?? findLatestVersionedDatabase(codexHome, 'thread_history'),
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

function taskTitle(name: string | null, fallback: string): string {
  const candidate = name?.trim() || fallback.split(/\r?\n/, 1)[0]?.trim() || 'Untitled task';
  return candidate.replace(/^#+\s*/, '').replace(/\s+/g, ' ');
}

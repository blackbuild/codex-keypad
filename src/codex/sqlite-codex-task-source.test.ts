import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';

import { SqliteCodexTaskSource } from './sqlite-codex-task-source.ts';

let fixtureDirectory: string;
let source: SqliteCodexTaskSource;
let configuredRepositoryRoot: string;
let linkedWorktreeRoot: string;

before(async () => {
  fixtureDirectory = await mkdtemp(join(tmpdir(), 'logi-codex-adapter-'));
  mkdirSync(join(fixtureDirectory, 'rollouts'));
  configuredRepositoryRoot = join(fixtureDirectory, 'projects', 'engineering-baseline');
  linkedWorktreeRoot = join(fixtureDirectory, 'worktrees', '417d', 'engineering-baseline');
  createGitWorktreeFixture(configuredRepositoryRoot, linkedWorktreeRoot);
  const stateDatabase = join(fixtureDirectory, 'state.sqlite');
  const historyDatabase = join(fixtureDirectory, 'history.sqlite');

  createStateFixture(stateDatabase);
  createHistoryFixture(historyDatabase);
  source = new SqliteCodexTaskSource({ stateDatabase, historyDatabase });
});

after(async () => {
  await rm(fixtureDirectory, { recursive: true, force: true });
});

test('returns non-archived top-level Codex Desktop tasks with current normalized state', () => {
  assert.deepEqual(source.listTasks(9), [
    {
      id: 'finished',
      title: 'Finished',
      status: 'completed',
      updatedAt: 7000,
    },
    {
      id: 'failed-task',
      title: 'Failed task',
      status: 'failed',
      updatedAt: 6900,
    },
    {
      id: 'interrupted-task',
      title: 'Interrupted task',
      status: 'interrupted',
      updatedAt: 6800,
    },
    {
      id: 'desktop-new',
      title: 'Named current task',
      status: 'working',
      updatedAt: 4000,
    },
    {
      id: 'desktop-legacy',
      title: 'Task · desktop-legacy',
      status: 'working',
      updatedAt: 3000,
    },
    {
      id: 'worktree-worker',
      title: 'Worktree worker',
      status: 'working',
      updatedAt: 2950,
    },
    {
      id: 'desktop-created',
      title: 'Created worker',
      status: 'working',
      updatedAt: 2900,
    },
    {
      id: 'desktop-forked',
      title: 'Forked worker',
      status: 'working',
      updatedAt: 2800,
    },
    {
      id: 'desktop-automation',
      title: 'Automation',
      status: 'working',
      updatedAt: 2700,
    },
  ]);
});

test('applies the requested LCD slot limit', () => {
  assert.equal(source.listTasks(1).length, 1);
  assert.deepEqual(source.listTasks(0), []);
  assert.throws(() => source.listTasks(-1), RangeError);
});

test('does not expose a stored prompt when a task has no display name', () => {
  const unnamed = source.listTasks(9).find(({ id }) => id === 'desktop-legacy');

  assert.equal(unnamed?.title, 'Task · desktop-legacy');
  assert.equal(unnamed?.title.includes('Fallback heading'), false);
});

test('counts only agent-created, forked, or handed-off sessions as active workers', () => {
  assert.deepEqual(source.listActiveWorkerTasks(9).map(({ id }) => id), [
    'desktop-new',
    'worktree-worker',
    'desktop-created',
    'desktop-forked',
  ]);
});

test('can limit active tasks to one configured project root', () => {
  const projectSource = new SqliteCodexTaskSource({
    stateDatabase: join(fixtureDirectory, 'state.sqlite'),
    historyDatabase: join(fixtureDirectory, 'history.sqlite'),
    workingDirectory: '/projects/codex-keypad',
  });

  assert.deepEqual(
    projectSource.listTasks(9).map((task) => task.id),
    ['finished', 'desktop-new'],
  );
});

test('associates a Codex worktree worker with its configured Git project', () => {
  const projectSource = new SqliteCodexTaskSource({
    stateDatabase: join(fixtureDirectory, 'state.sqlite'),
    historyDatabase: join(fixtureDirectory, 'history.sqlite'),
    workingDirectory: configuredRepositoryRoot,
  });

  assert.deepEqual(
    projectSource.listActiveWorkerTasks(9).map((task) => task.id),
    ['worktree-worker'],
  );
});

function createStateFixture(databasePath: string): void {
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      name TEXT,
      title TEXT NOT NULL,
      rollout_path TEXT NOT NULL,
      cwd TEXT NOT NULL,
      recency_at_ms INTEGER NOT NULL,
      source TEXT NOT NULL,
      archived INTEGER NOT NULL
    )
  `);

  addThread(database, 'desktop-new', 'Named current task', 'ignored', 4000,
    'codex_work_desktop', 'chatgpt_handoff', '/projects/codex-keypad');
  addThread(database, 'desktop-legacy', null, '## Fallback heading\nmore', 3000,
    'Codex Desktop', 'user', '/projects/elsewhere');
  addThread(database, 'worktree-worker', 'Worktree worker', 'Worktree worker', 2950,
    'Codex Desktop', 'agent_created_thread', linkedWorktreeRoot);
  addThread(database, 'desktop-created', 'Created worker', 'Created worker', 2900,
    'Codex Desktop', 'agent_created_thread', '/projects/elsewhere');
  addThread(database, 'desktop-forked', 'Forked worker', 'Forked worker', 2800,
    'Codex Desktop', 'agent_forked_thread', '/projects/elsewhere');
  addThread(database, 'desktop-automation', 'Automation', 'Automation', 2700,
    'Codex Desktop', 'automation', '/projects/elsewhere');
  addThread(database, 'subagent', 'Child', 'Child', 5000,
    'Codex Desktop', 'subagent', '/projects/codex-keypad');
  addThread(database, 'other-app', 'IDE task', 'IDE task', 6000,
    'JetBrains.IntelliJ IDEA', 'user', '/projects/codex-keypad');
  addThread(database, 'finished', 'Finished', 'Finished', 7000,
    'Codex Desktop', 'user', '/projects/codex-keypad');
  addThread(database, 'failed-task', 'Failed task', 'Failed task', 6900,
    'Codex Desktop', 'user', '/projects/elsewhere');
  addThread(database, 'interrupted-task', 'Interrupted task', 'Interrupted task', 6800,
    'Codex Desktop', 'user', '/projects/elsewhere');
  database.close();
}

function addThread(
  database: DatabaseSync,
  id: string,
  name: string | null,
  title: string,
  recencyAt: number,
  originator: string,
  threadSource: string,
  workingDirectory: string,
): void {
  const rolloutPath = join(fixtureDirectory, 'rollouts', `${id}.jsonl`);
  writeFileSync(rolloutPath, `${JSON.stringify({
    type: 'session_meta',
    payload: {
      id,
      source: 'vscode',
      originator,
      thread_source: threadSource,
    },
  })}\n`);
  database.prepare(`
    INSERT INTO threads
      (id, name, title, rollout_path, cwd, recency_at_ms, source, archived)
    VALUES (?, ?, ?, ?, ?, ?, 'vscode', 0)
  `).run(id, name, title, rolloutPath, workingDirectory, recencyAt);
}

function createHistoryFixture(databasePath: string): void {
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE thread_turns (
      thread_id TEXT NOT NULL,
      turn_id TEXT NOT NULL,
      rollout_ordinal INTEGER NOT NULL,
      status TEXT NOT NULL
    )
  `);
  const insert = database.prepare('INSERT INTO thread_turns VALUES (?, ?, ?, ?)');
  insert.run('desktop-new', 'turn-1', 1, 'inProgress');
  insert.run('desktop-legacy', 'turn-1', 1, 'inProgress');
  insert.run('worktree-worker', 'turn-1', 1, 'inProgress');
  insert.run('desktop-created', 'turn-1', 1, 'inProgress');
  insert.run('desktop-forked', 'turn-1', 1, 'inProgress');
  insert.run('desktop-automation', 'turn-1', 1, 'inProgress');
  insert.run('subagent', 'turn-1', 1, 'inProgress');
  insert.run('other-app', 'turn-1', 1, 'inProgress');
  insert.run('finished', 'turn-1', 1, 'inProgress');
  insert.run('finished', 'turn-2', 2, 'completed');
  insert.run('failed-task', 'turn-1', 1, 'failed');
  insert.run('interrupted-task', 'turn-1', 1, 'interrupted');
  database.close();
}

function createGitWorktreeFixture(repositoryRoot: string, worktreeRoot: string): void {
  const worktreeMetadata = join(repositoryRoot, '.git', 'worktrees', 'engineering-baseline1');
  const staleWorktreeMetadata = join(repositoryRoot, '.git', 'worktrees', 'deleted-worktree');
  mkdirSync(worktreeMetadata, { recursive: true });
  mkdirSync(staleWorktreeMetadata, { recursive: true });
  mkdirSync(worktreeRoot, { recursive: true });
  writeFileSync(join(staleWorktreeMetadata, 'gitdir'), '/deleted/worktree/.git\n');
  writeFileSync(join(worktreeMetadata, 'gitdir'), `${join(worktreeRoot, '.git')}\n`);
  writeFileSync(
    join(worktreeRoot, '.git'),
    `gitdir: ${worktreeMetadata}\n`,
  );
}

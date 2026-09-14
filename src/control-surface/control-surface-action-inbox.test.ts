import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, mkdtemp, open, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { ControlSurfaceActionInbox, parseActionRequest } from './control-surface-action-inbox.ts';

const execFileAsync = promisify(execFile);

test('accepts one known semantic action request', () => {
  assert.deepEqual(parseActionRequest(JSON.stringify({
    schemaVersion: 1,
    requestId: 'request-1',
    action: { type: 'open-codex-task', threadId: 'thread-123' },
  })), { type: 'open-codex-task', threadId: 'thread-123' });
});

test('rejects executable commands and extra handoff fields', () => {
  assert.equal(parseActionRequest(JSON.stringify({
    schemaVersion: 1,
    requestId: 'request-1',
    action: { type: 'run-command', command: 'rm -rf /' },
  })), undefined);
  assert.equal(parseActionRequest(JSON.stringify({
    schemaVersion: 1,
    requestId: 'request-1',
    action: { type: 'open-codex-task', threadId: 'thread-123', command: 'surprise' },
  })), undefined);
});

test('preserves an action published while the preceding action is being consumed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'codex-keypad-action-inbox-'));
  const mailboxPath = join(directory, 'action.json');
  try {
    await execFileAsync('mkfifo', [mailboxPath]);
    const firstTake = new ControlSurfaceActionInbox(mailboxPath).take();
    const writer = await openMailboxWriter(directory);

    await writer.writeFile(actionRequest('request-a', 'project-a'));
    const nextPath = join(directory, 'next.json');
    await writeFile(nextPath, actionRequest('request-b', 'project-b'));
    await rename(nextPath, mailboxPath);
    await writer.close();

    assert.deepEqual(await firstTake, { type: 'open-task-view', projectId: 'project-a' });
    assert.deepEqual(
      await new ControlSurfaceActionInbox(mailboxPath).take(),
      { type: 'open-task-view', projectId: 'project-b' },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function actionRequest(requestId: string, projectId: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    requestId,
    action: { type: 'open-task-view', projectId },
  });
}

async function openMailboxWriter(directory: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    for (const entry of await readdir(directory)) {
      const path = join(directory, entry);
      if ((await lstat(path)).isFIFO()) {
        try {
          return await open(path, constants.O_WRONLY | constants.O_NONBLOCK);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENXIO') {
            throw error;
          }
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error('action inbox did not begin reading the mailbox');
}

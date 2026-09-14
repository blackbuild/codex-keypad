import assert from 'node:assert/strict';
import test from 'node:test';

import { parseActionRequest } from './control-surface-action-inbox.ts';

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

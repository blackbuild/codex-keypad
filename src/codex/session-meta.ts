import { closeSync, openSync, readSync } from 'node:fs';

const MAX_SESSION_META_BYTES = 256 * 1024;
const DESKTOP_ORIGINATORS = new Set(['Codex Desktop', 'codex_work_desktop']);
const USER_VISIBLE_THREAD_SOURCES = new Set([
  'agent_created_thread',
  'agent_forked_thread',
  'automation',
  'chatgpt_handoff',
  'user',
]);
const WORKER_THREAD_SOURCES = new Set([
  'agent_created_thread',
  'agent_forked_thread',
  'chatgpt_handoff',
]);

interface SessionMetaRecord {
  readonly type?: unknown;
  readonly payload?: {
    readonly id?: unknown;
    readonly session_id?: unknown;
    readonly source?: unknown;
    readonly originator?: unknown;
    readonly thread_source?: unknown;
  };
}

export function isTopLevelCodexDesktopSession(
  rolloutPath: string,
  expectedThreadId: string,
): boolean {
  return isMatchingSession(rolloutPath, expectedThreadId, USER_VISIBLE_THREAD_SOURCES);
}

export function isCodexDesktopWorkerSession(
  rolloutPath: string,
  expectedThreadId: string,
): boolean {
  return isMatchingSession(rolloutPath, expectedThreadId, WORKER_THREAD_SOURCES);
}

function isMatchingSession(
  rolloutPath: string,
  expectedThreadId: string,
  allowedThreadSources: ReadonlySet<string>,
): boolean {
  try {
    const record = JSON.parse(readBoundedFirstLine(rolloutPath)) as SessionMetaRecord;
    const payload = record.payload;
    const recordedId = payload?.id ?? payload?.session_id;

    return record.type === 'session_meta'
      && recordedId === expectedThreadId
      && payload?.source === 'vscode'
      && typeof payload.originator === 'string'
      && DESKTOP_ORIGINATORS.has(payload.originator)
      && typeof payload.thread_source === 'string'
      && allowedThreadSources.has(payload.thread_source);
  } catch {
    return false;
  }
}

function readBoundedFirstLine(filePath: string): string {
  const file = openSync(filePath, 'r');
  const buffer = Buffer.alloc(MAX_SESSION_META_BYTES);

  try {
    const bytesRead = readSync(file, buffer, 0, buffer.length, 0);
    const newline = buffer.subarray(0, bytesRead).indexOf(0x0a);
    if (newline === -1) {
      throw new Error('session metadata exceeds the bounded first-line read');
    }
    return buffer.toString('utf8', 0, newline);
  } finally {
    closeSync(file);
  }
}

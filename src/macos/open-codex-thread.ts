import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const CODEX_BUNDLE_IDENTIFIER = 'com.openai.codex';
const SAFE_THREAD_ID = /^[A-Za-z0-9_-]+$/;

export function codexThreadUrl(threadId: string): string {
  if (!SAFE_THREAD_ID.test(threadId)) {
    throw new Error('Thread ID is not safe for a Codex deep link');
  }
  return `codex://threads/${threadId}`;
}

export async function openCodexThread(threadId: string): Promise<void> {
  await execFileAsync('/usr/bin/open', [
    '-b',
    CODEX_BUNDLE_IDENTIFIER,
    codexThreadUrl(threadId),
  ]);
}

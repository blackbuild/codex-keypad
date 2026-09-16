import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink } from 'node:fs/promises';

import type { SemanticAction } from './control-surface-state.ts';

const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export class ControlSurfaceActionInbox {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  async take(): Promise<SemanticAction | undefined> {
    const claimedPath = `${this.path}.${process.pid}.${randomUUID()}.claimed`;
    try {
      await rename(this.path, claimedPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }

    try {
      return parseActionRequest(await readFile(claimedPath, 'utf8'));
    } finally {
      await unlink(claimedPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      });
    }
  }
}

export function parseActionRequest(json: string): SemanticAction | undefined {
  try {
    const value = JSON.parse(json) as unknown;
    if (!isRecord(value)
      || !hasExactKeys(value, ['action', 'requestId', 'schemaVersion'])
      || value.schemaVersion !== 1
      || typeof value.requestId !== 'string'
      || !SAFE_IDENTIFIER.test(value.requestId)
      || !isRecord(value.action)
      || typeof value.action.type !== 'string') {
      return undefined;
    }

    switch (value.action.type) {
      case 'open-project-overview':
        return hasExactKeys(value.action, ['type']) ? { type: value.action.type } : undefined;
      case 'open-project-page':
      case 'open-task-page':
        return hasExactKeys(value.action, ['page', 'type'])
          && typeof value.action.page === 'number'
          && Number.isSafeInteger(value.action.page)
          && value.action.page >= 0
          && value.action.page <= 63
          ? { type: value.action.type, page: value.action.page }
          : undefined;
      case 'open-task-view':
        return hasExactKeys(value.action, ['projectId', 'type'])
          && typeof value.action.projectId === 'string'
          && SAFE_IDENTIFIER.test(value.action.projectId)
          ? { type: value.action.type, projectId: value.action.projectId }
          : undefined;
      case 'open-codex-task':
        return hasExactKeys(value.action, ['threadId', 'type'])
          && typeof value.action.threadId === 'string'
          && SAFE_IDENTIFIER.test(value.action.threadId)
          ? { type: value.action.type, threadId: value.action.threadId }
          : undefined;
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

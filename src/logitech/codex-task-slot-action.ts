import { CommandAction } from '@logitech/plugin-sdk';

import type { CodexTask } from '../codex/codex-task-source.ts';

export type OpenThread = (threadId: string) => Promise<void>;

export class CodexTaskSlotAction extends CommandAction {
  readonly name: string;
  readonly groupName = 'Active tasks';
  displayName: string;
  description: string;
  private readonly task: CodexTask | undefined;
  private readonly openThread: OpenThread;

  constructor(
    slot: number,
    task: CodexTask | undefined,
    openThread: OpenThread,
  ) {
    super();
    this.task = task;
    this.openThread = openThread;
    this.name = `open_active_task_${slot}`;
    this.displayName = task ? compactLabel(task.title) : `Slot ${slot}: No active task`;
    this.description = task
      ? `Open “${task.title}” in Codex Desktop`
      : `No active Codex Desktop task is assigned to slot ${slot}`;
  }

  async onKeyDown(): Promise<void> {
    if (this.task) {
      await this.openThread(this.task.id);
    }
  }
}

function compactLabel(title: string): string {
  const normalized = title.replace(/\s+/g, ' ').trim();
  return normalized.length <= 42 ? normalized : `${normalized.slice(0, 39)}…`;
}

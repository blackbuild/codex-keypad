export type CodexTaskStatus =
  | 'working'
  | 'waiting-for-approval'
  | 'waiting-for-input'
  | 'completed'
  | 'failed'
  | 'interrupted';

export interface CodexTask {
  readonly id: string;
  readonly title: string;
  readonly status: CodexTaskStatus;
  readonly updatedAt: number;
}

export interface CodexTaskSource {
  listActiveTasks(limit: number): CodexTask[];
  listActiveWorkerTasks(limit: number): CodexTask[];
}

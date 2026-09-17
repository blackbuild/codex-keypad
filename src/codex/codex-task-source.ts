export type CodexTaskStatus =
  | 'working'
  | 'waiting-for-approval'
  | 'waiting-for-input'
  | 'completed'
  | 'failed'
  | 'interrupted'
  | 'unavailable';

export interface CodexTask {
  readonly id: string;
  readonly title: string;
  readonly status: CodexTaskStatus;
  readonly updatedAt: number;
}

export interface CodexTaskSource {
  /** Returns bounded, non-archived tasks with their latest normalized state. */
  listTasks(limit: number): CodexTask[];
  /** Fewer than `limit` results exhaust the worker set observed by this source. */
  listActiveWorkerTasks(limit: number): CodexTask[];
}

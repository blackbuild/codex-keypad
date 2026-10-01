import type { CodexTask } from '../codex/codex-task-source.ts';
import type { CodexProjectConfiguration, WorkflowRule, WorkflowState } from './project-configuration.ts';

const MAXIMUM_TITLE_LENGTH = 512;
const MAXIMUM_COMPACT_LABEL_LENGTH = 18;

export interface WorkflowTask extends CodexTask {
  readonly workflowState: WorkflowState;
  readonly compactLabel: string;
}

export function parseWorkflowTask(
  task: CodexTask,
  configuration: Pick<CodexProjectConfiguration, 'workflowRules' | 'compactLabelPatterns'>,
): WorkflowTask {
  const boundedTitle = task.title.slice(0, MAXIMUM_TITLE_LENGTH);
  const workflowState = task.title.length <= MAXIMUM_TITLE_LENGTH
    ? configuredWorkflowState(boundedTitle, configuration.workflowRules ?? [])
    : 'unspecified';
  const compactLabel = task.title.length <= MAXIMUM_TITLE_LENGTH
    ? configuredCompactLabel(boundedTitle, configuration.compactLabelPatterns ?? [])
      ?? compactTitle(boundedTitle)
    : compactTitle(boundedTitle);
  return { ...task, workflowState, compactLabel };
}

export function configuredWorkflowState(
  title: string,
  rules: readonly WorkflowRule[],
): WorkflowState {
  for (const rule of rules) {
    if (title.includes(rule.marker)) return rule.state;
  }
  return 'unspecified';
}

export function configuredCompactLabel(
  title: string,
  patterns: readonly string[],
): string | undefined {
  for (const pattern of patterns) {
    try {
      const match = new RegExp(pattern).exec(title)?.[0];
      if (match) return compactTitle(match);
    } catch {
      // Runtime configuration is validated at load; malformed in-memory rules fail closed.
      return undefined;
    }
  }
  return undefined;
}

function compactTitle(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= MAXIMUM_COMPACT_LABEL_LENGTH
    ? normalized
    : `${normalized.slice(0, MAXIMUM_COMPACT_LABEL_LENGTH - 1)}…`;
}

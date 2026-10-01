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
  configuration: Pick<CodexProjectConfiguration,
    'workflowRules' | 'globalWorkflowRules' | 'compactLabelPatterns' | 'globalCompactLabelPatterns'>,
): WorkflowTask {
  const boundedTitle = task.title.slice(0, MAXIMUM_TITLE_LENGTH);
  const workflowState = task.title.length <= MAXIMUM_TITLE_LENGTH
    ? configuredWorkflowState(
      boundedTitle,
      configuration.workflowRules ?? [],
      configuration.globalWorkflowRules ?? [],
    )
    : 'unspecified';
  const compactLabel = task.title.length <= MAXIMUM_TITLE_LENGTH
    ? configuredCompactLabel(
      boundedTitle,
      configuration.compactLabelPatterns ?? [],
      configuration.globalCompactLabelPatterns ?? [],
    )
      ?? compactTitle(boundedTitle)
    : compactTitle(boundedTitle);
  return { ...task, workflowState, compactLabel };
}

export function configuredWorkflowState(
  title: string,
  projectRules: readonly WorkflowRule[],
  globalRules: readonly WorkflowRule[] = [],
): WorkflowState {
  const prefix = title.trimStart();
  for (const rules of [projectRules, globalRules]) {
    for (const rule of rules) {
      if (prefix.startsWith(rule.marker)) return rule.state;
    }
  }
  return 'unspecified';
}

export function configuredCompactLabel(
  title: string,
  projectPatterns: readonly string[],
  globalPatterns: readonly string[] = [],
): string | undefined {
  for (const pattern of [...projectPatterns, ...globalPatterns]) {
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

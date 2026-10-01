import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, isAbsolute, join } from 'node:path';

const MAXIMUM_PROJECTS = 64;
const MAXIMUM_REPOSITORIES_PER_PROJECT = 16;
const MAXIMUM_COORDINATOR_PATTERN_LENGTH = 128;
const MAXIMUM_WORKFLOW_RULES = 32;
const MAXIMUM_WORKFLOW_MARKER_LENGTH = 64;
const MAXIMUM_COMPACT_LABEL_PATTERNS = 8;
const MAXIMUM_COMPACT_LABEL_PATTERN_LENGTH = 128;
const SAFE_PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SAFE_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export interface CodexProjectConfiguration {
  readonly id: string;
  readonly name: string;
  readonly root: string;
  readonly repositories?: readonly string[];
  readonly coordinatorTaskId?: string;
  readonly coordinatorTaskPattern?: string;
  readonly icon?: string;
  readonly workflowRules?: readonly WorkflowRule[];
  readonly compactLabelPatterns?: readonly string[];
}

export type WorkflowState =
  | 'unspecified' | 'waiting-for-ci' | 'waiting-for-review' | 'changes-requested'
  | 'waiting-for-input' | 'waiting-for-approval' | 'blocked' | 'handoff-failed' | 'done';

export interface WorkflowRule {
  readonly marker: string;
  readonly state: WorkflowState;
}

export const DEFAULT_WORKFLOW_RULES: readonly WorkflowRule[] = [
  { marker: '(PR:CI)', state: 'waiting-for-ci' },
  { marker: '(PR:REVIEW)', state: 'waiting-for-review' },
  { marker: '(PR:CHANGES)', state: 'changes-requested' },
  { marker: '(INPUT)', state: 'waiting-for-input' },
  { marker: '(APPROVAL)', state: 'waiting-for-approval' },
  { marker: '(BLOCKED)', state: 'blocked' },
  { marker: '(HANDOFF:FAILED)', state: 'handoff-failed' },
  { marker: '(HANDOFF)', state: 'handoff-failed' },
  { marker: '(DONE)', state: 'done' },
];

export const DEFAULT_COMPACT_LABEL_PATTERNS: readonly string[] = [
  '\\b[A-Z]{2,10}-[0-9]{1,6}\\b',
];

export function configuredProjects(
  environment: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = homedir(),
): readonly CodexProjectConfiguration[] {
  const environmentRoot = environment.CODEX_KEYPAD_PROJECT_ROOT?.trim();
  if (environmentRoot) {
    return [{
      id: projectId(environment.CODEX_KEYPAD_PROJECT_ID ?? 'codex-keypad'),
      name: projectName(environment.CODEX_KEYPAD_PROJECT_NAME ?? 'Codex Keypad'),
      root: absoluteProjectRoot(environmentRoot, 'CODEX_KEYPAD_PROJECT_ROOT'),
      ...optionalCoordinatorTaskId(
        environment.CODEX_KEYPAD_COORDINATOR_TASK_ID,
        'CODEX_KEYPAD_COORDINATOR_TASK_ID',
      ),
      ...optionalCoordinatorTaskPattern(
        environment.CODEX_KEYPAD_COORDINATOR_TASK_PATTERN,
        'CODEX_KEYPAD_COORDINATOR_TASK_PATTERN',
      ),
      ...optionalIcon(environment.CODEX_KEYPAD_PROJECT_ICON, 'CODEX_KEYPAD_PROJECT_ICON'),
      workflowRules: DEFAULT_WORKFLOW_RULES,
      compactLabelPatterns: DEFAULT_COMPACT_LABEL_PATTERNS,
    }];
  }

  const configurationPath = join(
    homeDirectory,
    'Library',
    'Application Support',
    'Codex Keypad',
    'config.json',
  );
  let json: string;
  try {
    json = readFileSync(configurationPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `CODEX_KEYPAD_PROJECT_ROOT is not set and Codex Keypad configuration is missing: ${configurationPath}`,
      );
    }
    throw error;
  }

  try {
    const configuration = JSON.parse(json) as unknown;
    if (!isRecord(configuration)) {
      throw new Error('expected a configuration object');
    }

    if (hasExactOptionalKeys(configuration, ['projectRoot'], ['coordinatorTaskPattern'])
      && typeof configuration.projectRoot === 'string') {
      return [{
        id: 'codex-keypad',
        name: 'Codex Keypad',
        root: absoluteProjectRoot(configuration.projectRoot.trim(), 'projectRoot'),
        ...optionalCoordinatorTaskPattern(
          typeof configuration.coordinatorTaskPattern === 'string'
            ? configuration.coordinatorTaskPattern
            : undefined,
          'coordinatorTaskPattern',
        ),
        workflowRules: DEFAULT_WORKFLOW_RULES,
        compactLabelPatterns: DEFAULT_COMPACT_LABEL_PATTERNS,
      }];
    }

    if (!hasExactOptionalKeys(configuration, ['projects'], [
      'coordinatorTaskPattern', 'workflowRules', 'compactLabelPatterns',
    ])
      || !Array.isArray(configuration.projects)
      || (configuration.coordinatorTaskPattern !== undefined
        && typeof configuration.coordinatorTaskPattern !== 'string')
      || (configuration.workflowRules !== undefined && !Array.isArray(configuration.workflowRules))
      || (configuration.compactLabelPatterns !== undefined && !Array.isArray(configuration.compactLabelPatterns))) {
      throw new Error('expected projects and optional workflow, compact-label, and coordinator rules');
    }
    if (configuration.projects.length > MAXIMUM_PROJECTS) {
      throw new Error(`projects must contain at most ${MAXIMUM_PROJECTS} entries`);
    }

    const defaultCoordinatorPattern = optionalCoordinatorTaskPattern(
      configuration.coordinatorTaskPattern,
      'coordinatorTaskPattern',
    ).coordinatorTaskPattern;
    const globalWorkflowRules = mergeWorkflowRules(
      DEFAULT_WORKFLOW_RULES,
      optionalWorkflowRules(configuration.workflowRules, 'workflowRules').workflowRules ?? [],
    );
    const globalCompactLabelPatterns = optionalCompactLabelPatterns(
      configuration.compactLabelPatterns,
      'compactLabelPatterns',
    ).compactLabelPatterns ?? DEFAULT_COMPACT_LABEL_PATTERNS;
    const projects = configuration.projects.map((project, index) =>
      parseProject(project, index, defaultCoordinatorPattern, globalWorkflowRules, globalCompactLabelPatterns));
    if (new Set(projects.map((project) => project.id)).size !== projects.length) {
      throw new Error('project ids must be unique');
    }
    return projects;
  } catch (error) {
    throw new Error(`Invalid Codex Keypad configuration at ${configurationPath}: ${String(error)}`);
  }
}

function parseProject(
  value: unknown,
  index: number,
  defaultCoordinatorPattern?: string,
  defaultWorkflowRules: readonly WorkflowRule[] = DEFAULT_WORKFLOW_RULES,
  defaultCompactLabelPatterns: readonly string[] = DEFAULT_COMPACT_LABEL_PATTERNS,
): CodexProjectConfiguration {
  if (!isRecord(value)
    || !hasExactOptionalKeys(
      value,
      ['id', 'name', 'root'],
      ['coordinatorTaskId', 'coordinatorTaskPattern', 'icon', 'repositories', 'workflowRules', 'compactLabelPatterns'],
    )
    || typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || typeof value.root !== 'string'
    || (value.coordinatorTaskId !== undefined && typeof value.coordinatorTaskId !== 'string')
    || (value.coordinatorTaskPattern !== undefined
      && typeof value.coordinatorTaskPattern !== 'string')
    || (value.icon !== undefined && typeof value.icon !== 'string')
      || (value.repositories !== undefined && !Array.isArray(value.repositories))
      || (value.workflowRules !== undefined && !Array.isArray(value.workflowRules))
      || (value.compactLabelPatterns !== undefined && !Array.isArray(value.compactLabelPatterns))) {
    throw new Error(
      `projects[${index}] must contain id, name, root, and optional coordinatorTaskId, coordinatorTaskPattern, icon, repositories, workflowRules, and compactLabelPatterns`,
    );
  }

  const root = absoluteProjectRoot(value.root.trim(), `projects[${index}].root`);
  const repositories = repositoryRoots(value.repositories, index);
  if (repositories.includes(root)) {
    throw new Error(`projects[${index}].repositories must not repeat its root`);
  }

  return {
    id: projectId(value.id),
    name: projectName(value.name),
    root,
    ...(repositories.length > 0 ? { repositories } : {}),
    workflowRules: mergeWorkflowRules(
      defaultWorkflowRules,
      optionalWorkflowRules(value.workflowRules, `projects[${index}].workflowRules`).workflowRules ?? [],
    ),
    compactLabelPatterns: optionalCompactLabelPatterns(
      value.compactLabelPatterns,
      `projects[${index}].compactLabelPatterns`,
    ).compactLabelPatterns ?? defaultCompactLabelPatterns,
    ...optionalCoordinatorTaskId(
      value.coordinatorTaskId,
      `projects[${index}].coordinatorTaskId`,
    ),
    ...(value.coordinatorTaskPattern !== undefined
      ? optionalCoordinatorTaskPattern(
          value.coordinatorTaskPattern,
          `projects[${index}].coordinatorTaskPattern`,
        )
      : defaultCoordinatorPattern
        ? { coordinatorTaskPattern: defaultCoordinatorPattern }
        : {}),
    ...optionalIcon(value.icon, `projects[${index}].icon`),
  };
}

function optionalWorkflowRules(value: unknown, setting: string): { readonly workflowRules?: readonly WorkflowRule[] } {
  if (value === undefined) return {};
  if (!Array.isArray(value) || value.length > MAXIMUM_WORKFLOW_RULES) {
    throw new Error(`${setting} must contain at most ${MAXIMUM_WORKFLOW_RULES} rules`);
  }
  const rules = value.map((entry, index) => {
    if (!isRecord(entry) || !hasExactOptionalKeys(entry, ['marker', 'state'], [])
      || typeof entry.marker !== 'string' || typeof entry.state !== 'string'
      || !isWorkflowState(entry.state)) {
      throw new Error(`${setting}[${index}] must contain a marker and a supported workflow state`);
    }
    const marker = entry.marker.trim();
    if (!marker || marker.length > MAXIMUM_WORKFLOW_MARKER_LENGTH || /[\r\n]/.test(marker)) {
      throw new Error(`${setting}[${index}].marker must contain 1-${MAXIMUM_WORKFLOW_MARKER_LENGTH} single-line characters`);
    }
    return { marker, state: entry.state };
  });
  if (new Set(rules.map(({ marker }) => marker)).size !== rules.length) {
    throw new Error(`${setting} markers must be unique`);
  }
  return { workflowRules: rules };
}

function optionalCompactLabelPatterns(value: unknown, setting: string): { readonly compactLabelPatterns?: readonly string[] } {
  if (value === undefined) return {};
  if (!Array.isArray(value) || value.length > MAXIMUM_COMPACT_LABEL_PATTERNS
    || value.some((pattern) => typeof pattern !== 'string')) {
    throw new Error(`${setting} must contain at most ${MAXIMUM_COMPACT_LABEL_PATTERNS} patterns`);
  }
  const patterns = value.map((pattern, index) => {
    const normalized = (pattern as string).trim();
    if (!isSafeCompactPattern(normalized)) {
      throw new Error(`${setting}[${index}] is not a supported bounded compact-label pattern`);
    }
    return normalized;
  });
  return { compactLabelPatterns: [...new Set(patterns)] };
}

function mergeWorkflowRules(
  inherited: readonly WorkflowRule[],
  overrides: readonly WorkflowRule[],
): readonly WorkflowRule[] {
  const merged = [...inherited];
  for (const override of overrides) {
    const index = merged.findIndex(({ marker }) => marker === override.marker);
    if (index < 0) merged.push(override);
    else merged[index] = override;
  }
  if (merged.length > MAXIMUM_WORKFLOW_RULES) {
    throw new Error(`effective workflow rules must contain at most ${MAXIMUM_WORKFLOW_RULES} entries`);
  }
  return merged;
}

function isWorkflowState(value: string): value is WorkflowState {
  return ['unspecified', 'waiting-for-ci', 'waiting-for-review', 'changes-requested',
    'waiting-for-input', 'waiting-for-approval', 'blocked', 'handoff-failed', 'done'].includes(value);
}

// Linear, bounded subset: literals, character classes, simple escapes, and bounded
// repetitions. Grouping, alternation, backreferences, and unbounded wildcards are excluded.
function isSafeCompactPattern(pattern: string): boolean {
  if (!pattern || pattern.length > MAXIMUM_COMPACT_LABEL_PATTERN_LENGTH) return false;
  const token = /(?:[A-Za-z0-9#_-]|\\[dw]|\\b|\[[A-Za-z0-9-]+\])(?:\{\d{1,2}(?:,\d{1,2})?\})?/y;
  let offset = 0;
  let tokens = 0;
  while (offset < pattern.length) {
    token.lastIndex = offset;
    const matched = token.exec(pattern)?.[0];
    if (!matched) return false;
    const bounds = /\{(\d{1,2})(?:,(\d{1,2}))?\}$/.exec(matched);
    if (bounds) {
      const minimum = Number(bounds[1]);
      const maximum = Number(bounds[2] ?? bounds[1]);
      if (minimum < 1 || maximum < minimum || maximum > 32) return false;
    }
    offset += matched.length;
    tokens += 1;
  }
  if (tokens === 0) return false;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function repositoryRoots(value: unknown, projectIndex: number): readonly string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)
    || value.length > MAXIMUM_REPOSITORIES_PER_PROJECT
    || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(
      `projects[${projectIndex}].repositories must contain at most ${MAXIMUM_REPOSITORIES_PER_PROJECT} paths`,
    );
  }
  const roots = value.map((entry, repositoryIndex) => absoluteProjectRoot(
    entry.trim(),
    `projects[${projectIndex}].repositories[${repositoryIndex}]`,
  ));
  if (new Set(roots).size !== roots.length) {
    throw new Error(`projects[${projectIndex}].repositories must be unique`);
  }
  return roots;
}

function projectId(value: string): string {
  if (!SAFE_PROJECT_ID.test(value)) {
    throw new Error('project id must be a safe 1-64 character identifier');
  }
  return value;
}

function projectName(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > 64) {
    throw new Error('project name must contain 1-64 display characters');
  }
  return normalized;
}

function optionalCoordinatorTaskId(
  value: string | undefined,
  setting: string,
): { readonly coordinatorTaskId?: string } {
  if (value === undefined) {
    return {};
  }
  const normalized = normalizedTaskId(value.trim());
  if (!normalized) {
    throw new Error(`${setting} must be a safe 1-128 character task identifier`);
  }
  return { coordinatorTaskId: normalized };
}

function normalizedTaskId(value: string): string | undefined {
  if (SAFE_TASK_ID.test(value)) {
    return value;
  }
  try {
    const url = new URL(value);
    const taskId = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    return url.protocol === 'codex:'
      && url.hostname === 'threads'
      && !url.username
      && !url.password
      && !url.port
      && !url.search
      && !url.hash
      && !taskId.includes('/')
      && SAFE_TASK_ID.test(taskId)
      ? taskId
      : undefined;
  } catch {
    return undefined;
  }
}

function optionalCoordinatorTaskPattern(
  value: string | undefined,
  setting: string,
): { readonly coordinatorTaskPattern?: string } {
  if (value === undefined) {
    return {};
  }
  const normalized = value.trim().replace(/\*+/g, '*');
  if (!normalized || normalized.length > MAXIMUM_COORDINATOR_PATTERN_LENGTH) {
    throw new Error(
      `${setting} must contain 1-${MAXIMUM_COORDINATOR_PATTERN_LENGTH} pattern characters`,
    );
  }
  return { coordinatorTaskPattern: normalized };
}

function absoluteProjectRoot(value: string, setting: string): string {
  if (!value || !isAbsolute(value)) {
    throw new Error(`${setting} must be an absolute project directory`);
  }
  return value;
}

function optionalIcon(value: string | undefined, setting: string): { readonly icon?: string } {
  if (value === undefined) {
    return {};
  }
  const normalized = value.trim();
  if (!isAbsolute(normalized) || extname(normalized).toLowerCase() !== '.png') {
    throw new Error(`${setting} must be an absolute PNG path`);
  }
  return { icon: normalized };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactOptionalKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
): boolean {
  const keys = new Set(Object.keys(value));
  return required.every((key) => keys.has(key))
    && [...keys].every((key) => required.includes(key) || optional.includes(key));
}

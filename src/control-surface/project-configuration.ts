import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, isAbsolute, join } from 'node:path';

const MAXIMUM_PROJECTS = 64;
const MAXIMUM_REPOSITORIES_PER_PROJECT = 16;
const SAFE_PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export interface CodexProjectConfiguration {
  readonly id: string;
  readonly name: string;
  readonly root: string;
  readonly repositories?: readonly string[];
  readonly icon?: string;
}

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
      ...optionalIcon(environment.CODEX_KEYPAD_PROJECT_ICON, 'CODEX_KEYPAD_PROJECT_ICON'),
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

    if (hasExactKeys(configuration, ['projectRoot'])
      && typeof configuration.projectRoot === 'string') {
      return [{
        id: 'codex-keypad',
        name: 'Codex Keypad',
        root: absoluteProjectRoot(configuration.projectRoot.trim(), 'projectRoot'),
      }];
    }

    if (!hasExactKeys(configuration, ['projects']) || !Array.isArray(configuration.projects)) {
      throw new Error('expected only a projects array');
    }
    if (configuration.projects.length > MAXIMUM_PROJECTS) {
      throw new Error(`projects must contain at most ${MAXIMUM_PROJECTS} entries`);
    }

    const projects = configuration.projects.map(parseProject);
    if (new Set(projects.map((project) => project.id)).size !== projects.length) {
      throw new Error('project ids must be unique');
    }
    return projects;
  } catch (error) {
    throw new Error(`Invalid Codex Keypad configuration at ${configurationPath}: ${String(error)}`);
  }
}

function parseProject(value: unknown, index: number): CodexProjectConfiguration {
  if (!isRecord(value)
    || !hasExactOptionalKeys(value, ['id', 'name', 'root'], ['icon', 'repositories'])
    || typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || typeof value.root !== 'string'
    || (value.icon !== undefined && typeof value.icon !== 'string')
    || (value.repositories !== undefined && !Array.isArray(value.repositories))) {
    throw new Error(
      `projects[${index}] must contain id, name, root, and optional icon and repositories`,
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
    ...optionalIcon(value.icon, `projects[${index}].icon`),
  };
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

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
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

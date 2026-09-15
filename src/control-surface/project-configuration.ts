import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export function configuredProjectRoot(
  environment: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = homedir(),
): string {
  const environmentRoot = environment.CODEX_KEYPAD_PROJECT_ROOT?.trim();
  if (environmentRoot) {
    return requireAbsoluteProjectRoot(environmentRoot, 'CODEX_KEYPAD_PROJECT_ROOT');
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
    if (!isRecord(configuration)
      || Object.keys(configuration).length !== 1
      || typeof configuration.projectRoot !== 'string') {
      throw new Error('expected only a string projectRoot property');
    }
    return requireAbsoluteProjectRoot(configuration.projectRoot.trim(), 'projectRoot');
  } catch (error) {
    throw new Error(`Invalid Codex Keypad configuration at ${configurationPath}: ${String(error)}`);
  }
}

function requireAbsoluteProjectRoot(value: string, setting: string): string {
  if (!value || !isAbsolute(value)) {
    throw new Error(`${setting} must be an absolute project directory`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

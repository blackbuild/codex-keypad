import { createDefaultCodexTaskSource } from '../codex/sqlite-codex-task-source.ts';
import { ControlSurfaceStatePublisher } from './control-surface-state-publisher.ts';
import { refreshSingleProjectControlSurface } from './control-surface-state-service.ts';

const REFRESH_INTERVAL_MS = 1_000;
const SAFE_PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const outputPath = requiredOption(process.argv.slice(2), '--output');
const once = process.argv.slice(2).includes('--once');
if (!process.env.CODEX_KEYPAD_PROJECT_ROOT) {
  throw new Error('CODEX_KEYPAD_PROJECT_ROOT must identify the configured Codex project');
}
const project = {
  id: projectId(process.env.CODEX_KEYPAD_PROJECT_ID ?? 'codex-keypad'),
  name: projectName(process.env.CODEX_KEYPAD_PROJECT_NAME ?? 'Codex Keypad'),
};
const publisher = new ControlSurfaceStatePublisher(outputPath);
const taskSource = createDefaultCodexTaskSource();

async function refresh(): Promise<void> {
  try {
    await refreshSingleProjectControlSurface(taskSource, publisher, project);
  } catch (error) {
    console.error('Unable to refresh Codex Keypad state:', error);
  }
}

await refresh();
if (!once) {
  const timer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
  process.once('SIGINT', () => clearInterval(timer));
  process.once('SIGTERM', () => clearInterval(timer));
}

function requiredOption(arguments_: readonly string[], option: string): string {
  const index = arguments_.indexOf(option);
  const value = index === -1 ? undefined : arguments_[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function projectId(value: string): string {
  if (!SAFE_PROJECT_ID.test(value)) {
    throw new Error('CODEX_KEYPAD_PROJECT_ID must be a safe 1-64 character identifier');
  }
  return value;
}

function projectName(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > 80) {
    throw new Error('CODEX_KEYPAD_PROJECT_NAME must contain 1-80 display characters');
  }
  return normalized;
}

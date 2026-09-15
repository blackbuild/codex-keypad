import { createDefaultCodexTaskSource } from '../codex/sqlite-codex-task-source.ts';
import { openCodexThread } from '../macos/open-codex-thread.ts';
import { ControlSurfaceActionInbox } from './control-surface-action-inbox.ts';
import { ControlSurfaceStatePublisher } from './control-surface-state-publisher.ts';
import { configuredProjectRoot } from './project-configuration.ts';
import { SingleProjectNavigation } from './single-project-navigation.ts';

const REFRESH_INTERVAL_MS = 250;
const SAFE_PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const arguments_ = process.argv.slice(2);
const outputPath = requiredOption(arguments_, '--output');
const actionPath = requiredOption(arguments_, '--actions');
const once = arguments_.includes('--once');
const projectRoot = configuredProjectRoot();

const project = {
  id: projectId(process.env.CODEX_KEYPAD_PROJECT_ID ?? 'codex-keypad'),
  name: projectName(process.env.CODEX_KEYPAD_PROJECT_NAME ?? 'Codex Keypad'),
};
const taskSource = createDefaultCodexTaskSource({
  ...process.env,
  CODEX_KEYPAD_PROJECT_ROOT: projectRoot,
});
const publisher = new ControlSurfaceStatePublisher(outputPath);
const inbox = new ControlSurfaceActionInbox(actionPath);
const navigation = new SingleProjectNavigation(project, openCodexThread);
let stopped = false;

process.once('SIGINT', () => {
  stopped = true;
});
process.once('SIGTERM', () => {
  stopped = true;
});

do {
  try {
    const task = taskSource.listActiveTasks(1)[0];
    const action = await inbox.take();
    if (action) {
      await navigation.perform(action, task);
    }
    await publisher.publish(navigation.snapshot(task));
  } catch (error) {
    console.error('Unable to refresh Codex Keypad state:', error);
  }

  if (!once && !stopped) {
    await new Promise((resolve) => setTimeout(resolve, REFRESH_INTERVAL_MS));
  }
} while (!once && !stopped);

function requiredOption(values: readonly string[], option: string): string {
  const index = values.indexOf(option);
  const value = index === -1 ? undefined : values[index + 1];
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
  if (!normalized || normalized.length > 64) {
    throw new Error('CODEX_KEYPAD_PROJECT_NAME must contain 1-64 display characters');
  }
  return normalized;
}

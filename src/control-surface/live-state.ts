import { createDefaultCodexTaskSource } from '../codex/sqlite-codex-task-source.ts';
import { openCodexThread } from '../macos/open-codex-thread.ts';
import { ControlSurfaceActionInbox } from './control-surface-action-inbox.ts';
import { ControlSurfaceStatePublisher } from './control-surface-state-publisher.ts';
import { configuredProjects } from './project-configuration.ts';
import { ProjectNavigation } from './project-navigation.ts';
import { readProjectStates } from './project-state-source.ts';

const REFRESH_INTERVAL_MS = 250;

const arguments_ = process.argv.slice(2);
const outputPath = requiredOption(arguments_, '--output');
const actionPath = requiredOption(arguments_, '--actions');
const once = arguments_.includes('--once');
const publisher = new ControlSurfaceStatePublisher(outputPath);
const inbox = new ControlSurfaceActionInbox(actionPath);
const navigation = new ProjectNavigation(openCodexThread);
let stopped = false;

process.once('SIGINT', () => {
  stopped = true;
});
process.once('SIGTERM', () => {
  stopped = true;
});

do {
  try {
    const projects = readProjectStates(
      configuredProjects(),
      (projectRoot) => createDefaultCodexTaskSource({
        ...process.env,
        CODEX_KEYPAD_PROJECT_ROOT: projectRoot,
      }),
    );
    const action = await inbox.take();
    if (action) {
      await navigation.perform(action, projects);
    }
    await publisher.publish(navigation.snapshot(projects));
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

import { PluginSDK } from '@logitech/plugin-sdk';
import type { CodexTask } from './src/codex/codex-task-source.ts';
import { createDefaultCodexTaskSource } from './src/codex/sqlite-codex-task-source.ts';
import { CodexTaskSlotAction } from './src/logitech/codex-task-slot-action.ts';
import { openCodexThread } from './src/macos/open-codex-thread.ts';

const LCD_KEY_COUNT = 9;

const pluginSDK = new PluginSDK();
const taskSource = createDefaultCodexTaskSource();

let activeTasks: CodexTask[] = [];
try {
  activeTasks = taskSource.listActiveTasks(LCD_KEY_COUNT);
} catch (error) {
  console.error('Unable to read active Codex Desktop tasks:', error);
}

for (let index = 0; index < LCD_KEY_COUNT; index += 1) {
  pluginSDK.registerAction(
    new CodexTaskSlotAction(index + 1, activeTasks[index], openCodexThread),
  );
}

await pluginSDK.connect();

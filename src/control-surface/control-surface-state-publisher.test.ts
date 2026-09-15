import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';

import { buildProjectControlSurface, exactActiveWorkerCount } from './control-surface-state.ts';
import { ControlSurfaceStatePublisher } from './control-surface-state-publisher.ts';

let fixtureDirectory: string;

before(async () => {
  fixtureDirectory = await mkdtemp(join(tmpdir(), 'codex-keypad-state-'));
});

after(async () => {
  await rm(fixtureDirectory, { recursive: true, force: true });
});

test('publishes normalized state and skips an identical replacement', async () => {
  const output = join(fixtureDirectory, 'state.json');
  const publisher = new ControlSurfaceStatePublisher(output);
  const state = buildProjectControlSurface([{
    project: { id: 'codex-keypad', name: 'Codex Keypad' },
    activeWorkerCount: exactActiveWorkerCount(0),
  }]);

  assert.equal(await publisher.publish(state), true);
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), state);
  assert.equal(await publisher.publish(state), false);
});

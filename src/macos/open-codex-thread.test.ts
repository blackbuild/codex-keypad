import assert from 'node:assert/strict';
import test from 'node:test';

import { codexThreadUrl } from './open-codex-thread.ts';

test('builds a Codex Desktop thread deep link', () => {
  assert.equal(
    codexThreadUrl('01a08f81-4e7f-77e1-8fea-660ec0084183'),
    'codex://threads/01a08f81-4e7f-77e1-8fea-660ec0084183',
  );
});

test('rejects thread IDs that could change the deep-link route', () => {
  assert.throws(() => codexThreadUrl('../settings'));
  assert.throws(() => codexThreadUrl('task?prompt=surprise'));
  assert.throws(() => codexThreadUrl(''));
});

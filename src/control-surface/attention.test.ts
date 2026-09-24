import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateAttention,
  taskAttentionState,
  visualizeAttention,
} from './attention.ts';

test('composes concurrent attention by documented precedence within a bounded summary', () => {
  assert.deepEqual(aggregateAttention([
    'working',
    'waiting-for-input',
    'failed',
    'waiting-for-approval',
    'working',
    'stale',
  ]), {
    primary: 'failed',
    indicators: [
      { state: 'failed', count: 1 },
      { state: 'waiting-for-approval', count: 1 },
      { state: 'waiting-for-input', count: 1 },
    ],
    additionalStates: 2,
  });
});

test('reduces no observed conditions to confirmed idle', () => {
  assert.deepEqual(aggregateAttention([]), {
    primary: 'idle',
    indicators: [{ state: 'idle', count: 1 }],
    additionalStates: 0,
  });
});

test('uses idle only when no non-idle condition is present', () => {
  assert.deepEqual(aggregateAttention(['idle', 'working', 'idle']), {
    primary: 'working',
    indicators: [{ state: 'working', count: 1 }],
    additionalStates: 0,
  });
});

test('maps normalized attention to stable colors, glyphs, and bounded border segments', () => {
  const summary = aggregateAttention([
    'working',
    'waiting-for-input',
    'failed',
    'waiting-for-approval',
    'stale',
  ]);

  assert.deepEqual(visualizeAttention(summary, 'project'), {
    icon: 'project',
    glyph: 'P',
    tone: 'failed',
    backgroundColor: '#7F1D1D',
    foregroundColor: '#FFFFFF',
    borderColors: ['#F87171', '#FACC15', '#60A5FA'],
    badge: '!AI+2',
    workerIndicators: [],
  });
});

test('maps completed task state to idle without losing unavailable task state', () => {
  assert.equal(taskAttentionState('completed'), 'idle');
  assert.equal(taskAttentionState('unavailable'), 'unavailable');
});

test('keeps every available task condition distinct in the visual legend', () => {
  const expected = [
    ['working', 'working', '#075985', '>'],
    ['waiting-for-input', 'waiting-for-input', '#1E3A8A', 'I'],
    ['waiting-for-approval', 'waiting-for-approval', '#713F12', 'A'],
    ['interrupted', 'interrupted', '#4C1D95', 'X'],
    ['failed', 'failed', '#7F1D1D', '!'],
    ['unavailable', 'unavailable', '#3F3F46', '?'],
    ['completed', 'idle', '#1F2937', 'OK'],
  ] as const;

  assert.deepEqual(expected.map(([status]) => {
    const state = taskAttentionState(status);
    const visual = visualizeAttention(aggregateAttention([state]), 'task');
    return [status, state, visual.backgroundColor, visual.badge];
  }), expected);
  assert.deepEqual(
    visualizeAttention(aggregateAttention(['stale']), 'project'),
    {
      icon: 'project',
      glyph: 'P',
      tone: 'stale',
      backgroundColor: '#57534E',
      foregroundColor: '#FFFFFF',
      borderColors: ['#FDBA74'],
      badge: '~',
      workerIndicators: [],
    },
  );
});

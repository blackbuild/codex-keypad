import assert from 'node:assert/strict';
import test from 'node:test';

import type { WorkflowRule } from './project-configuration.ts';
import { parseWorkflowTask } from './workflow-metadata.ts';

const rules: readonly WorkflowRule[] = [
  { marker: '(PR:CI)', state: 'waiting-for-ci' },
  { marker: '(PR:REVIEW)', state: 'waiting-for-review' },
  { marker: '(PR:CHANGES)', state: 'changes-requested' },
  { marker: '(INPUT)', state: 'waiting-for-input' },
  { marker: '(APPROVAL)', state: 'waiting-for-approval' },
  { marker: '(BLOCKED)', state: 'blocked' },
  { marker: '(HANDOFF:FAILED)', state: 'handoff-failed' },
  { marker: '(DONE)', state: 'done' },
];

const task = (title: string) => ({
  id: 'stable-thread-id', title, status: 'working' as const, updatedAt: 100,
});

test('normalizes the closed workflow vocabulary from configured literal markers', () => {
  const expected = [
    ['(PR:CI)', 'waiting-for-ci'],
    ['(PR:REVIEW)', 'waiting-for-review'],
    ['(PR:CHANGES)', 'changes-requested'],
    ['(INPUT)', 'waiting-for-input'],
    ['(APPROVAL)', 'waiting-for-approval'],
    ['(BLOCKED)', 'blocked'],
    ['(HANDOFF:FAILED)', 'handoff-failed'],
    ['(DONE)', 'done'],
    ['(UNKNOWN)', 'unspecified'],
  ] as const;
  for (const [marker, state] of expected) {
    const parsed = parseWorkflowTask(task(`${marker} DIST-15 Create charts`), {
      workflowRules: rules,
      compactLabelPatterns: ['[A-Z]{2,10}-[0-9]{1,6}'],
    });
    assert.equal(parsed.workflowState, state);
    assert.equal(parsed.status, 'working');
    assert.equal(parsed.id, 'stable-thread-id');
    assert.equal(parsed.compactLabel, 'DIST-15');
  }
});

test('compact-label extraction is independent and safely falls back when unmatched', () => {
  const parsed = parseWorkflowTask(task('(PR:CI) no issue key'), {
    workflowRules: rules,
    compactLabelPatterns: ['[A-Z]{2,10}-[0-9]{1,6}'],
  });
  assert.equal(parsed.workflowState, 'waiting-for-ci');
  assert.equal(parsed.compactLabel, '(PR:CI) no issue …');
});

test('overlong titles fail closed for workflow parsing and bound the fallback label', () => {
  const parsed = parseWorkflowTask(task(`(DONE) ${'x'.repeat(600)}`), {
    workflowRules: rules,
    compactLabelPatterns: ['[A-Z]{2,10}-[0-9]{1,6}'],
  });
  assert.equal(parsed.workflowState, 'unspecified');
  assert.equal(parsed.compactLabel.length, 18);
  assert.equal(parsed.status, 'working');
});

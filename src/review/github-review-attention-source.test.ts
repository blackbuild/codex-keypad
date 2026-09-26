import assert from 'node:assert/strict';
import test from 'node:test';

import { GithubReviewAttentionSource } from './github-review-attention-source.ts';

test('normalizes authenticated requested reviews without retaining provider records', async () => {
  const source = new GithubReviewAttentionSource('test-token', async () => response([
    { number: 1, draft: false, requested_reviewers: [{ login: 'reviewer' }], requested_teams: [] },
    { number: 2, draft: true, requested_reviewers: [{ login: 'reviewer' }], requested_teams: [] },
    { number: 3, draft: false, requested_reviewers: [], requested_teams: [{ slug: 'team' }] },
    { number: 4, draft: false, requested_reviewers: [], requested_teams: [] },
  ]), () => 10_000);

  assert.deepEqual(await source.read('owner/repo'), {
    availability: 'available', waitingForReviewCount: 2, observedAt: 10_000,
  });
});

test('unauthenticated, malformed, and failed provider reads never confirm review attention', async () => {
  const payload = [{ number: 1, draft: false, requested_reviewers: [{ login: 'reviewer' }], requested_teams: [] }];
  const unauthenticated = new GithubReviewAttentionSource(undefined, async () => response(payload));
  const malformed = new GithubReviewAttentionSource('token', async () => response({ items: payload }));
  const failed = new GithubReviewAttentionSource('token', async () => new Response('', { status: 401 }));

  assert.deepEqual(await unauthenticated.read('owner/repo'), { availability: 'unavailable' });
  assert.deepEqual(await malformed.read('owner/repo'), { availability: 'unavailable' });
  assert.deepEqual(await failed.read('owner/repo'), { availability: 'unavailable' });
});

test('failed refresh degrades a prior positive result to stale and never keeps it confirmed', async () => {
  let now = 10_000;
  let online = true;
  const source = new GithubReviewAttentionSource('token', async () =>
    online ? response([{ number: 1, draft: false, requested_reviewers: [{ login: 'reviewer' }], requested_teams: [] }])
      : new Response('', { status: 503 }), () => now);

  assert.equal((await source.read('owner/repo')).availability, 'available');
  now += 60_001;
  online = false;
  assert.deepEqual(await source.read('owner/repo'), { availability: 'stale' });
});

test('caches fresh source evidence and issues no redundant provider request', async () => {
  let calls = 0;
  const source = new GithubReviewAttentionSource('token', async () => {
    calls += 1;
    return response([]);
  }, () => 1_000);

  await source.read('owner/repo');
  await source.read('owner/repo');
  assert.equal(calls, 1);
});

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

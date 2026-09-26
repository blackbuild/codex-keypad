import type { ReviewAttention } from '../control-surface/control-surface-state.ts';

const CACHE_FRESH_MS = 60_000;
const MAXIMUM_PULL_REQUEST_PAGES = 10;

export type ReviewFetch = (input: string, init: RequestInit) => Promise<Response>;

/** Reads only normalized review-request counts. Credentials and provider payloads stay in this adapter. */
export class GithubReviewAttentionSource {
  private readonly cache = new Map<string, { readonly readAt: number; readonly count: number }>();
  private readonly token: string | undefined;
  private readonly fetcher: ReviewFetch;
  private readonly now: () => number;

  constructor(
    token: string | undefined,
    fetcher: ReviewFetch = fetch,
    now: () => number = Date.now,
  ) {
    this.token = token?.trim() || undefined;
    this.fetcher = fetcher;
    this.now = now;
  }

  async read(repository: string): Promise<ReviewAttention> {
    const cached = this.cache.get(repository);
    const currentTime = this.now();
    if (cached && currentTime >= cached.readAt && currentTime - cached.readAt < CACHE_FRESH_MS) {
      return { availability: 'available', waitingForReviewCount: cached.count, observedAt: cached.readAt };
    }
    if (!this.token?.trim()) return { availability: 'unavailable' };

    try {
      const count = await this.requestCount(repository);
      const observedAt = this.now();
      if (!Number.isFinite(observedAt) || observedAt < 0 || observedAt > currentTime + 300_000) {
        return { availability: 'unavailable' };
      }
      this.cache.set(repository, { readAt: observedAt, count });
      return { availability: 'available', waitingForReviewCount: count, observedAt };
    } catch {
      return cached ? { availability: 'stale' } : { availability: 'unavailable' };
    }
  }

  private async requestCount(repository: string): Promise<number> {
    let count = 0;
    for (let page = 1; page <= MAXIMUM_PULL_REQUEST_PAGES; page += 1) {
      const url = `https://api.github.com/repos/${repository}/pulls?state=open&per_page=100&page=${page}`;
      const response = await this.fetcher(url, {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${this.token}`,
          'x-github-api-version': '2022-11-28',
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('review provider request failed');
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) throw new Error('review provider payload is malformed');
      for (const pullRequest of payload) {
        if (!isRecord(pullRequest)
          || !Number.isSafeInteger(pullRequest.number)
          || (pullRequest.number as number) < 1
          || typeof pullRequest.draft !== 'boolean'
          || !Array.isArray(pullRequest.requested_reviewers)
          || !pullRequest.requested_reviewers.every((reviewer) =>
            isRecord(reviewer) && typeof reviewer.login === 'string' && reviewer.login.length > 0)
          || !Array.isArray(pullRequest.requested_teams)
          || !pullRequest.requested_teams.every((team) =>
            isRecord(team) && typeof team.slug === 'string' && team.slug.length > 0)) {
          throw new Error('review provider payload is malformed');
        }
        if (!pullRequest.draft
          && (pullRequest.requested_reviewers.length > 0 || pullRequest.requested_teams.length > 0)) {
          count += 1;
        }
      }
      if (payload.length < 100) return count;
    }
    throw new Error('review provider result exceeded the bounded page limit');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

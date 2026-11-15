import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('axios', () => ({ default: { post } }));
vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { jevStatus, reviewDispute, safeReviewDispute } from '../src/services/jev.service';

describe('Jev / TypeSafe dispute review', () => {
  beforeEach(() => {
    post.mockReset();
    vi.stubEnv('TYPESAFE_API_KEY', 'test-key');
    vi.stubEnv('TYPESAFE_BASE_URL', 'https://api.typesafe.test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports configured only when a key is present', () => {
    expect(jevStatus()).toBe(true);
    vi.stubEnv('TYPESAFE_API_KEY', '');
    expect(jevStatus()).toBe(false);
  });

  it('posts the dispute state and typed questions to the System One endpoint', async () => {
    post.mockResolvedValue({
      data: {
        answers: {
          verdict: { choice: 'release', confidence: 0.91 },
          confidence: { score: 0.9 },
        },
      },
    });

    const review = await reviewDispute({ description: 'Worker arrived and completed the job.', evidenceUrls: ['https://example.test/receipt.png'] });

    expect(post).toHaveBeenCalledWith(
      'https://api.typesafe.test/v1/systemone',
      expect.objectContaining({
        state: expect.objectContaining({ claim: 'Worker arrived and completed the job.' }),
        model: 'jev-latest',
      }),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-key' }) }),
    );
    expect(review.verdict).toBe('release');
    expect(review.confidence).toBe(0.9);
  });

  it('returns null without calling the API when Jev is not configured', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', '');
    await expect(safeReviewDispute({ description: 'no key' })).resolves.toBeNull();
    expect(post).not.toHaveBeenCalled();
  });
});

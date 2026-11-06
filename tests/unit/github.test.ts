import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubService } from '../../src/services/github.js';

describe('GitHubService', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects invalid repo formats', async () => {
    const service = new GitHubService();
    const res = await service.summarizeRepo('invalid-format');
    expect('isError' in res && res.isError).toBe(true);
    if ('isError' in res) {
      expect(res.message).toContain('Invalid repository format');
    }
  });

  it('successfully fetches commits and issue count with mocked fetch', async () => {
    const mockCommits = [
      { commit: { message: 'feat: add MCP streamable transport\n\nMore details here' } },
      { commit: { message: 'fix: handle CORS preflight correctly' } },
      { commit: { message: 'docs: update README with inspector guide' } },
    ];
    const mockSearch = { total_count: 5 };

    globalThis.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes('/commits')) {
        return Promise.resolve(new Response(JSON.stringify(mockCommits), { status: 200 }));
      }
      if (urlStr.includes('/search/issues')) {
        return Promise.resolve(new Response(JSON.stringify(mockSearch), { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    const service = new GitHubService('fake-token', 5000);
    const summary = await service.summarizeRepo('modelcontextprotocol/typescript-sdk');

    expect('isError' in summary).toBe(false);
    if (!('isError' in summary)) {
      expect(summary.repo).toBe('modelcontextprotocol/typescript-sdk');
      expect(summary.commits.length).toBe(3);
      expect(summary.commits[0]).toBe('feat: add MCP streamable transport');
      expect(summary.openIssuesCount).toBe(5);
    }
  });

  it('handles 404 repository not found with a friendly message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }));

    const service = new GitHubService();
    const res = await service.summarizeRepo('nonexistent/repo');

    expect('isError' in res && res.isError).toBe(true);
    if ('isError' in res) {
      expect(res.message).toContain('Repository not found');
      expect(res.message).not.toContain('stack');
    }
  });

  it('handles 403 rate limit with X-RateLimit-Remaining: 0', async () => {
    const headers = new Headers();
    headers.set('x-ratelimit-remaining', '0');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('Rate limited', { status: 403, headers }));

    const service = new GitHubService();
    const res = await service.summarizeRepo('popular/project');

    expect('isError' in res && res.isError).toBe(true);
    if ('isError' in res) {
      expect(res.message).toContain('rate limit exceeded');
    }
  });

  it('handles network timeouts cleanly without throwing uncaught', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(
        new DOMException('The operation was aborted due to timeout', 'TimeoutError')
      );

    const service = new GitHubService(undefined, 100);
    const res = await service.summarizeRepo('slow/network');

    expect('isError' in res && res.isError).toBe(true);
    if ('isError' in res) {
      expect(res.message).toContain('timed out');
    }
  });
});

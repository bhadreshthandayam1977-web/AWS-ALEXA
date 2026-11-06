/**
 * GitHub REST API client with timeout, error mapping, and optional token support.
 */

export interface RepoSummary {
  repo: string;
  commits: string[];
  openIssuesCount: number;
}

export interface GitHubError {
  isError: true;
  message: string;
}

export class GitHubService {
  private token?: string;
  private timeoutMs: number;

  constructor(token?: string, timeoutMs = 8000) {
    this.token = token;
    this.timeoutMs = timeoutMs;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'alexa-taskflow/1.0.0',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Fetches the 3 latest commits and open issue count (excluding PRs) for a repository.
   */
  async summarizeRepo(repo: string): Promise<RepoSummary | GitHubError> {
    const [owner, name] = repo.split('/');
    if (!owner || !name) {
      return {
        isError: true,
        message: `Invalid repository format: ${repo}. Expected owner/repo.`,
      };
    }

    try {
      // 1. Fetch 3 latest commits
      const commitsUrl = `https://api.github.com/repos/${owner}/${name}/commits?per_page=3`;
      const commitsRes = await fetch(commitsUrl, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!commitsRes.ok) {
        return this.mapHttpError(commitsRes, repo);
      }

      const commitsData = await commitsRes.json();
      const commits = Array.isArray(commitsData)
        ? commitsData.map((c: { commit?: { message?: string } }) => {
            const fullMsg = c.commit?.message || 'Untitled commit';
            // Take only first line of commit message
            return fullMsg.split('\n')[0].trim();
          })
        : [];

      // 2. Fetch open issue count (excluding PRs)
      let openIssuesCount = 0;
      try {
        const searchUrl = `https://api.github.com/search/issues?q=repo:${owner}/${name}+type:issue+state:open`;
        const searchRes = await fetch(searchUrl, {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (searchRes.ok) {
          const searchData = (await searchRes.json()) as { total_count?: number };
          openIssuesCount = searchData.total_count ?? 0;
        } else {
          // Fall back to repo endpoint
          openIssuesCount = await this.fallbackIssueCount(owner, name);
        }
      } catch {
        openIssuesCount = await this.fallbackIssueCount(owner, name);
      }

      return {
        repo,
        commits,
        openIssuesCount,
      };
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return {
          isError: true,
          message: `Request timed out while connecting to GitHub for ${repo}.`,
        };
      }
      return {
        isError: true,
        message: `Could not reach GitHub for repository ${repo}: ${error.message}`,
      };
    }
  }

  private async fallbackIssueCount(owner: string, name: string): Promise<number> {
    try {
      const repoUrl = `https://api.github.com/repos/${owner}/${name}`;
      const res = await fetch(repoUrl, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (res.ok) {
        const repoData = (await res.json()) as { open_issues_count?: number };
        return repoData.open_issues_count ?? 0;
      }
    } catch {
      // Ignore fallback errors and return 0
    }
    return 0;
  }

  private mapHttpError(res: Response, repo: string): GitHubError {
    const rateLimitRemaining = res.headers.get('x-ratelimit-remaining');
    if (res.status === 403 && rateLimitRemaining === '0') {
      return {
        isError: true,
        message:
          'GitHub API rate limit exceeded. Please configure a GitHub token or try again later.',
      };
    }
    if (res.status === 404) {
      return {
        isError: true,
        message: `Repository not found: ${repo}. Please check the owner and repository name.`,
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        isError: true,
        message: `Access denied to GitHub repository ${repo}. Check permissions or token.`,
      };
    }
    return {
      isError: true,
      message: `GitHub returned status ${res.status} for repository ${repo}.`,
    };
  }
}

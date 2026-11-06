import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GitHubService } from '../services/github.js';
import { speakable } from '../services/speech.js';

export const summarizeRepoSchema = {
  repo: z
    .string()
    .regex(
      /^[\w.-]+\/[\w.-]+$/,
      'Repository must be in "owner/repo" format, e.g. "modelcontextprotocol/typescript-sdk"'
    )
    .describe('The GitHub repository in owner/repo format to summarize.'),
};

export function registerSummarizeRepo(server: McpServer, githubService: GitHubService): void {
  (server as any).registerTool(
    'summarize_repo',
    {
      title: 'Summarize GitHub Repository',
      description:
        'Summarize recent commits and open issue count for a GitHub repository. Use this when the user asks what happened in repo, summarize repository, or show recent commits.',
      inputSchema: summarizeRepoSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ repo }: { repo: string }) => {
      try {
        const result = await githubService.summarizeRepo(repo);

        if ('isError' in result && result.isError) {
          return {
            content: [{ type: 'text', text: speakable(result.message) }],
            isError: true,
          };
        }

        const summary = result as import('../services/github.js').RepoSummary;
        const commitsText =
          summary.commits.length > 0
            ? `Recent commits: ${summary.commits.map((c: string) => speakable(c, 50)).join(', ')}.`
            : 'No recent commits found.';

        const issueLabel =
          summary.openIssuesCount === 1 ? '1 open issue' : `${summary.openIssuesCount} open issues`;

        const speech = speakable(
          `Repository ${summary.repo} has ${issueLabel}. ${commitsText}`,
          300
        );

        return {
          content: [{ type: 'text', text: speech }],
        };
      } catch (err: unknown) {
        return {
          content: [
            {
              type: 'text',
              text: speakable(`Could not summarize repository ${repo}: ${(err as Error).message}`),
            },
          ],
          isError: true,
        };
      }
    }
  );
}

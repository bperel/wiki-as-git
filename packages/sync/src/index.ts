/**
 * Sync package: Wikipedia + GitHub logic for Netlify Functions.
 * Token is read from env (GITHUB_TOKEN), not from client.
 */

import { getCommitMetadata, sanitizeArticleName, parseWikiAsGitPath } from "core";
import { fetchArticleRevisions } from "./wikipedia-api.js";
import {
  ensureRepoExists,
  listCommitsForPath,
  pushCommitHistory,
  type GitHubConfig,
} from "./github-api.js";

export interface SyncResult {
  success: boolean;
  repoUrl?: string;
  error?: string;
}

export interface SyncOptions {
  owner: string;
  token: string;
  branch?: string;
}

/**
 * Sync a Wikipedia article's history to GitHub.
 * Used by the Netlify Function.
 */
export async function syncArticleToGitHub(
  pathname: string,
  options: SyncOptions,
): Promise<SyncResult> {
  const parsed = parseWikiAsGitPath(pathname);
  if (!parsed) {
    return { success: false, error: `Invalid path: ${pathname}` };
  }

  const { language, articleName, repoName } = parsed;
  const config: GitHubConfig = {
    owner: options.owner,
    repo: repoName,
    token: options.token,
    branch: options.branch ?? "master",
  };

  try {
    const revisions = await fetchArticleRevisions(articleName, language);

    if (revisions.length === 0) {
      return { success: false, error: "No revisions found for article" };
    }

    const fileName = `${sanitizeArticleName(articleName)}.wiki`;
    const allCommits: Array<{
      message: string;
      content: string;
      fileName: string;
      authorName: string;
      authorEmail: string;
      timestamp: string;
    }> = [];

    for (const { revision, articleName: name } of revisions) {
      const meta = getCommitMetadata(revision, name, language);
      if (meta) {
        allCommits.push({
          message: meta.message,
          content: meta.content,
          fileName,
          authorName: meta.authorName,
          authorEmail: meta.authorEmail,
          timestamp: meta.timestamp,
        });
      }
    }

    await ensureRepoExists(config);

    const existing = await listCommitsForPath(config, fileName);
    const existingKeys = new Set(
      existing.map((c) => `${c.date}:${c.message.substring(0, 100)}`),
    );
    const commits = allCommits.filter(
      (c) => !existingKeys.has(`${c.timestamp}:${c.message}`),
    );

    if (commits.length === 0 && allCommits.length > 0) {
      return {
        success: true,
        repoUrl: `https://github.com/${config.owner}/${config.repo}/blob/${config.branch}/${encodeURIComponent(fileName)}`,
      };
    }

    if (commits.length === 0) {
      return { success: false, error: "No valid revisions to commit" };
    }

    await pushCommitHistory(commits, config);

    return {
      success: true,
      repoUrl: `https://github.com/${config.owner}/${config.repo}/blob/${config.branch}/${encodeURIComponent(fileName)}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export { parseWikiAsGitPath } from "core";

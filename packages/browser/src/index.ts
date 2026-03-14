/**
 * wiki-as-git-browser: Sync Wikipedia article history to GitHub.
 *
 * When a visitor goes to wiki-as-git.github.io/en.wikipedia.org/blob/master/Game Boy.wiki,
 * this package fetches the Wikipedia revision history, creates Git commits,
 * and pushes them to https://github.com/wiki-as-git/en.wikipedia.org
 */

import { fetchArticleRevisions } from "./wikipedia-api.js";
import {
  ensureRepoExists,
  type GitHubConfig,
  listCommitsForPath,
  pushCommitHistory,
} from "./github-api.js";
import {
  getCommitMetadata,
  sanitizeArticleName,
} from "../../core/src/types.js";

export interface SyncOptions {
  /** GitHub owner (e.g. "wiki-as-git") */
  owner: string;
  /** GitHub token with repo scope */
  token: string;
  /** Branch to push to (default: "master") */
  branch?: string;
  /** Progress callback: (phase, current, total?) */
  onProgress?: (phase: string, current: number, total?: number) => void;
}

export interface ParsedPath {
  /** e.g. "en" */
  language: string;
  /** e.g. "Game Boy" */
  articleName: string;
  /** e.g. "en.wikipedia.org" */
  repoName: string;
}

/**
 * Parse a path like "en.wikipedia.org/blob/master/Game Boy.wiki"
 * into language, article name, and repo name.
 */
export function parseWikiAsGitPath(pathname: string): ParsedPath | null {
  // Match: {lang}.wikipedia.org/blob/{branch}/{Article Name}.wiki
  const match = pathname.match(
    /^\/?([a-z]{2,})\.wikipedia\.org\/blob\/(?:[^/]+)\/(.+)\.wiki$/i,
  );
  if (!match) return null;

  const [, lang, filePart] = match;
  const articleName = decodeURIComponent(filePart).replace(/_/g, " ");
  const repoName = `${lang}.wikipedia.org`;

  return { language: lang, articleName, repoName };
}

/**
 * Sync a Wikipedia article's history to GitHub.
 * Creates the repo if it doesn't exist, then pushes all revisions as commits.
 */
export async function syncArticleToGitHub(
  pathname: string,
  options: SyncOptions,
): Promise<{ success: boolean; repoUrl?: string; error?: string }> {
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
    options.onProgress?.("fetch", 0);

    const revisions = await fetchArticleRevisions(
      articleName,
      language,
      (n) => options.onProgress?.("fetch", n),
    );

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

    // Incremental sync: skip commits that already exist (match by date + message)
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
        repoUrl:
          `https://github.com/${config.owner}/${config.repo}/blob/${config.branch}/${
            encodeURIComponent(fileName)
          }`,
      };
    }

    if (commits.length === 0) {
      return { success: false, error: "No valid revisions to commit" };
    }

    await pushCommitHistory(
      commits,
      config,
      (current, total) => options.onProgress?.("push", current, total),
    );

    const repoUrl =
      `https://github.com/${config.owner}/${config.repo}/blob/${config.branch}/${
        encodeURIComponent(fileName)
      }`;
    return { success: true, repoUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export { fetchArticleRevisions } from "./wikipedia-api.js";
export {
  ensureRepoExists,
  type GitHubConfig,
  pushCommitHistory,
  repoExists,
} from "./github-api.js";

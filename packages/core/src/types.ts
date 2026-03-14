/**
 * Shared types for wiki-as-git packages.
 * Reused by both Node (wiki-as-git) and browser (wiki-as-git-browser) packages.
 */

export const COMMIT_MESSAGE_LENGTH = 100;

export const sanitizeArticleName = (articleName: string) =>
  articleName.replace(/[<>:"/\\|?*]/g, "_");

/** Revision from Wikipedia API (browser or mwn) */
export interface ApiRevision {
  revid?: number;
  parentid?: number;
  timestamp: string;
  user?: string;
  comment?: string;
  slots?: { main?: { content?: string } };
}

/** Revision with article context */
export interface RevisionWithArticle {
  revision: ApiRevision;
  articleName: string;
}

/** Commit metadata derived from a revision */
export interface CommitMetadata {
  message: string;
  authorName: string;
  authorEmail: string;
  timestamp: string; // ISO 8601
  content: string;
}

export function getCommitMetadata(
  revision: ApiRevision,
  _articleName: string,
  language: string,
): CommitMetadata | null {
  const content =
    revision.slots?.main?.content ??
    (revision as { content?: string }).content ??
    "";
  const timestamp = revision.timestamp;
  const username = revision.user ?? "[Deleted user]";

  if (!timestamp || !content || typeof content !== "string") {
    return null;
  }

  const rawMessage = revision.comment ?? "";
  const message =
    rawMessage.substring(0, COMMIT_MESSAGE_LENGTH) || "\n";

  return {
    message,
    authorName: username,
    authorEmail: `${username}@${language}.wikipedia.org`,
    timestamp,
    content,
  };
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
 * Parse a path into language, article name, and repo name.
 * Format: /fr.wikipedia.org/Game Boy (no blob/master, no .wiki)
 */
export function parseWikiAsGitPath(pathname: string): ParsedPath | null {
  const match = pathname.match(
    /^\/?([a-z]{2,})\.wikipedia\.org\/(.+)$/i,
  );
  if (!match) return null;

  const [, lang, filePart] = match;
  const articleName = decodeURIComponent(filePart).replace(/_/g, " ").trim();
  if (!articleName) return null;

  return { language: lang, articleName, repoName: `${lang}.wikipedia.org` };
}

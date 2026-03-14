/**
 * Browser-compatible Wikipedia/MediaWiki API client.
 * Fetches revision history using fetch() - no Node dependencies.
 */

import type { ApiRevision, RevisionWithArticle } from "../../core/src";

const RV_LIMIT = 500; // max per request

interface MwRevision {
  revid: number;
  parentid?: number;
  timestamp: string;
  user?: string;
  comment?: string;
  slots?: { main?: { content?: string } };
}

interface MediaWikiApiResponse {
  continue?: { rvcontinue?: string };
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    pages?: Array<{
      pageid: number;
      ns: number;
      title: string;
      revisions?: MwRevision[];
    }>;
  };
}

function toApiRevision(r: MwRevision): ApiRevision {
  return {
    revid: r.revid,
    parentid: r.parentid,
    timestamp: r.timestamp,
    user: r.user,
    comment: r.comment,
    slots: r.slots ? { main: { content: r.slots.main?.content } } : undefined,
  };
}

/**
 * Fetch all revisions for an article from the Wikipedia API.
 * Uses rvdir=newer to get chronological order (oldest first).
 */
export async function fetchArticleRevisions(
  articleName: string,
  language: string,
  onProgress?: (fetched: number) => void,
): Promise<RevisionWithArticle[]> {
  const apiUrl = `https://${language}.wikipedia.org/w/api.php`;
  const results: RevisionWithArticle[] = [];
  let rvcontinue: string | undefined;

  do {
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      titles: articleName.replace(/ /g, "_"),
      rvprop: "timestamp|user|comment|ids|content",
      rvslots: "main",
      rvlimit: String(RV_LIMIT),
      rvdir: "newer",
      format: "json",
      formatversion: "2",
      origin: "*",
    });
    if (rvcontinue) {
      params.set("rvcontinue", rvcontinue);
    }

    const url = `${apiUrl}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Wikipedia API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as MediaWikiApiResponse;
    rvcontinue = data.continue?.rvcontinue;

    const pages = data.query?.pages ?? [];
    for (const page of pages) {
      const revs = page.revisions ?? [];
      for (const r of revs) {
        results.push({
          revision: toApiRevision(r),
          articleName: page.title,
        });
      }
    }

    onProgress?.(results.length);
  } while (rvcontinue);

  return results;
}

/**
 * Fetch revision content for revisions that don't have it.
 * The initial request may omit content to reduce payload; this fetches it.
 */
export async function fetchRevisionContent(
  articleName: string,
  language: string,
  revIds: number[],
): Promise<Map<number, string>> {
  if (revIds.length === 0) return new Map();

  const apiUrl = `https://${language}.wikipedia.org/w/api.php`;
  const revids = revIds.join("|");
  const params = new URLSearchParams({
    action: "query",
    prop: "revisions",
    revids,
    rvprop: "ids|content",
    rvslots: "main",
    format: "json",
    formatversion: "2",
    origin: "*",
  });

  const res = await fetch(`${apiUrl}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Wikipedia API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as MediaWikiApiResponse;
  const contentMap = new Map<number, string>();

  for (const page of data.query?.pages ?? []) {
    for (const r of page.revisions ?? []) {
      const content = r.slots?.main?.content ?? "";
      if (r.revid) contentMap.set(r.revid, content);
    }
  }

  return contentMap;
}

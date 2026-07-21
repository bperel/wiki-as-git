/**
 * Wikipedia/MediaWiki API client.
 * Uses fetch() - works in Node 18+ (Netlify Functions) and browser.
 */

import type { RevisionWithArticle } from "core";

const RV_LIMIT = 500;

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
    pages?: Array<{
      pageid: number;
      ns: number;
      title: string;
      revisions?: MwRevision[];
    }>;
  };
}

const toApiRevision = (r: MwRevision) => ({
  revid: r.revid,
  parentid: r.parentid,
  timestamp: r.timestamp,
  user: r.user,
  comment: r.comment,
  slots: r.slots ? { main: { content: r.slots.main?.content } } : undefined,
});

export const fetchArticleRevisions = async (
  articleName: string,
  language: string,
  onProgress?: (fetched: number) => void,
): Promise<RevisionWithArticle[]> => {
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
    if (rvcontinue) params.set("rvcontinue", rvcontinue);

    const res = await fetch(`${apiUrl}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Wikipedia API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as MediaWikiApiResponse;
    rvcontinue = data.continue?.rvcontinue;

    for (const page of data.query?.pages ?? []) {
      for (const r of page.revisions ?? []) {
        results.push({
          revision: toApiRevision(r),
          articleName: page.title,
        });
      }
    }

    onProgress?.(results.length);
    if (rvcontinue) {
      console.log(
        `[${new Date().toISOString()}] sync: Wikipedia batch fetched ${results.length} revisions so far`,
      );
    }
  } while (rvcontinue);

  return results;
};

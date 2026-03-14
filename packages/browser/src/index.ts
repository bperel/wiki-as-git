/**
 * wiki-as-git browser: Frontend that calls the sync API (Netlify Function).
 * No token required - the backend holds it.
 */

import { parseWikiAsGitPath } from "core";

export { parseWikiAsGitPath };
export type { ParsedPath } from "core";

export interface SyncResult {
  success: boolean;
  repoUrl?: string;
  error?: string;
}

/**
 * Trigger sync via the Netlify Function.
 * The API URL is relative (/.netlify/functions/sync) so it works on Netlify.
 */
export async function syncArticleToGitHub(
  pathname: string,
  options?: { apiBase?: string },
): Promise<SyncResult> {
  const parsed = parseWikiAsGitPath(pathname);
  if (!parsed) {
    return { success: false, error: `Invalid path: ${pathname}` };
  }

  const apiBase = options?.apiBase ?? "";
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;

  const res = await fetch(`${apiBase}/.netlify/functions/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });

  const data = (await res.json()) as SyncResult;
  if (!res.ok) {
    return { success: false, error: data.error ?? `HTTP ${res.status}` };
  }
  return data;
}

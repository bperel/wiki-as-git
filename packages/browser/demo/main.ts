import { syncArticleToGitHub, parseWikiAsGitPath } from "../src/index.ts";

declare global {
  interface Window {
    WikiAsGit?: {
      syncArticleToGitHub: typeof syncArticleToGitHub;
      parseWikiAsGitPath: typeof parseWikiAsGitPath;
    };
  }
}

window.WikiAsGit = { syncArticleToGitHub, parseWikiAsGitPath };

const statusEl = document.getElementById("status") as HTMLDivElement;

const path = window.location.pathname + (window.location.search || "");
const parsed = parseWikiAsGitPath(path.startsWith("/") ? path : "/" + path);

if (!parsed) {
  statusEl.textContent =
    "Visit a path like /en.wikipedia.org/Game Boy to sync that article's history to GitHub.";
  statusEl.className = "info";
} else {
  statusEl.textContent = `Syncing ${parsed.articleName} to GitHub...`;
  statusEl.className = "info";

  syncArticleToGitHub(path.startsWith("/") ? path : "/" + path)
    .then((result) => {
      if (result.success && result.repoUrl) {
        window.location.href = result.repoUrl;
      } else {
        statusEl.textContent = result.error ?? "Unknown error";
        statusEl.className = "error";
      }
    })
    .catch((err) => {
      statusEl.textContent = err instanceof Error ? err.message : String(err);
      statusEl.className = "error";
    });
}

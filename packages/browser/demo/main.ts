import { syncArticleToGitHub, parseWikiAsGitPath } from "../src/index.ts";

declare global {
  interface Window {
    WikiAsGit?: { syncArticleToGitHub: typeof syncArticleToGitHub; parseWikiAsGitPath: typeof parseWikiAsGitPath };
  }
}

window.WikiAsGit = { syncArticleToGitHub, parseWikiAsGitPath };

const pathInput = document.getElementById("path") as HTMLInputElement;
const tokenInput = document.getElementById("token") as HTMLInputElement;
const syncBtn = document.getElementById("sync") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

if (typeof window !== "undefined" && window.location.pathname.length > 1 && window.location.pathname !== "/") {
  pathInput.value = window.location.pathname + (window.location.search || "");
}

syncBtn.addEventListener("click", async () => {
  const path = pathInput.value.trim();
  const token = tokenInput.value.trim();
  if (!token) {
    statusEl.textContent = "Please enter a GitHub token";
    statusEl.className = "error";
    return;
  }
  const parsed = parseWikiAsGitPath(path.startsWith("/") ? path : "/" + path);
  if (!parsed) {
    statusEl.textContent = "Invalid path. Expected: /en.wikipedia.org/blob/master/Article Name.wiki";
    statusEl.className = "error";
    return;
  }

  syncBtn.disabled = true;
  statusEl.textContent = `Fetching ${parsed.articleName} from Wikipedia...`;
  statusEl.className = "info";

  try {
    const result = await syncArticleToGitHub(path.startsWith("/") ? path : "/" + path, {
      owner: "wiki-as-git",
      token,
      onProgress: (phase, current, total) => {
        if (phase === "fetch") statusEl.textContent = `Fetched ${current} revisions...`;
        else if (phase === "push") statusEl.textContent = `Pushing commit ${current}/${total}...`;
      },
    });

    if (result.success) {
      statusEl.innerHTML = `Done! <a href="${result.repoUrl}">View on GitHub</a>`;
      statusEl.className = "success";
    } else {
      statusEl.textContent = result.error ?? "Unknown error";
      statusEl.className = "error";
    }
  } catch (err) {
    statusEl.textContent = err instanceof Error ? err.message : String(err);
    statusEl.className = "error";
  } finally {
    syncBtn.disabled = false;
  }
});

/**
 * GitHub API client for creating repos and pushing Git history.
 * Node-compatible (uses Buffer for base64).
 */

const GITHUB_API = "https://api.github.com";

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  branch?: string;
}

interface GitHubError {
  message: string;
  documentation_url?: string;
}

async function ghFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });
}

async function ghJson<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await ghFetch(path, token, options);
  const data = await res.json();
  if (!res.ok) {
    const err = data as GitHubError;
    throw new Error(err.message ?? `GitHub API error: ${res.status}`);
  }
  return data as T;
}

export async function repoExists(
  owner: string,
  repo: string,
  token: string,
): Promise<boolean> {
  const res = await ghFetch(`/repos/${owner}/${repo}`, token);
  return res.ok;
}

export async function ensureRepoExists(config: GitHubConfig): Promise<void> {
  const { owner, repo, token } = config;
  if (await repoExists(owner, repo, token)) return;

  const body = {
    name: repo,
    private: false,
    auto_init: false, // We push full history via git push; no initial commit needed
    description: "Wikipedia articles as Git history",
  };
  const orgRes = await ghFetch(`/orgs/${owner}`, token);
  if (orgRes.ok) {
    await ghJson(`/orgs/${owner}/repos`, token, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } else {
    await ghJson(`/user/repos`, token, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}

/** Create a blob - Node-compatible base64 */
function createBlob(content: string, config: GitHubConfig): Promise<string> {
  const { owner, repo, token } = config;
  const encoded = Buffer.from(content, "utf8").toString("base64");
  return ghJson<{ sha: string }>(
    `/repos/${owner}/${repo}/git/blobs`,
    token,
    { method: "POST", body: JSON.stringify({ content: encoded, encoding: "base64" }) },
  ).then((r) => r.sha);
}

async function createTree(
  entries: Array<{ path: string; mode: string; type: string; sha: string }>,
  config: GitHubConfig,
  baseTreeSha?: string,
): Promise<string> {
  const { owner, repo, token } = config;
  const tree = entries.map((e) => ({ path: e.path, mode: e.mode, type: e.type, sha: e.sha }));
  const body: { tree: typeof tree; base_tree?: string } = { tree };
  if (baseTreeSha) body.base_tree = baseTreeSha;

  const res = await ghJson<{ sha: string }>(
    `/repos/${owner}/${repo}/git/trees`,
    token,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.sha;
}

async function createCommit(
  message: string,
  treeSha: string,
  parentSha: string | null,
  author: { name: string; email: string; date: string },
  config: GitHubConfig,
): Promise<string> {
  const { owner, repo, token } = config;
  const body = {
    message,
    tree: treeSha,
    parents: parentSha ? [parentSha] : [],
    author,
    committer: author,
  };
  const res = await ghJson<{ sha: string }>(
    `/repos/${owner}/${repo}/git/commits`,
    token,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.sha;
}

async function getCommitTreeSha(commitSha: string, config: GitHubConfig): Promise<string> {
  const { owner, repo, token } = config;
  const data = await ghJson<{ tree?: { sha?: string } }>(
    `/repos/${owner}/${repo}/git/commits/${commitSha}`,
    token,
  );
  return data.tree?.sha ?? "";
}

async function getRefSha(ref: string, config: GitHubConfig): Promise<string | null> {
  const { owner, repo, token } = config;
  const res = await ghFetch(`/repos/${owner}/${repo}/git/ref/${ref}`, token);
  if (res.status === 404) return null;
  const data = (await res.json()) as { object?: { sha?: string } };
  return data.object?.sha ?? null;
}

async function updateRef(
  ref: string,
  sha: string,
  config: GitHubConfig,
  refExists?: boolean,
): Promise<void> {
  const { owner, repo, token } = config;
  const exists = refExists ?? (await getRefSha(ref, config)) !== null;
  if (exists) {
    await ghJson(`/repos/${owner}/${repo}/git/refs/${ref}`, token, {
      method: "PATCH",
      body: JSON.stringify({ sha, force: true }),
    });
  } else {
    await ghJson(`/repos/${owner}/${repo}/git/refs`, token, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/${ref}`, sha }),
    });
  }
}

export async function listCommitsForPath(
  config: GitHubConfig,
  path: string,
  maxCount = 500,
): Promise<Array<{ sha: string; message: string; date: string }>> {
  const { owner, repo, token } = config;
  const branch = config.branch ?? "master";
  try {
    const res = await ghFetch(
      `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}&per_page=${maxCount}`,
      token,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      sha: string;
      commit?: { message?: string; author?: { date?: string } };
    }>;
    return data.map((c) => ({
      sha: c.sha,
      message: c.commit?.message ?? "",
      date: c.commit?.author?.date ?? "",
    }));
  } catch {
    return [];
  }
}

export interface CommitInput {
  message: string;
  content: string;
  fileName: string;
  authorName: string;
  authorEmail: string;
  timestamp: string;
}

/** Bootstrap empty repo using Contents API (Git Data API fails for empty repos) */
async function createInitialCommitViaContents(
  filePath: string,
  content: string,
  message: string,
  config: GitHubConfig,
): Promise<string> {
  const { owner, repo, token } = config;
  const branch = config.branch ?? "master";
  const encoded = Buffer.from(content, "utf8").toString("base64");
  const res = await ghJson<{ commit?: { sha?: string } }>(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: encoded,
        branch,
      }),
    },
  );
  return res.commit?.sha ?? "";
}

export async function pushCommitHistory(
  commits: CommitInput[],
  config: GitHubConfig,
  onProgress?: (index: number, total: number) => void,
): Promise<string> {
  const branch = config.branch ?? "master";
  const ref = `heads/${branch}`;

  await ensureRepoExists(config);

  let parentSha: string | null = await getRefSha(ref, config);

  const totalCommits = commits.length;
  let bootstrapped = false;

  // Empty repo: Git Data API returns "Git Repository is empty". Use Contents API for first commit.
  if (parentSha === null && commits.length > 0) {
    const first = commits[0];
    console.log(`[${new Date().toISOString()}] sync: empty repo - bootstrapping via Contents API`);
    parentSha = await createInitialCommitViaContents(
      first.fileName,
      first.content,
      first.message,
      config,
    );
    bootstrapped = true;
    onProgress?.(1, totalCommits);
    if (commits.length === 1) return parentSha;
    commits = commits.slice(1);
  }

  let refExists = parentSha !== null; // After bootstrap or existing repo, ref exists
  for (let i = 0; i < commits.length; i++) {
    const c = commits[i];
    const done = i + 1 + (bootstrapped ? 1 : 0);
    onProgress?.(done, totalCommits);
    if ((i + 1) % 50 === 0 || i === 0) {
      console.log(`[${new Date().toISOString()}] sync: pushed ${done}/${totalCommits} commits`);
    }

    const blobSha = await createBlob(c.content, config);
    const baseTree = parentSha ? await getCommitTreeSha(parentSha, config) : undefined;
    const treeSha = await createTree(
      [{ path: c.fileName, mode: "100644", type: "blob", sha: blobSha }],
      config,
      baseTree || undefined,
    );
    parentSha = await createCommit(
      c.message,
      treeSha,
      parentSha,
      {
        name: c.authorName,
        email: c.authorEmail,
        date: c.timestamp,
      },
      config,
    );
    // Update ref after each commit so the next can reference it (GitHub returns
    // "Git Repository is empty" when fetching unreferenced commits)
    if (parentSha) {
      await updateRef(ref, parentSha, config, refExists);
      refExists = true; // Skip getRefSha check for subsequent commits
    }
  }

  return parentSha ?? "";
}

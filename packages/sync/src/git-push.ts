/**
 * Build a Git repo in a temp dir and push to GitHub via git push.
 * Uses isomorphic-git for a single push of the full history (no per-commit REST calls).
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import dayjs from "dayjs";
import type { GitHubConfig } from "./github-api.js";

export interface CommitInput {
  message: string;
  content: string;
  fileName: string;
  authorName: string;
  authorEmail: string;
  timestamp: string;
}

/**
 * Build the full commit history in a temp dir and push to GitHub in one operation.
 */
export const pushViaGit = async (
  commits: CommitInput[],
  config: GitHubConfig,
  onProgress?: (index: number, total: number) => void,
) => {
  const branch = config.branch ?? "master";
  const total = commits.length;
  if (total === 0) return;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-as-git-"));
  try {
    await git.init({ fs, dir: tmpDir });

    for (let i = 0; i < commits.length; i++) {
      const c = commits[i];
      onProgress?.(i + 1, total);
      if ((i + 1) % 50 === 0 || i === 0) {
        console.log(
          `[${new Date().toISOString()}] sync: built ${i + 1}/${total} commits`,
        );
      }

      const filePath = path.join(tmpDir, c.fileName);
      fs.writeFileSync(filePath, c.content);
      await git.add({ fs, dir: tmpDir, filepath: c.fileName });

      const unixTime = dayjs(c.timestamp).unix();
      const author = {
        name: c.authorName,
        email: c.authorEmail,
        timestamp: unixTime,
      };
      await git.commit({
        fs,
        dir: tmpDir,
        message: c.message,
        author,
        committer: author,
      });
    }

    const url = `https://github.com/${config.owner}/${config.repo}.git`;
    await git.addRemote({ fs, dir: tmpDir, remote: "origin", url });

    console.log(
      `[${new Date().toISOString()}] sync: pushing ${total} commits via git push`,
    );
    const result = await git.push({
      fs,
      http,
      dir: tmpDir,
      remote: "origin",
      ref: branch,
      force: true,
      onAuth: () => ({
        username: "x-access-token",
        password: config.token,
      }),
    });

    if (!result.ok) {
      throw new Error(result.error ?? "git push failed");
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};

#!/usr/bin/env node
/**
 * Run sync locally. Load GITHUB_TOKEN from packages/sync/.env
 *
 * Usage: pnpm run run:local [path]
 * Example: pnpm run run:local "/fr.wikipedia.org/Game Boy"
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { syncArticleToGitHub } from "./dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env") });

const path = process.argv[2] ?? "/fr.wikipedia.org/Game Boy";
const token = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER ?? "wiki-as-git";

if (!token) {
  console.error("GITHUB_TOKEN required.");
  console.error("Add it to packages/sync/.env:");
  console.error("  GITHUB_TOKEN=ghp_your_token_here");
  console.error("");
  console.error("Or run with env: GITHUB_TOKEN=ghp_xxx pnpm run run:local");
  process.exit(1);
}

console.log(`Syncing ${path} to ${owner}...`);
const result = await syncArticleToGitHub(path, { owner, token, branch: "master" });

if (result.success) {
  console.log("Done:", result.repoUrl);
} else {
  console.error("Error:", result.error);
  process.exit(1);
}

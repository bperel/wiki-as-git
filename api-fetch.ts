import { Mwn } from "mwn";
import * as fs from "fs";
import git from "isomorphic-git";
import dayjs from "dayjs";
import { join } from "path";
import {
  createCommitForRevision,
  getRepoDir,
  ensureRepoInitialized,
  RevisionWithArticle,
  sanitizeArticleName,
} from "./wiki-as-git";

const readExistingCommits = async (dir: string) => {
  const commitMap = new Map<
    string,
    { timestamp: number; articleName: string }
  >();
  try {
    const commits = await git.log({ fs, dir, depth: 10000 });
    for (const commit of commits) {
      const timestamp = commit.commit.committer.timestamp;
      const message = commit.commit.message;
      const key = `${timestamp}:${message}`;
      commitMap.set(key, { timestamp, articleName: "" });
    }
  } catch (err) {
    void err;
  }
  return commitMap;
};

const rebuildRepoWithMergedHistory = async (
  dir: string,
  language: string,
  newRevisions: RevisionWithArticle[],
) => {
  console.debug(
    `Rebuilding repository with ${newRevisions.length} new revisions`,
  );

  const otherArticles = new Map<string, string>();
  const updatingArticleName = sanitizeArticleName(
    newRevisions[0]?.articleName || "",
  );

  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.endsWith(".wiki") && file !== ".wiki") {
        const filePath = join(dir, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile() && file !== `${updatingArticleName}.wiki`) {
            otherArticles.set(file, fs.readFileSync(filePath, "utf-8"));
          }
        } catch (err) {
          void err;
        }
      }
    }
  }

  const existingCommits = await readExistingCommits(dir);
  const allRevisions: RevisionWithArticle[] = [];

  for (const revData of newRevisions) {
    const timestamp = dayjs(revData.revision.timestamp).unix();
    const message = (revData.revision.comment || "").substring(0, 100) || "\n";
    const key = `${timestamp}:${message}`;

    if (!existingCommits.has(key)) {
      allRevisions.push(revData);
    }
  }

  if (allRevisions.length === 0) {
    console.info(`No new revisions to add`);
    return;
  }

  allRevisions.sort((a, b) => {
    const dateA = dayjs(a.revision.timestamp).unix();
    const dateB = dayjs(b.revision.timestamp).unix();
    return dateA - dateB;
  });

  for (const revisionData of allRevisions) {
    try {
      for (const [fileName, content] of otherArticles.entries()) {
        const filePath = join(dir, fileName);
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, content);
        }
      }

      await createCommitForRevision(revisionData, dir, language);
    } catch (error) {
      console.error(
        `Error processing revision for article ${revisionData.articleName}:`,
        error,
      );
    }
  }
};

export const fetchFromApi = async (
  articleName: string,
  language: string,
  rvcontinue?: number,
) => {
  const dir = getRepoDir(language);
  await ensureRepoInitialized(dir);

  const mwn = new Mwn({
    apiUrl: `https://${language}.wikipedia.org/w/api.php`,
  });

  await mwn.getSiteInfo();

  console.debug(
    `Retrieving article history for ${articleName} from ${
      rvcontinue || "the beginning of history"
    }`,
  );

  const newRevisions: RevisionWithArticle[] = [];
  try {
    for await (const revision of new mwn.Page(articleName).historyGen(
      ["timestamp", "user", "comment", "content"],
      {
        redirects: true,
        format: "json",
        rvslots: "main",
        rvlimit: "max",
        rvdir: "newer",
      },
    )) {
      newRevisions.push({
        revision,
        articleName,
        isXml: false,
      });
    }
  } catch (err) {
    console.error(err);
    return;
  }

  console.info(`Fetched ${newRevisions.length} revisions for ${articleName}`);

  if (newRevisions.length > 0) {
    await rebuildRepoWithMergedHistory(dir, language, newRevisions);
  }
};

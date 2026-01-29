import { Mwn } from "mwn";
import { resolve } from "path";
import * as fs from "fs";
import git from "isomorphic-git";
import {
  createCommitForRevision,
  sanitizeArticleName,
} from "./wiki-as-git";

export const fetchFromApi = async (
  articleName: string,
  language: string,
  rvcontinue?: number,
) => {
  const sanitizedName = sanitizeArticleName(articleName);
  const fileName = `${sanitizedName}.wiki`;
  const repoDir = `./${language}.wikipedia.org/${sanitizedName}`;
  const dir = resolve(__dirname, "articles", repoDir);

  console.debug("Cleaning previous local repository if existing");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  await git.init({ fs, dir: dir });

  console.debug(`Created empty repository at ${dir}`);

  const mwn = new Mwn({
    apiUrl: `https://${language}.wikipedia.org/w/api.php`,
  });

  console.debug(
    `Retrieving article history from ${
      rvcontinue || "the beginning of history"
    }`,
  );
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
      await createCommitForRevision(revision, dir, fileName, language, false);
    }
  } catch (err) {
    console.error(err);
  }
};

import * as fs from "fs";
import git from "isomorphic-git";
import { XMLParser } from "fast-xml-parser";
import dayjs from "dayjs";
import {
  XmlRevision,
  createCommitForRevision,
  getRepoDir,
} from "./wiki-as-git";

export interface XmlPage {
  title: string;
  ns: string;
  id: string;
  revision: XmlRevision | XmlRevision[];
}

export interface XmlDump {
  mediawiki: {
    siteinfo?: {
      sitename?: string;
      dbname?: string;
      base?: string;
    };
    page?: XmlPage | XmlPage[];
  };
}

export const parseXmlDump = async (xmlPath: string) => {
  console.debug(`Reading XML dump from ${xmlPath}`);
  const xmlContent = fs.readFileSync(xmlPath, "utf-8");

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    parseAttributeValue: true,
    trimValues: true,
  });

  const dump = parser.parse(xmlContent) as XmlDump;
  return dump;
};

export const processXmlDump = async (xmlPath: string) => {
  console.info(`Processing XML dump: ${xmlPath}`);

  const dump = await parseXmlDump(xmlPath);

  let language = dump.mediawiki.siteinfo?.dbname?.replace(/wiki$/i, "") || "en";
  if (language === dump.mediawiki.siteinfo?.dbname) {
    const base = dump.mediawiki.siteinfo?.base;
    if (base) {
      const match = base.match(/https:\/\/([^.]+)\.wikipedia\.org/);
      if (match) {
        language = match[1];
      }
    }
  }
  console.info(`Detected language: ${language}`);

  const pages = Array.isArray(dump.mediawiki.page)
    ? dump.mediawiki.page
    : dump.mediawiki.page
    ? [dump.mediawiki.page]
    : [];

  console.info(`Found ${pages.length} pages in dump`);

  const dir = getRepoDir(language);

  console.info(`Replacing Git repository at ${dir}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  await git.init({ fs, dir });

  console.debug(`Created empty repository at ${dir}`);

  const allRevisions: Array<{
    revision: XmlRevision;
    articleName: string;
  }> = [];

  for (const page of pages) {
    const articleName = page.title;
    const revisions = Array.isArray(page.revision)
      ? page.revision
      : page.revision
      ? [page.revision]
      : [];

    if (revisions.length === 0) {
      console.warn(
        `No revisions found for article: ${articleName}, skipping`,
      );
      continue;
    }

    for (const revision of revisions) {
      allRevisions.push({ revision, articleName });
    }
  }

  console.info(
    `Collected ${allRevisions.length} revisions from ${pages.length} articles`,
  );

  allRevisions.sort((a, b) => {
    const dateA = dayjs(a.revision.timestamp).unix();
    const dateB = dayjs(b.revision.timestamp).unix();
    return dateA - dateB;
  });

  console.info(`Processing revisions chronologically...`);

  for (const { revision, articleName } of allRevisions) {
    try {
      await createCommitForRevision(
        { revision, articleName, isXml: true },
        dir,
        language,
      );
    } catch (error) {
      console.error(
        `Error processing revision for article ${articleName}:`,
        error,
      );
    }
  }

  console.info(`Completed processing all articles from XML dump`);
};

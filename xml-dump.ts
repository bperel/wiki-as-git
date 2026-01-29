import { resolve } from "path";
import * as fs from "fs";
import git from "isomorphic-git";
import { XMLParser } from "fast-xml-parser";
import dayjs from "dayjs";
import {
  XmlRevision,
  createCommitForRevision,
  sanitizeArticleName,
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

  for (const page of pages) {
    const articleName = page.title;
    const sanitizedName = sanitizeArticleName(articleName);
    const fileName = `${sanitizedName}.wiki`;
    const repoDir = `./${language}.wikipedia.org/${sanitizedName}`;
    const dir = resolve(__dirname, "articles", repoDir);

    console.info(`Processing article: ${articleName}`);

    try {
      console.debug(
        `Cleaning previous local repository if existing for ${articleName}`,
      );
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      await git.init({ fs, dir: dir });

      console.debug(`Created empty repository at ${dir}`);

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

      revisions.sort((a, b) => {
        const dateA = dayjs(a.timestamp).unix();
        const dateB = dayjs(b.timestamp).unix();
        return dateA - dateB;
      });

      console.info(
        `Processing ${revisions.length} revisions for ${articleName}`,
      );

      for (const revision of revisions) {
        await createCommitForRevision(revision, dir, fileName, language, true);
      }

      console.info(`Completed processing ${articleName}`);
    } catch (error) {
      console.error(`Error processing article ${articleName}:`, error);
    }
  }

  console.info(`Completed processing all articles from XML dump`);
};

import { Mwn, ApiRevision } from "mwn";
import { join, resolve } from "path";
import * as fs from "fs";
import git from "isomorphic-git";
import { ArgumentParser } from "argparse";
import dayjs from "dayjs";
import { fetchFromApi } from "./api-fetch";
import { processXmlDump } from "./xml-dump";

const { name } = JSON.parse(fs.readFileSync("./package.json").toString());

export const defaults = {
  commitMessageLength: 100,
};

export const sanitizeArticleName = (articleName: string) =>
  articleName.replace(/[<>:"/\\|?*]/g, "_");

export interface XmlRevision {
  id: string;
  parentid?: string;
  timestamp: string;
  contributor?: {
    username?: string;
    id?: string;
  };
  comment?: string;
  text?: { "#text"?: string };
  sha1?: string;
}

export const isXmlRevision = (
  revision: ApiRevision | XmlRevision,
): revision is XmlRevision => "text" in revision;

export interface RevisionWithArticle {
  revision: ApiRevision | XmlRevision;
  articleName: string;
  isXml: boolean;
}

export const createCommitForRevision = async (
  revisionData: RevisionWithArticle,
  dir: string,
  language: string,
) => {
  const { revision, articleName } = revisionData;
  const sanitizedName = sanitizeArticleName(articleName);
  const fileName = `${sanitizedName}.wiki`;

  let fileContent: string | undefined;
  let username: string;
  const timestamp = revision.timestamp;
  const rawMessage = revision.comment || "";

  if (isXmlRevision(revision)) {
    fileContent = revision.text?.["#text"] || "";
    username = revision.contributor?.username || "[Deleted user]";
  } else {
    fileContent = revision.slots!.main.content || "";
    username = revision.user || "[Deleted user]";
  }

  if (!timestamp) {
    console.debug("No date for this revision, skipping");
    return;
  }

  if (!fileContent || typeof fileContent !== "string") {
    console.debug("No valid content for this revision, skipping");
    return;
  }

  const message = rawMessage.substring(0, defaults.commitMessageLength) || "\n";
  console.debug(`Creating commit for ${articleName} from ${timestamp}`);

  fs.writeFileSync(join(dir, fileName), fileContent);
  await git.add({ fs, dir, filepath: fileName });

  const committer = {
    name: username,
    email: `${username}@${language}.wikipedia.org`,
    timestamp: dayjs(timestamp).unix(),
  };
  const author = committer;

  await git.commit({ fs, dir, message, committer, author });
};

export const getRepoDir = (language: string) =>
  resolve(__dirname, "articles", `${language}.wikipedia.org`);

export const ensureRepoInitialized = async (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    await git.init({ fs, dir });
    console.debug(`Initialized repository at ${dir}`);
  } else if (!fs.existsSync(join(dir, ".git"))) {
    await git.init({ fs, dir });
    console.debug(`Initialized repository at ${dir}`);
  }
};

let settings: Record<string, string>;
try {
  settings = JSON.parse(fs.readFileSync("./settings.json").toString());
} catch (error) {
  settings = {};
}
const argparser = new ArgumentParser({
  description: name,
});

argparser.add_argument("--language", {
  nargs: 1,
  default: "en",
  help: "The Wikipedia language version to use (ex: en, fr, etc.)",
});
argparser.add_argument("--xml-dump", {
  nargs: 1,
  help: "Path to XML dump file to process",
});
argparser.add_argument("-vvv", { help: "Verbose log", action: "store_true" });
argparser.add_argument("articleName", {
  type: "str",
  nargs: "?",
  help: "The name of the article to retrieve (required when not using --xml-dump)",
});

const args = argparser.parse_args();

if (args.xml_dump) {
  const xmlPath = Array.isArray(args.xml_dump)
    ? args.xml_dump[0]
    : args.xml_dump;
  await processXmlDump(xmlPath);
} else {
  if (!args.articleName) {
    console.error("Error: articleName is required when not using --xml-dump");
    process.exit(1);
  }

  const articleName = Array.isArray(args.articleName)
    ? args.articleName[0]
    : args.articleName;
  const language = Array.isArray(args.language)
    ? args.language[0]
    : args.language || "en";

  const mwn = new Mwn({
    apiUrl: `https://${language}.wikipedia.org/w/api.php`,
  });

  await mwn.getSiteInfo();
  if (!(settings.username && settings.password)) {
    console.info(
      `If you have a bot account on ${mwn.options.apiUrl}, specify its credentials in settings.json to wiki-as-git faster!`,
    );
    await fetchFromApi(articleName, language);
  } else {
    try {
      await mwn.login({
        username: settings.username,
        password: settings.password,
      });
      console.info(
        "Login successful. Note that logging in only allows to make wiki-as-git faster if bot credentials are used",
      );
    } catch (e) {
      console.error(
        "Login failed. Log in with a bot account to make wiki-as-git faster!",
      );
    } finally {
      await fetchFromApi(articleName, language);
    }
  }
}

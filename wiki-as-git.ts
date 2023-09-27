import { Mwn, ApiRevision } from "mwn";
import { resolve, join } from "path";
import * as fs from "fs";
import { createLogger, transports as _transports } from "winston";
import git from "isomorphic-git";

import { ArgumentParser } from "argparse";
import dayjs from 'dayjs';

const { name } = JSON.parse(fs.readFileSync("./package.json").toString())

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
argparser.add_argument("-vvv", { help: "Verbose log", action: "store_true" });
argparser.add_argument("articleName", { type: 'string', nargs: 1, help: "The name of the article to retrieve" });

const args = argparser.parse_args();

const defaults = {
  commitMessageLength: 100,
  logLevel: "info",
};

const log = createLogger({
  transports: [
    new _transports.Console({
      level: args.vvv ? "verbose" : defaults.logLevel,
    }),
  ],
});

const fileName = `${args.articleName}.wiki`;
const repoDir = `./${args.language}.wikipedia.org/${args.articleName}`;
const dir = resolve(__dirname, "articles", repoDir);

let revisions: ApiRevision[] = [];

log.verbose("Cleaning previous local repository if existing");
fs.rmSync(dir, { recursive: true, force: true });

const bot = new Mwn({
  apiUrl: `https://${args.language}.wikipedia.org/w/api.php`,
});

const createCommitForCurrentRevision = async (revision: ApiRevision) => {
  log.verbose(`Creating commit for revision from ${revision.timestamp}`);

  const fileContent = revision.content;
  const message = (revision.comment || "").substr(
    0,
    defaults.commitMessageLength,
  );
  const username = revision.user || "[Deleted user]";
  const date = revision.timestamp;

  fs.writeFileSync(join(dir, fileName), fileContent)
  await git.add({ fs, dir, filepath: fileName })

  const committer = {
    name: username,
    email: `${username}@${args.language}.wikipedia.org`,
    timestamp: dayjs(date).unix(),
  };
  const author = committer

  git.commit({ fs, dir: dir, message, committer, author })

};
const fetchFromApi = async (rvcontinue?: number) => {
  log.verbose(
    `Retrieving article history from ${rvcontinue || "the beginning of history"
    }`,
  );
  try {
    for await (const newRevisions of new bot.Page(args.articleName[0]).historyGen(["timestamp", "user", "comment", "content"], {
      redirects: true,
      format: "json",
      rvslots: ["main"],
      rvlimit: "max",
    })) {
      revisions = revisions.concat(newRevisions);
    }
    revisions = revisions.reverse();
    for (const revision of revisions) {
      createCommitForCurrentRevision(revision);
    }
  }
  catch (err) {
    log.error(err);
  }
};

(async () => {
  fs.mkdirSync(dir, { recursive: true });
  await git.init({ fs, dir: dir })

  log.verbose(`Created empty repository at ${dir}`);

  await bot.getSiteInfo()
  if (!(settings.username && settings.password)) {
    log.info(
      `If you have a bot account on ${bot.options.apiUrl}, specify its credentials in settings.json to wiki-as-git faster!`,
    );
    await fetchFromApi();
  } else {
    try {
      await bot
        .login({
          username: settings.username,
          password: settings.password,
        })
      log.info(
        "Login successful. Note that logging in only allows to make wiki-as-git faster if bot credentials are used",
      );
    }
    catch (e) {
      log.error(
        "Login failed. Log in with a bot account to make wiki-as-git faster!",
      );
    }
    finally {
      await fetchFromApi();
    }
  }
})();

#!/usr/bin/env node

const pjson = require('./package.json');
let settings;
try {
  settings = require('./settings.json');
}
catch(error) {
  settings = {};
}

const mwBot = require('mwbot');
const path = require("path");
const nodegit = require("nodegit");
const promisify = require("promisify-node");
const fse = promisify(require("fs-extra"));
const moment = require("moment");
const winston = require("winston");

const ArgumentParser = require("argparse").ArgumentParser;
const argparser = new ArgumentParser({
  description: pjson.name,
  version: pjson.version
});

argparser.addArgument('--language',{ nargs: 1, defaultValue: 'en', help: 'The Wikipedia language version to use (ex: en, fr, etc.)' });
argparser.addArgument('-vvv',{ nargs: 0, help: 'Verbose log' });
argparser.addArgument('articleName');

const args = argparser.parseArgs();

const defaults = {
  commitMessageLength: 100,
  logLevel: 'info'
};

const log = winston.createLogger({
  transports: [
    new (winston.transports.Console)({level: args.vvv ? 'verbose' : defaults.logLevel})
  ]
});

const fileName = `${args.articleName}.wiki`;
const repoDir = `./${args.language}.wikipedia.org/${args.articleName}`;
const repoPath = path.resolve(__dirname, "articles", repoDir);

let repo;
let revisions = [];
let revisionNumber = 0;

log.verbose("Cleaning previous local repository if existing");
fse.removeSync(repoPath);

let bot = new mwBot({
  apiUrl: `https://${args.language}.wikipedia.org/w/api.php`
});

const createCommitForCurrentRevision = () => {
  log.verbose(`Creating commit for revision ${revisionNumber}`);

  const revision = revisions[revisionNumber];
  const fileContent = revision.slots.main['*'];
  const message = (revision.comment || '').substr(0, defaults.commitMessageLength);
  const author = revision.user || "[Deleted user]";
  const date = revision.timestamp;
  let index, oid;

  promisify(fse.writeFile(path.join(repo.workdir(), fileName), fileContent))
    .then(() => repo.refreshIndex())
    .then(idx => { index = idx; })
    .then(() => index.addByPath(fileName))
    .then(() => index.write())
    .then(() => {
      const timestamp = moment(date, moment.ISO_8601);
      const authorSignature = nodegit.Signature.create(author, `${author}@${args.language}.wikipedia.org`, timestamp.unix(), 60);

      if (revisionNumber === 0) {
        return index.writeTree()
          .then(oid => repo.createCommit("HEAD", authorSignature, authorSignature, message, oid, []))
      }
      else {
        return index.writeTree()
          .then(oidResult => {
             oid = oidResult;
             return nodegit.Reference.nameToId(repo, "HEAD");
          })
          .then(head => repo.getCommit(head))
          .then(parent => repo.createCommit("HEAD", authorSignature, authorSignature, message, oid, [parent]))
      }
    })
    .then(commitId => {
      log.verbose(`New commit created: ${commitId}`);
      revisionNumber++;
      if (revisionNumber < revisions.length) {
        createCommitForCurrentRevision();
      }
      else {
        log.info(`The article's revision history was saved in ${repoPath}`);
      }
    });
};

const fetchFromApi = rvcontinue => {
  log.verbose(`Retrieving article history from ${rvcontinue || 'the beginning of history'}`);
  bot.readWithProps('Wiki Peak', ['timestamp', 'user', 'comment', 'content'].join('|'), true, {
    qs: {
      format: 'json',
      rvlimit: 'max',
      rvslots: '*',
      rvcontinue
    }
  }).then((response) => {
    Object.keys(response.query.pages).forEach(pageId => {
      const page = response.query.pages[pageId];
      if (!(page && page.revisions && page.revisions.length)) {
        log.error(`Invalid response : ${JSON.stringify(page)}`);
        process.exit(1);
      }
      log.verbose(`${page.revisions.length} article revisions have been retrieved`);
      revisions = revisions.concat(page.revisions);

      rvcontinue = (response.continue || {}).rvcontinue || null;
      if (rvcontinue) {
        log.verbose('rvcontinue detected, retrieving next revisions');
        fetchFromApi(rvcontinue);
      }
      else {
        revisions = revisions.reverse();
        createCommitForCurrentRevision();
      }
    });
  }).catch((err) => {
    log.error(err);
  });
};

promisify(fse.ensureDir)(repoPath)
  .then(() => nodegit.Repository.init(repoPath, 0))
  .then(repoCreated => {
    log.verbose(`Created empty repository at ${repoCreated.path()}`);
    repo = repoCreated;

    if (!(settings.username && settings.password)) {
      log.info(`If you have a bot account on ${bot.options.apiUrl}, specify its credentials in settings.json to wiki-as-git faster!`);
      fetchFromApi();
    }
    else {
      bot.loginGetEditToken({
        username: settings.username,
        password: settings.password
      }).then(() => {
        log.info("Login successful. Note that logging in only allows to make wiki-as-git faster if bot credentials are used");
        fetchFromApi();
      }).catch((err) => {
        log.error("Login failed. Log in with a bot account to wiki-as-git faster!");
        fetchFromApi();
      });
    }
  });

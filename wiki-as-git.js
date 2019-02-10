#!/usr/bin/env node

var pjson = require('./package.json');

var path = require("path");
var nodegit = require("nodegit");
var promisify = require("promisify-node");
var fse = promisify(require("fs-extra"));
var https = require("https");
var moment = require("moment");
var winston = require("winston");
var querystring = require("querystring");

var ArgumentParser = require("argparse").ArgumentParser;
var argparser = new ArgumentParser({
  description: pjson.name,
  version: pjson.version
});

argparser.addArgument('--language',{ nargs: 1, defaultValue: 'en', help: 'The Wikipedia language version to use (ex: en, fr, etc.)' });
argparser.addArgument('-vvv',{ nargs: 0, help: 'Verbose log' });
argparser.addArgument('articleName');

var args = argparser.parseArgs();

var defaults = {
    commitMessageLength: 100,
    logLevel: 'info'
};

var log = winston.createLogger({
    transports: [
        new (winston.transports.Console)({ level: args.vvv ? 'verbose': defaults.logLevel })
    ]
});

var fileName = args.articleName + '.wiki';

var url = 'https://' + args.language + '.wikipedia.org/w/api.php?'
    + querystring.stringify({
        action: 'query',
        format: 'json',
        prop: 'revisions',
        titles: args.articleName,
        rvprop: ['timestamp','user','comment','content'].join('|'),
        rvlimit: 'max',
        rvslots: 'main'
    });

var repoDir = './' + args.language + '.wikipedia.org/' + args.articleName;
var repoPath = path.resolve(process.cwd(), "articles", repoDir);

var repo;
var revisions;
var currentRevisionId;

function createCommitForCurrentRevision() {
    var revision = revisions[currentRevisionId];
    var fileContent = revision['*'];
    var message = (revision.comment || '').substr(0, defaults.commitMessageLength);
    var author = revision.user;
    var date = revision.timestamp;

    log.verbose("Creating commit for revision " + currentRevisionId);

    promisify(fse.writeFile(path.join(repo.workdir(), fileName), fileContent))
        .then(function(){
            return repo.refreshIndex();
        })
        .then(function(idx) {
            index = idx;
        })
        .then(function() {
            return index.addByPath(fileName);
        })
        .then(function() {
            return index.write();
        })
        .then(function() {
            var timestamp = moment(date, moment.ISO_8601);
            var authorSignature = nodegit.Signature.create(author, author + "@" + args.language + ".wikipedia.org", timestamp.unix(), 60);

            if (currentRevisionId === 0) { // First commit
                return index.writeTree()
                    .then(function(oid) {
                        return repo.createCommit("HEAD", authorSignature, authorSignature, message, oid, []);
                    })
            }
            else {
                return index.writeTree()
                    .then(function(oidResult) {
                         oid = oidResult;
                         return nodegit.Reference.nameToId(repo, "HEAD");
                    })
                    .then(function(head) {
                        return repo.getCommit(head);
                    })
                    .then(function(parent) {
                        return repo.createCommit("HEAD", authorSignature, authorSignature, message, oid, [parent]);
                    })
            }
        })
        .then(function(commitId) {
            log.verbose("New commit created: ", commitId);
            currentRevisionId++;
            if (currentRevisionId < revisions.length) {
                createCommitForCurrentRevision();
            }
            else {
                log.info('The article\'s revision history was saved in ' + repoPath);
            }
        });
}

log.verbose("Cleaning previous local repository if existing");
fse.removeSync(repoPath);

promisify(fse.ensureDir)(repoPath)
    .then(function() {
        return nodegit.Repository.init(repoPath, 0);
    })
    .then(function(repoCreated) {
        log.verbose("Created empty repository " + repoCreated);
        repo = repoCreated;
        log.verbose("Retrieving article history from " + url);
        https.get(url, function(res){
            var body = '';

            res.on('data', function(chunk){
                body += chunk;
            });

            res.on('end', function(){
                log.verbose("Article history has been retrieved");
                var response = JSON.parse(body);
                Object.keys(response.query.pages).forEach(function(pageId) {
                    var page = response.query.pages[pageId];
                    if (!(page && page.revisions && page.revisions.length)) {
                        log.error('Invalid response : ' + JSON.stringify(page));
                        process.exit(1);
                    }
                    revisions = page.revisions.reverse();

                    currentRevisionId = 0;
                    createCommitForCurrentRevision();
                });
            });
        })
     });

#!/usr/bin/env node

var path = require('path');
var promisify = require('promisify-node');
var fse = promisify(require('fs-extra'));
var nodegit = require('nodegit');
var https = require("https");
var moment = require("moment");

var language = 'en';
var articleName = 'Maïna';
var fileName = articleName + '.wiki';

var apiRoot = 'https://' + language + '.wikipedia.org/w/api.php';
var url = apiRoot + '?action=query&format=json&prop=revisions&titles=' + encodeURIComponent(articleName) + '&rvprop=timestamp%7Cuser%7Ccomment%7Ccontent&rvlimit=max';

var repoDir = './' + language + '.wikipedia.org/' + articleName;
var repo;
var revisions;
var currentRevisionId = 0;

function createCommitForCurrentRevision() {
    var revision = revisions[currentRevisionId];
    var fileContent = revision['*'];
    var message = revision.comment.substr(0, 50);
    var author = revision.user;
    var date = revision.timestamp;

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
            var authorSignature = nodegit.Signature.create(author, author + "@test.com", timestamp.unix(), 60);

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
        .done(function(commitId) {
            console.log("New Commit: ", commitId);
            currentRevisionId++;
            if (currentRevisionId < revisions.length) {
                createCommitForCurrentRevision();
            }
            else {
                console.log('Done');
            }
        });
}

fse.removeSync(path.resolve(__dirname, repoDir));
fse.ensureDir = promisify(fse.ensureDir);

fse.ensureDir(path.resolve(__dirname, repoDir))
    .then(function() {
        return nodegit.Repository.init(path.resolve(__dirname, repoDir), 0);
    })
    .then(function(repoCreated) {
        repo = repoCreated;
        https.get(url, function(res){
            var body = '';

            res.on('data', function(chunk){
                body += chunk;
            });

            res.on('end', function(){
                var response = JSON.parse(body);
                currentRevisionId = 0;
                Object.keys(response.query.pages).forEach(function(pageId) {
                    var page = response.query.pages[pageId];
                    revisions = page.revisions.reverse();

                    createCommitForCurrentRevision();
                });
            });
        })
     });
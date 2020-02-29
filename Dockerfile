FROM node:10-buster-slim

WORKDIR /home/wiki-as-git
COPY package.json package-lock.json wiki-as-git.js ./

RUN apt-get update && apt-get install -y --no-install-recommends libgit2-dev git && apt-get clean \
 && npm rebuild && npm install

ENTRYPOINT ["/home/wiki-as-git/wiki-as-git.js"]

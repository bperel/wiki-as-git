FROM node:10-buster-slim

RUN apt-get update && apt-get install -y --no-install-recommends libgit2-dev git && apt-get clean
RUN cd /home && git clone --single-branch -b 0.1.8 --depth=1 https://github.com/bperel/wiki-as-git
WORKDIR /home/wiki-as-git
RUN npm rebuild && npm install

ENTRYPOINT ["/home/wiki-as-git/wiki-as-git.js"]

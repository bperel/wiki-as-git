FROM node:8-jessie

RUN apt-get update && apt-get install -y libgit2-dev

RUN cd /home && git clone --single-branch -b 0.1.8 --depth=1 https://github.com/bperel/wiki-as-git
WORKDIR /home/wiki-as-git
RUN cd /home/wiki-as-git && npm rebuild && npm install

ENTRYPOINT ["/home/wiki-as-git/wiki-as-git.js"]

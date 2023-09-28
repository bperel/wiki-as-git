FROM node:16-slim

WORKDIR /home/wiki-as-git
COPY package.json package-lock.json tsconfig.json wiki-as-git.ts ./

RUN apt-get update && apt-get install -y --no-install-recommends git && apt-get clean
RUN npm install

ENTRYPOINT ["./node_modules/.bin/ts-node", "wiki-as-git.ts"]

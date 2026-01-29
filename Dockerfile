FROM oven/bun:latest

WORKDIR /home/wiki-as-git
COPY package.json package-lock.json tsconfig.json wiki-as-git.ts ./

RUN apt-get update && apt-get install -y --no-install-recommends git && apt-get clean
RUN bun install

ENTRYPOINT ["bun", "run", "wiki-as-git.ts"]

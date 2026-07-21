FROM oven/bun:latest

WORKDIR /home/wiki-as-git

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY pnpm-workspace.yaml package.json ./
COPY packages/wiki-as-git/ ./packages/wiki-as-git/

RUN apt-get update && apt-get install -y --no-install-recommends git && apt-get clean
RUN pnpm install --frozen-lockfile

WORKDIR /home/wiki-as-git/packages/wiki-as-git
ENTRYPOINT ["bun", "run", "wiki-as-git.ts"]

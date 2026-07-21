## wiki-as-git

[![Greenkeeper badge](https://badges.greenkeeper.io/bperel/wiki-as-git.svg)](https://greenkeeper.io/)

An easy way to check the revision history of a Wikipedia article using Git commands.

# Install

- You can run wiki-as-git using our Docker image, see Usage.

- Or you can install its dependencies manually : `pnpm install`

## Usage

### With Docker, using a pre-built image

`docker run --rm -it -v $(pwd)/articles:/home/wiki-as-git/packages/wiki-as-git/articles bperel/wiki-as-git '<Article name>'`

Example:
`docker run --rm -it -v $(pwd)/articles:/home/wiki-as-git/packages/wiki-as-git/articles bperel/wiki-as-git '"Hello, World!" program'`

### Without Docker

#### Process a single article from Wikipedia API

From the project root:
`pnpm --filter wiki-as-git exec bun run wiki-as-git.ts [--language=en] '<Article name>'`

Or from `packages/wiki-as-git`:
`bun run wiki-as-git.ts [--language=en] '<Article name>'`

Example:
`pnpm --filter wiki-as-git exec bun run wiki-as-git.ts '"Hello, World!" program'`

#### Process articles from an XML dump

`pnpm --filter wiki-as-git exec bun run wiki-as-git.ts --xml-dump <path-to-xml-dump>`

Example:
`pnpm --filter wiki-as-git exec bun run wiki-as-git.ts --xml-dump /path/to/bdrwiki-2026-01-01-p1p1433.xml`.

Bzip2 compressed XML dumps are also supported.

When processing an XML dump, each article will have its Git history created in a separate directory under `articles/<language>.wikipedia.org/<article-name>/`. The language is automatically detected from the XML dump metadata.

If you have bot credentials for the wiki that you wish to target, copy-paste `packages/wiki-as-git/settings.example.json` into `packages/wiki-as-git/settings.json` and fill in the bot's credentials.
This will lift some limits of the Mediawiki API and make wiki-as-git much faster.

![alt text](wiki-as-git%20demo.gif)

## Browser + Sync (Netlify)

The frontend (`packages/browser`) and sync logic (`packages/sync`) are separate:

- **browser**: Static frontend that calls the sync API. Deployed to Netlify CDN.
- **sync**: Wikipedia + GitHub logic. Runs as a Netlify Function (serverless). Token is stored in env, not exposed to clients.

When a visitor goes to `/en.wikipedia.org/Game Boy`:

1. The frontend calls `POST /.netlify/functions/sync` with the path
2. The sync function fetches revisions from Wikipedia, creates commits, pushes to GitHub
3. No token required from the user

### Deploy to Netlify

1. Connect the repo to Netlify
2. Set `GITHUB_TOKEN` in Site settings → Environment variables (repo scope)
3. Deploy

### Local dev

```bash
pnpm run dev:browser
```

Builds the demo and runs Netlify Dev at http://localhost:3000. This serves the frontend and runs the sync function locally. Set `GITHUB_TOKEN` and `GITHUB_OWNER` in a `.env` file at the project root (see `.env.example`).

For a full build first: `pnpm run dev` (uses port 8888).

### Run sync locally

To debug the sync logic without deploying:

```bash
# 1. Add your token to packages/sync/.env:
#    GITHUB_TOKEN=ghp_your_token_here

# 2. Run sync
pnpm run sync:local "/fr.wikipedia.org/Game Boy"
```

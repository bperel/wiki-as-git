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

## Browser package (wiki-as-git-browser)

A browser package that syncs Wikipedia article history to GitHub. When a visitor goes to `wiki-as-git.github.io/en.wikipedia.org/blob/master/Game Boy.wiki`, the package:

1. Fetches the full revision history from the [Wikipedia API](https://en.wikipedia.org/w/api.php)
2. Creates Git commits for each revision (reusing logic from the core package)
3. Pushes to `https://github.com/wiki-as-git/en.wikipedia.org`, creating the repo if it doesn't exist

### Usage

```ts
import { syncArticleToGitHub, parseWikiAsGitPath } from "wiki-as-git-browser";

const result = await syncArticleToGitHub("/en.wikipedia.org/blob/master/Game Boy.wiki", {
  owner: "wiki-as-git",
  token: "ghp_...",  // GitHub token with repo scope
  onProgress: (phase, current, total) => console.log(phase, current, total),
});
```

### Demo

Run the demo locally:

```bash
pnpm run dev:browser
```

Or from the browser package:

```bash
pnpm --filter wiki-as-git-browser run dev
```

This builds the demo and serves it at http://localhost:3000. You need a GitHub token with `repo` scope.

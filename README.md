## wiki-as-git

[![Greenkeeper badge](https://badges.greenkeeper.io/bperel/wiki-as-git.svg)](https://greenkeeper.io/)

An easy way to check the revision history of a Wikipedia article using Git commands.

# Install

* You can run wiki-as-git using our Docker image, see Usage.

* Or you can install its dependencies manually : `npm install`

## Usage

### With Docker, using a pre-built image

`docker run --rm -it -v $(pwd)/articles:/home/wiki-as-git/articles bperel/wiki-as-git '<Article name>'`

Example:
`docker run --rm -it -v $(pwd)/articles:/home/wiki-as-git/articles bperel/wiki-as-git '"Hello, World!" program'`

### Without Docker

`npx ts-node wiki-as-git.ts [--language=en] '<Article name>'`

Example:
`npx ts-node wiki-as-git.ts '"Hello, World!" program'`


If you have bot credentials for the wiki that you wish to target, copy-paste `settings.example.json` into a file named `settings.json` and fill in the bot's credentials.
This will lift some limits of the Mediawiki API and make wiki-as-git much faster.

![alt text](wiki-as-git%20demo.gif)

## wiki-as-git

[![Greenkeeper badge](https://badges.greenkeeper.io/bperel/wiki-as-git.svg)](https://greenkeeper.io/)

An easy way to check the revision history of a Wikipedia article using Git commands.

# Install

* You can run wiki-as-git using our Docker image :
`docker run --rm -it -v $(pwd)/articles:/home/wiki-as-git/articles bperel/wiki-as-git "Hello world"`

* Or you can install it manually :
  * `libgit2-dev` is required for the `nodegit` dependency.
  * Then run `npm rebuild && npm install`

## Usage

`wiki-as-git.js [--language=en] "<Article name>"`

![alt text](wiki-as-git%20demo.gif)

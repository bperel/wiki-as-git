## wiki-as-git

[![Greenkeeper badge](https://badges.greenkeeper.io/bperel/wiki-as-git.svg)](https://greenkeeper.io/)

An easy way to check the revision history of a Wikipedia article using Git commands.

# Install

* You can run wiki-as-git using our Docker image :
`docker run --rm -it bperel/wiki-as-git Hello`

* Or you can install it manually :
  * `libstdc++-4.9-dev` is required for the `nodegit` dependency. Either install it or build `nodegit` manually using : `BUILD_ONLY=true npm install nodegit`
  * Then run `npm install`

## Usage

`wiki-as-git.js "<Article name>" [<language=en>]`

![alt text](wiki-as-git%20demo.gif)

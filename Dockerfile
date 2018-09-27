FROM alpine
RUN apk add --update nodejs nodejs-npm git g++ libgit2-dev libcurl
RUN ln -s /usr/lib/libcurl.so.4 /usr/lib/libcurl-gnutls.so.4
RUN cd /home && git clone --depth=1 --single-branch -b branch 0.1.4 https://github.com/bperel/wiki-as-git && cd wiki-as-git && npm install
ENTRYPOINT ["/home/wiki-as-git/wiki-as-git.js"]
CMD ["Test"]

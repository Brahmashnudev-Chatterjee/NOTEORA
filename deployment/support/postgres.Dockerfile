FROM postgres:16-alpine@sha256:f377d590e5474681d4d7838635031a2b50647923b7abfa803ce9b5ff35d5c663
# Prepared from checksum-pinned gosu 1.20 source with Go 1.27.4; no Go compiler in runtime.
COPY --chmod=0755 gosu /usr/local/bin/gosu
RUN apk upgrade --no-cache && gosu nobody id

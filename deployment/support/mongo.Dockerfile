FROM mongo:7@sha256:9896df581dfd0718b7abe112f4c37598d0986c54060e4ec1384997e6503c8c71
COPY --chmod=0755 gosu /usr/local/bin/gosu
COPY js-yaml/ /opt/js-yaml/
RUN apt-get update && apt-get upgrade -y --no-install-recommends \
    && apt-get clean && rm -rf /var/lib/apt/lists/* \
    && gosu nobody id

FROM ruby:3.4.10-slim

ARG RAILS_VERSION=8.1.3.1

RUN apt-get update \
    && apt-get install --yes --no-install-recommends build-essential git libpq-dev \
    && rm -rf /var/lib/apt/lists/* \
    && gem install rails --version "${RAILS_VERSION}" --no-document

WORKDIR /workspace

ENTRYPOINT ["rails"]

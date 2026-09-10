FROM oven/bun:1.3.13-alpine AS build

WORKDIR /app
COPY apps/web/package.json apps/web/bun.lock ./
RUN bun install --frozen-lockfile
COPY apps/web/ ./
RUN bun run build

FROM public.ecr.aws/aws-cli/aws-cli:2.28.16

COPY --from=build --chown=1000:1000 /app/dist /dist
COPY --chmod=0555 infra/images/web-publisher/publish.sh /usr/local/bin/publish-web

ENV HOME=/tmp
USER 1000:1000
ENTRYPOINT ["/usr/local/bin/publish-web"]

FROM oven/bun:1.3.13-debian AS dependencies

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

FROM dependencies AS build

WORKDIR /app

# Next.js embeds public configuration in browser bundles. These values are
# publishable Supabase settings, never provider credentials.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
# Route discovery imports server handlers during the build. These placeholders
# satisfy schema validation only; production values are injected at runtime
# through the workload's Secrets Manager boundary.
ENV ALPACA_API_KEY=build-only-alpaca-key
ENV ALPACA_SECRET_KEY=build-only-alpaca-secret
ENV GEMINI_API_KEY=build-only-gemini-key
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN bun run build

FROM node:24.18.0-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --gid 1001 indus && useradd --uid 1001 --gid indus --create-home indus

WORKDIR /app

COPY --from=build --chown=indus:indus /app/public ./public
COPY --from=build --chown=indus:indus /app/.next/standalone ./
COPY --from=build --chown=indus:indus /app/.next/static ./.next/static

USER indus

EXPOSE 3000

CMD ["node", "server.js"]

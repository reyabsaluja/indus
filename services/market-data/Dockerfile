FROM rust:1.96.0-bookworm AS build

RUN apt-get update \
    && apt-get install --yes --no-install-recommends cmake libcurl4-openssl-dev libssl-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY src ./src
COPY migrations ./migrations
RUN cargo build --locked --release

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --no-create-home indus

COPY --from=build /workspace/target/release/indus-market-data /usr/local/bin/indus-market-data

USER 10001
EXPOSE 8081
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["curl", "--fail", "--silent", "http://127.0.0.1:8081/health/ready"]
ENTRYPOINT ["indus-market-data"]

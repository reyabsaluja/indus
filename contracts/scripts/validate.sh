#!/usr/bin/env sh
set -eu

contracts_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

docker run --rm \
  --volume "$contracts_dir/openapi:/spec:ro" \
  redocly/cli:2.44.1 lint --config /spec/redocly.yaml /spec/indus.v1.yaml

docker run --rm \
  --volume "$contracts_dir/protobuf:/workspace" \
  --workdir /workspace \
  bufbuild/buf:1.72.0 lint

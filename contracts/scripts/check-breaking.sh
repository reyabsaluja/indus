#!/usr/bin/env sh
set -eu

if test "$#" -ne 1; then
  echo "usage: $0 <baseline-git-revision>" >&2
  exit 2
fi

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
baseline=$1

if ! git -C "$repo_root" cat-file -e "$baseline^{commit}" 2>/dev/null; then
  echo "Contract baseline is not available locally: $baseline" >&2
  exit 2
fi

comparison_dir=$(mktemp -d)
trap 'rm -rf "$comparison_dir"' EXIT HUP INT TERM

if git -C "$repo_root" cat-file -e "$baseline:contracts/protobuf/buf.yaml" 2>/dev/null; then
  mkdir -p "$comparison_dir/contracts"
  git -C "$repo_root" archive "$baseline" contracts/protobuf | tar -x -C "$comparison_dir"
  docker run --rm \
    --volume "$repo_root/contracts/protobuf:/workspace:ro" \
    --volume "$comparison_dir/contracts/protobuf:/baseline:ro" \
    --workdir /workspace \
    bufbuild/buf:1.72.0 breaking --against /baseline
else
  echo "No protobuf contract exists at $baseline; compatibility comparison is not applicable yet."
fi

if git -C "$repo_root" cat-file -e "$baseline:contracts/openapi/indus.v1.yaml" 2>/dev/null; then
  mkdir -p "$comparison_dir/openapi"
  git -C "$repo_root" show "$baseline:contracts/openapi/indus.v1.yaml" > "$comparison_dir/openapi/indus.v1.yaml"
  docker run --rm \
    --volume "$repo_root/contracts/openapi:/current:ro" \
    --volume "$comparison_dir/openapi:/baseline:ro" \
    tufin/oasdiff:v1.28.0 breaking --fail-on ERR \
      /baseline/indus.v1.yaml /current/indus.v1.yaml
else
  echo "No OpenAPI contract exists at $baseline; compatibility comparison is not applicable yet."
fi

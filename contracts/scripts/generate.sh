#!/usr/bin/env sh
set -eu

contracts_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

docker run --rm \
  --user "$(id -u):$(id -g)" \
  --env HOME=/tmp \
  --volume "$contracts_dir/protobuf:/workspace" \
  --volume "$contracts_dir/generated:/generated" \
  --workdir /workspace \
  bufbuild/buf:1.72.0 generate --template buf.gen.yaml

docker run --rm \
  --user "$(id -u):$(id -g)" \
  --volume "$contracts_dir:/contracts" \
  openapitools/openapi-generator-cli:v7.24.0 generate \
  --input-spec /contracts/openapi/indus.v1.yaml \
  --generator-name typescript-fetch \
  --output /contracts/generated/openapi/typescript \
  --additional-properties=supportsES6=true,typescriptThreePlus=true,useSingleRequestParameter=true

docker run --rm \
  --user "$(id -u):$(id -g)" \
  --volume "$contracts_dir/generated:/generated" \
  ruby:3.4.10-slim ruby -e '
    Dir.glob("/generated/**/*", File::FNM_DOTMATCH).each do |path|
      next unless File.file?(path)
      content = File.binread(path)
      next if content.include?("\0")
      File.binwrite(path, content.gsub(/[ \t]+\r?\n/, "\n").sub(/\n+\z/, "\n"))
    end
  '

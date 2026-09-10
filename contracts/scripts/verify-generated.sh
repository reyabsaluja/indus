#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)

"$repo_root/contracts/scripts/generate.sh"

if test -n "$(git -C "$repo_root" status --porcelain -- contracts/generated)"; then
  echo "Generated contract clients are stale. Run contracts/scripts/generate.sh and commit the result." >&2
  git -C "$repo_root" status --short -- contracts/generated >&2
  exit 1
fi

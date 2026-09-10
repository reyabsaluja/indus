#!/bin/sh
set -eu

: "${WEB_BUCKET:?WEB_BUCKET is required}"
: "${WEB_RELEASE_ID:?WEB_RELEASE_ID is required}"
: "${CLOUDFRONT_DISTRIBUTION_ID:?CLOUDFRONT_DISTRIBUTION_ID is required}"

case "$WEB_RELEASE_ID" in
  *[!0-9a-f]* | "")
    echo "WEB_RELEASE_ID must contain only lowercase hexadecimal characters" >&2
    exit 2
    ;;
esac

if [ "${PUBLISH_APPLY:-false}" = "true" ]; then
  dry_run=""
else
  dry_run="--dryrun"
  echo "Dry run only; set PUBLISH_APPLY=true in the reconciled deployment to publish."
fi

# shellcheck disable=SC2086
aws s3 sync /dist "s3://${WEB_BUCKET}/releases/${WEB_RELEASE_ID}" \
  --only-show-errors --cache-control "public,max-age=31536000,immutable" $dry_run
# shellcheck disable=SC2086
aws s3 sync /dist "s3://${WEB_BUCKET}/current" \
  --delete --only-show-errors --cache-control "public,max-age=31536000,immutable" $dry_run
# shellcheck disable=SC2086
aws s3 cp /dist/index.html "s3://${WEB_BUCKET}/current/index.html" \
  --only-show-errors --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html; charset=utf-8" $dry_run

if [ "$dry_run" = "" ]; then
  aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/" "/index.html" >/dev/null
fi

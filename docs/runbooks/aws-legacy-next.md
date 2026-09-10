# AWS deployment of the current application

Phase 1 moves the current Next.js application from Vercel to AWS without changing its product or data boundaries. Supabase remains the identity and database provider; Alpaca, Yahoo Finance, and Gemini remain the provider boundaries. Do not use this runbook to cut over to the replacement Rails, React, or Rust services.

## Release contract

Build the root `Dockerfile` with the two publishable Supabase build arguments. The final image runs `node server.js` as UID 1001 and contains no provider credentials. Supply `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, and `GEMINI_API_KEY` only as runtime values in the `legacy_next` Secrets Manager secret. The same secret also contains the existing publishable Supabase URL and anonymous key so middleware has runtime access to them.

The Kubernetes workload is rendered by `infra/helm/indus-legacy-next`. It requires immutable image digest, workload role ARN, runtime secret ARN, target group ARN, and region values from Terraform outputs. It runs readiness probes against `/api/health?mode=ready`; a failed provider configuration therefore prevents new traffic from reaching a pod.

## Cutover and rollback

1. Apply and review Terraform in development, then staging. Never apply a plan that creates or changes an unexpected public DNS record, KMS key, secret value, or production data resource.
2. Create the manually managed `legacy_next` secret with the five required keys. Confirm the workload role can read only that secret and its KMS key.
3. Publish a signed immutable image, hydrate the GitOps value with its digest, and wait for the deployment, target-group health, authenticated browser smoke test, and accessibility smoke test to pass.
4. Set `edge_runtime = "legacy-next"`, begin Route 53 weighted routing from the Vercel hostname to AWS, and stop immediately if readiness, authentication, provider errors, or client error rates exceed the cutover threshold.
5. Roll back by returning Route 53 weight to the Vercel origin or by restoring the last known-good immutable AWS image. Do not delete Vercel, Supabase, or secrets until the documented rollback window completes.

## Safety boundaries

- Terraform creates secret containers only. Secret values are supplied outside Terraform and must never enter state, plans, CI logs, or Git.
- Do not use a `NEXT_PUBLIC_` prefix for Alpaca or Gemini credentials.
- `edge_runtime = "replacement"` is reserved for Phase 4. Changing it before the replacement platform is accepted is an unauthorized production cutover.
- The production domain must remain a subdomain while weighted Route 53 routing is in use; apex records require a separately reviewed DNS design.

# Data, identity, and traffic cutover

## Entry gates

- Development and staging migration rehearsals reconcile counts, checksums,
  ownership, identities, and sampled rows with zero unexplained differences.
- A fresh Aurora restore meets RPO/RTO, a prior signed image rollback is tested,
  Cognito MFA and token validation pass, and every page alert reaches on-call.
- No critical security finding is open. Capacity has at least 50% headroom.
- The AWS-hosted legacy Next.js application and Supabase remain writable and
  recoverable throughout the rollback window. Freeze incompatible schema and
  identity changes.

## Execution

1. Record incident commander, migration operator, application operator,
   database operator, observer, decision timestamps, and exact artifact SHA.
2. Take/verify Aurora, Supabase, S3, identity, and configuration backups. Export
   a final high-water mark and stop nonessential batch work.
3. Run the Phase 3 export/transform into staging tables. Reconcile row counts,
   checksums, tenant ownership, foreign keys, report artifacts, and Cognito
   subject mappings. Any unexplained mismatch aborts.
4. Enable shadow reads, compare responses, then run the bounded final delta.
   Keep one authoritative writer per record class. Preserve correlation and
   idempotency keys.
5. Change the Phase 1 edge runtime only after the replacement workload has
   passed staging. Increase Terraform `replacement_traffic_weight` through
   `1, 5, 25, 50, 100`, saving and reviewing a plan at each step. Observe at
   least 15 minutes at 1/5/25%, 30 minutes at 50%, and 60 minutes at 100%.
6. For each window, export the measured JSON fields expected by
   `scripts/evaluate-cutover.sh`. Continue only on exit zero.

Immediate rollback thresholds are: error rate above 2%, p95 above 500 ms,
market delay above 5 seconds, workflow terminal rate below 99%, any data
reconciliation mismatch, any tenant isolation breach, acknowledged event loss,
or inability to page the owner. A security or integrity breach skips diagnosis
and rolls traffic back first.

Hold full traffic for seven days before disabling legacy writes, and 30 days
before decommission. Keep backups and credentials until the decommission
checklist is peer-approved.

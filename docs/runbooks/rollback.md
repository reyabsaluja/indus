# Deployment and cutover rollback

Declare rollback when an abort threshold fires; do not wait for consensus while
customers or data are at risk.

1. Set the Terraform replacement traffic weight to the last safe value (zero
   for integrity/security failures), review the DNS-only plan, and apply it.
2. Stop replacement writers and workers if they can corrupt or duplicate work;
   leave read-only diagnostics running. Record Kafka offsets, Temporal workflow
   IDs, outbox high-water marks, image digests, and database time.
3. If the fault is image-only, revert GitOps values to the previous verified
   digest and let Argo reconcile. Do not reverse an applied database migration;
   ship a forward-compatible correction or restore to a new cluster.
4. Reconcile writes made during partial traffic. Resolve conflicts by the
   documented authoritative writer and idempotency key, never by latest
   timestamp alone.
5. Verify legacy health, tenant isolation, queues, streams, reports, and alerts.
   Communicate impact and keep the incident open until reconciliation is zero.

Do not prune the failed image, secret version, migration artifact, logs, or
backup until the incident review and evidence-retention window complete.

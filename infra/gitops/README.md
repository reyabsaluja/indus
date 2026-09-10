# GitOps delivery

Terraform creates the cluster and prints the non-secret values consumed here.
Replace each checked-in `replace-*` placeholder in the corresponding control
plane and workload values before bootstrapping that environment. Secret values
are never stored here.

Argo CD owns add-ons, admission policies, and application workloads. GitHub
Actions may publish signed immutable images and open a promotion pull request;
it does not call Kubernetes or mutate a deployment. Promotion order is
development, staging, production, and every environment references exact image
digests.

The only imperative bootstrap is the pinned Argo CD installation described in
`docs/runbooks/aws-bootstrap.md`. After the root application is submitted,
self-healing and pruning are declarative. Do not enable automated sync in a
production cluster until placeholders, alert delivery, and rollback access have
been verified.

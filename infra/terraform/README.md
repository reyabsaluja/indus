# AWS infrastructure

Phase 4 uses two Terraform boundaries:

- `bootstrap/shared` runs once in the shared-services account. It creates the
  encrypted remote-state bucket, immutable ECR repositories, and the GitHub
  Actions OIDC publisher role.
- `environments/{development,staging,production}` runs in the corresponding
  isolated AWS account. Each root has a distinct backend key and calls the
  same reviewed environment module.

Terraform never stores application secret values. It creates only Secrets
Manager containers and IAM access boundaries; an operator supplies values with
`scripts/aws/put-secret.sh` over an audited AWS session. Never pass secret
values through `-var`, `.tfvars`, plans, outputs, or CI logs.

RDS Proxy has three Secrets Manager auth entries: platform runtime, market
writer, and migration-only. These are distinct PostgreSQL logins; do not reuse
one password across containers. Runtime configuration secrets hold the matching
proxy URLs, while only the migration service account can read the migration
credential. See `docs/runbooks/database-roles.md` for the staged bootstrap.

Copy the checked-in examples to ignored local files, replace account-specific
placeholders, and bootstrap in this order:

```bash
cp infra/terraform/bootstrap/shared/terraform.tfvars.example \
  infra/terraform/bootstrap/shared/terraform.tfvars
terraform -chdir=infra/terraform/bootstrap/shared init
terraform -chdir=infra/terraform/bootstrap/shared plan -out=shared.tfplan

cp infra/terraform/environments/development/backend.hcl.example \
  infra/terraform/environments/development/backend.hcl
cp infra/terraform/environments/development/terraform.tfvars.example \
  infra/terraform/environments/development/terraform.tfvars
terraform -chdir=infra/terraform/environments/development init \
  -backend-config=backend.hcl
terraform -chdir=infra/terraform/environments/development plan \
  -out=development.tfplan
```

Apply is intentionally not wrapped in repository automation. Follow
`docs/runbooks/aws-bootstrap.md`, require plan review, and use a short-lived
federated operator session. Production uses deletion protection, multi-AZ
capacity, longer retention, required MFA, and a two-person apply gate.

Run `scripts/validate-phase4.sh` for non-mutating local validation.

# Legacy decommission

Start only after seven stable days at full replacement traffic, a 30-day
rollback window, zero reconciliation drift, successful restore rehearsal, and
written product/security/platform approval.

Export and verify final Supabase data and identity backups, the AWS legacy
deployment configuration, DNS history, audit evidence, and provider ownership.
Disable legacy writes, observe another seven days, then revoke legacy
credentials and integrations. Remove DNS targets before deleting the
AWS-hosted legacy runtime. Delete Supabase resources only from an explicit
inventory with two-person confirmation; retain backups and legal/audit
artifacts per policy. Remove compatibility code and redundant copies in a
separate reviewed change. Record each removed resource and its recovery status.

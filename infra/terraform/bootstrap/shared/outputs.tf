output "state_bucket" { value = aws_s3_bucket.state.id }
output "state_kms_key_arn" { value = aws_kms_key.shared.arn }
output "state_role_arns" { value = { for key, role in aws_iam_role.state : key => role.arn } }
output "ecr_repository_arns" { value = { for key, repository in aws_ecr_repository.this : key => repository.arn } }
output "ecr_repository_urls" { value = { for key, repository in aws_ecr_repository.this : key => repository.repository_url } }
output "github_build_role_arn" { value = aws_iam_role.github_build.arn }
output "github_promotion_role_arn" { value = aws_iam_role.github_promotion.arn }

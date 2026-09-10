#!/usr/bin/env ruby
require "csv"
require "fileutils"
require "json"
require "minitest/autorun"
require "tmpdir"

load File.expand_path("transform.rb", __dir__) unless defined?(IndusMigration)

class MigrationTransformTest < Minitest::Test
  USER_ID = "00000000-0000-4000-8000-000000000001"
  FAVORITE_ID = "00000000-0000-4000-8000-000000000002"
  REPORT_ID = "00000000-0000-4000-8000-000000000003"

  def setup
    @root = Dir.mktmpdir("indus-migration-test")
    @source = File.join(@root, "source")
    @target = File.join(@root, "target")
    FileUtils.mkdir_p(@source)
    write("auth_users", %w[id email raw_user_meta_data created_at], [ USER_ID, "investor@example.test", '{"name":"Investor"}', at ])
    write("favorites", %w[id user_id symbol created_at], [ FAVORITE_ID, USER_ID, "btc/usd", at ])
    write("reports", %w[id user_id symbol company_name status report_content summary created_at],
      [ REPORT_ID, USER_ID, "aapl", "Apple", "completed", "Grounded report", "Summary", at ])
    write("ai_usage_windows", %w[user_id function_name window_type window_start request_count],
      [ USER_ID, "generate-report", "day", at, "2" ])
    write("metric_explanations", %w[id symbol metric explanation created_at],
      [ FAVORITE_ID, "AAPL", "revenue", '{"text":"cached"}', at ])
  end

  def teardown
    FileUtils.remove_entry_secure(@root)
  end

  def test_transforms_and_reconciles_all_authoritative_rows
    IndusMigration::Transformer.new(source_directory: @source, target_directory: @target,
      issuer: "https://project.supabase.co/auth/v1").run
    assert IndusMigration::Validator.new(@target).run
    favorite = CSV.read(File.join(@target, "favorites.csv"), headers: true).first.to_h
    report = CSV.read(File.join(@target, "reports.csv"), headers: true).first.to_h
    usage = CSV.read(File.join(@target, "ai_usage_windows.csv"), headers: true).first.to_h
    assert_equal "BTC/USD", favorite.fetch("symbol")
    assert_equal "crypto", favorite.fetch("instrument_type")
    assert_equal "completed", report.fetch("status")
    assert_equal "report", usage.fetch("operation")
    identity = JSON.parse(File.open(File.join(@target, "cognito_identities.jsonl"), &:readline))
    assert_equal "password_reset_required", identity.fetch("migration_state")
    assert File.file?(File.join(@target, "archive", "metric_explanations.csv"))
  end

  def test_rejects_orphaned_owned_rows
    write("favorites", %w[id user_id symbol created_at], [ FAVORITE_ID, REPORT_ID, "AAPL", at ])
    error = assert_raises(IndusMigration::Error) do
      IndusMigration::Transformer.new(source_directory: @source, target_directory: @target,
        issuer: "https://project.supabase.co/auth/v1").run
    end
    assert_match(/orphaned owner/, error.message)
  end

  def test_rejects_duplicate_identities_and_malformed_auth_metadata
    write_rows("auth_users", %w[id email raw_user_meta_data created_at],
      [ USER_ID, "Investor@example.test", "{}", at ],
      [ "00000000-0000-4000-8000-000000000004", "investor@example.test", "{}", at ])
    error = assert_raises(IndusMigration::Error) { transform! }
    assert_match(/duplicate auth email/, error.message)

    write("auth_users", %w[id email raw_user_meta_data created_at],
      [ USER_ID, "investor@example.test", "{bad-json", at ])
    error = assert_raises(IndusMigration::Error) { transform! }
    assert_match(/invalid auth metadata/, error.message)
  end

  def test_rejects_unsupported_report_and_usage_state
    write("reports", %w[id user_id symbol company_name status report_content summary created_at],
      [ REPORT_ID, USER_ID, "AAPL", "Apple", "unknown", "Report", "Summary", at ])
    error = assert_raises(IndusMigration::Error) { transform! }
    assert_match(/unsupported legacy report status/, error.message)

    write("reports", %w[id user_id symbol company_name status report_content summary created_at],
      [ REPORT_ID, USER_ID, "AAPL", "Apple", "completed", "Report", "Summary", at ])
    write("ai_usage_windows", %w[user_id function_name window_type window_start request_count],
      [ USER_ID, "generate-report", "day", at, "0" ])
    error = assert_raises(IndusMigration::Error) { transform! }
    assert_match(/invalid usage request count/, error.message)
  end

  def test_validator_detects_row_tampering_and_identity_count_drift
    transform!
    favorites = File.join(@target, "favorites.csv")
    File.write(favorites, File.read(favorites).sub("BTC/USD", "ETH/USD"))
    error = assert_raises(IndusMigration::Error) { IndusMigration::Validator.new(@target).run }
    assert_match(/favorites checksum mismatch/, error.message)

    FileUtils.remove_entry_secure(@target)
    transform!
    File.open(File.join(@target, "cognito_identities.jsonl"), "ab") { |file| file.puts("{}") }
    error = assert_raises(IndusMigration::Error) { IndusMigration::Validator.new(@target).run }
    assert_match(/identity count mismatch/, error.message)
  end

  def test_requires_an_https_identity_issuer
    error = assert_raises(IndusMigration::Error) do
      IndusMigration::Transformer.new(source_directory: @source, target_directory: @target,
        issuer: "http://identity.example")
    end
    assert_match(/HTTPS URL/, error.message)
  end

  private

  def at = "2026-08-05T12:00:00Z"

  def transform!
    IndusMigration::Transformer.new(source_directory: @source, target_directory: @target,
      issuer: "https://project.supabase.co/auth/v1").run
  end

  def write(name, headers, row)
    CSV.open(File.join(@source, "#{name}.csv"), "wb", write_headers: true, headers: headers) { |csv| csv << row }
  end

  def write_rows(name, headers, *rows)
    CSV.open(File.join(@source, "#{name}.csv"), "wb", write_headers: true, headers: headers) do |csv|
      rows.each { |row| csv << row }
    end
  end
end

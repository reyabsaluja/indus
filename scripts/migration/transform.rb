#!/usr/bin/env ruby
require "csv"
require "digest"
require "fileutils"
require "json"
require "time"
require "uri"

module IndusMigration
  UUID = /\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/i
  SYMBOL = /\A[A-Z0-9]+(?:[.\/-][A-Z0-9]+)?\z/
  OPERATIONS = { "batch-explain" => "explanation", "context-chat" => "chat", "generate-report" => "report" }.freeze
  REPORT_STATUSES = { "pending" => "queued", "processing" => "generating", "completed" => "completed",
    "failed" => "failed" }.freeze

  class Error < StandardError; end

  class Transformer
    TARGET_HEADERS = {
      "users" => %w[id issuer external_subject email display_name created_at updated_at],
      "favorites" => %w[id user_id symbol instrument_type created_at updated_at],
      "reports" => %w[id user_id symbol title status summary content created_at updated_at],
      "ai_usage_windows" => %w[user_id operation window_type window_started_at request_count input_tokens output_tokens created_at updated_at]
    }.freeze

    def initialize(source_directory:, target_directory:, issuer:)
      @source_directory = File.expand_path(source_directory)
      @target_directory = File.expand_path(target_directory)
      @issuer = issuer
      raise Error, "issuer must be an HTTPS URL" unless issuer.start_with?("https://")
    end

    def run
      FileUtils.mkdir_p(@target_directory, mode: 0o700)
      users = transform_users(read("auth_users.csv"))
      user_ids = users.to_h { |row| [ row.fetch("id"), true ] }
      tables = {
        "users" => users,
        "favorites" => transform_owned(read("favorites.csv"), user_ids) { |row| transform_favorite(row) },
        "reports" => transform_owned(read("reports.csv"), user_ids) { |row| transform_report(row) },
        "ai_usage_windows" => transform_owned(read("ai_usage_windows.csv"), user_ids) { |row| transform_usage(row) }
      }
      tables.each { |name, rows| write_csv(name, rows) }
      write_identities(users)
      archive_metric_explanations
      write_manifest(tables)
    end

    private

    def read(name)
      path = File.join(@source_directory, name)
      raise Error, "missing export: #{name}" unless File.file?(path)
      CSV.read(path, headers: true).map(&:to_h)
    end

    def transform_users(rows)
      emails = {}
      rows.map do |row|
        id = uuid!(row.fetch("id"), "auth_users.id")
        email = row.fetch("email").to_s.downcase.strip
        raise Error, "invalid auth email for #{id}" unless email.match?(URI::MailTo::EMAIL_REGEXP)
        raise Error, "duplicate auth email: #{email}" if emails[email]
        emails[email] = true
        raw_metadata = row.fetch("raw_user_meta_data", "{}").to_s
        metadata = JSON.parse(raw_metadata.empty? ? "{}" : raw_metadata)
        display_name = (metadata["name"] || metadata["full_name"] || email.split("@").first).to_s.strip[0, 100]
        created_at = timestamp!(row.fetch("created_at"), "auth_users.created_at")
        { "id" => id, "issuer" => @issuer, "external_subject" => id, "email" => email,
          "display_name" => display_name, "created_at" => created_at, "updated_at" => created_at }
      rescue JSON::ParserError
        raise Error, "invalid auth metadata for #{id}"
      end
    end

    def transform_owned(rows, user_ids)
      rows.map do |row|
        user_id = uuid!(row.fetch("user_id"), "owned row user_id")
        raise Error, "orphaned owner: #{user_id}" unless user_ids[user_id]
        yield(row.merge("user_id" => user_id))
      end
    end

    def transform_favorite(row)
      symbol = symbol!(row.fetch("symbol"))
      created_at = timestamp!(row.fetch("created_at"), "favorites.created_at")
      { "id" => uuid!(row.fetch("id"), "favorites.id"), "user_id" => row.fetch("user_id"), "symbol" => symbol,
        "instrument_type" => symbol.include?("/") ? "crypto" : "equity", "created_at" => created_at, "updated_at" => created_at }
    end

    def transform_report(row)
      symbol = symbol!(row.fetch("symbol"))
      company = row.fetch("company_name").to_s.strip
      title = "#{company.empty? ? symbol : company} research report"[0, 200]
      created_at = timestamp!(row.fetch("created_at"), "reports.created_at")
      status = REPORT_STATUSES.fetch(row.fetch("status")) { raise Error, "unsupported legacy report status" }
      { "id" => uuid!(row.fetch("id"), "reports.id"), "user_id" => row.fetch("user_id"), "symbol" => symbol,
        "title" => title, "status" => status, "summary" => row["summary"], "content" => row["report_content"],
        "created_at" => created_at, "updated_at" => created_at }
    end

    def transform_usage(row)
      operation = OPERATIONS.fetch(row.fetch("function_name")) { raise Error, "unsupported legacy AI function" }
      window_type = row.fetch("window_type")
      raise Error, "unsupported usage window" unless %w[hour day].include?(window_type)
      started_at = timestamp!(row.fetch("window_start"), "ai_usage_windows.window_start")
      count = Integer(row.fetch("request_count"), exception: false)
      raise Error, "invalid usage request count" unless count&.positive?
      { "user_id" => row.fetch("user_id"), "operation" => operation, "window_type" => window_type,
        "window_started_at" => started_at, "request_count" => count, "input_tokens" => 0, "output_tokens" => 0,
        "created_at" => started_at, "updated_at" => started_at }
    end

    def archive_metric_explanations
      rows = read("metric_explanations.csv")
      archive = File.join(@target_directory, "archive")
      FileUtils.mkdir_p(archive)
      CSV.open(File.join(archive, "metric_explanations.csv"), "wb", write_headers: true,
        headers: rows.first&.keys || %w[id symbol metric explanation created_at]) do |csv|
        rows.each { |row| csv << row }
      end
    end

    def write_csv(name, rows)
      CSV.open(File.join(@target_directory, "#{name}.csv"), "wb", write_headers: true, headers: TARGET_HEADERS.fetch(name)) do |csv|
        rows.sort_by { |row| row["id"] || [ row["user_id"], row["operation"], row["window_type"], row["window_started_at"] ].join(":") }
          .each { |row| csv << row }
      end
    end

    def write_identities(users)
      File.open(File.join(@target_directory, "cognito_identities.jsonl"), "wb", 0o600) do |file|
        users.sort_by { |row| row.fetch("id") }.each do |user|
          file.puts(JSON.generate(username: user.fetch("id"), email: user.fetch("email"), email_verified: true,
            display_name: user.fetch("display_name"), legacy_subject: user.fetch("external_subject"),
            migration_state: "password_reset_required"))
        end
      end
    end

    def write_manifest(tables)
      source_files = %w[auth_users favorites reports ai_usage_windows metric_explanations]
      manifest = { "version" => 1, "source_issuer" => @issuer,
        "tables" => tables.transform_values { |rows| { "count" => rows.length, "checksum" => checksum(rows) } },
        "source_exports" => source_files.to_h do |name|
          path = File.join(@source_directory, "#{name}.csv")
          [ name, { "count" => CSV.read(path, headers: true).length, "sha256" => Digest::SHA256.file(path).hexdigest } ]
        end,
        "identity" => { "count" => tables.fetch("users").length, "password_strategy" => "reset_required",
          "subject_link" => "custom:legacy_subject" },
        "dispositions" => { "metric_explanations" => "archived_rebuildable_cache" } }
      File.write(File.join(@target_directory, "manifest.json"), JSON.pretty_generate(manifest) + "\n", mode: "wb")
    end

    def checksum(rows)
      normalized = rows.map { |row| row.transform_values { |value| value.nil? ? nil : value.to_s } }
      canonical = normalized.sort_by { |row| JSON.generate(row.sort.to_h) }.map { |row| JSON.generate(row.sort.to_h) }.join("\n")
      Digest::SHA256.hexdigest(canonical)
    end

    def uuid!(value, field)
      raise Error, "invalid UUID in #{field}" unless value.to_s.match?(UUID)
      value.downcase
    end

    def symbol!(value)
      symbol = value.to_s.upcase.strip
      raise Error, "invalid symbol: #{value}" unless symbol.length <= 20 && symbol.match?(SYMBOL)
      symbol
    end

    def timestamp!(value, field)
      Time.parse(value.to_s).utc.iso8601(6)
    rescue ArgumentError
      raise Error, "invalid timestamp in #{field}"
    end
  end

  class Validator
    def initialize(directory)
      @directory = File.expand_path(directory)
    end

    def run
      manifest = JSON.parse(File.read(File.join(@directory, "manifest.json")))
      manifest.fetch("tables").each do |name, expected|
        rows = CSV.read(File.join(@directory, "#{name}.csv"), headers: true).map(&:to_h)
        actual = Transformer.allocate.send(:checksum, rows)
        raise Error, "#{name} count mismatch" unless rows.length == expected.fetch("count")
        raise Error, "#{name} checksum mismatch" unless actual == expected.fetch("checksum")
      end
      identities = File.foreach(File.join(@directory, "cognito_identities.jsonl")).count
      raise Error, "identity count mismatch" unless identities == manifest.dig("identity", "count")
      true
    end
  end
end

if $PROGRAM_NAME == __FILE__
  command, source, target, issuer = ARGV
  case command
  when "transform"
    raise IndusMigration::Error, "Usage: transform SOURCE_DIR TARGET_DIR SUPABASE_ISSUER" unless issuer
    IndusMigration::Transformer.new(source_directory: source, target_directory: target, issuer: issuer).run
    puts "Transformed migration dataset written to #{File.expand_path(target)}"
  when "validate"
    raise IndusMigration::Error, "Usage: validate TARGET_DIR" unless source
    IndusMigration::Validator.new(source).run
    puts "Migration dataset reconciles with its manifest"
  else
    raise IndusMigration::Error, "command must be transform or validate"
  end
end

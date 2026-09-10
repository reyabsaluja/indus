ENV["RAILS_ENV"] ||= "test"
ENV["SUPABASE_JWT_ISSUER"] ||= "https://example.supabase.co/auth/v1"

require File.expand_path("../config/environment", __dir__)
abort("The Rails environment is running in production mode!") if Rails.env.production?
require "rspec/rails"
require "spec_helper"

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => error
  abort error.to_s
end

RSpec.configure do |config|
  config.use_transactional_fixtures = false
  config.infer_spec_type_from_file_location!

  config.before do
    connection = ApplicationRecord.connection
    unless connection.pool.db_config.database.to_s.match?(/(?:\A|_)test(?:\z|_)/)
      raise "refusing to clean a database that is not explicitly named as a test database"
    end
    tables = connection.tables - %w[ar_internal_metadata schema_migrations]
    connection.execute("TRUNCATE TABLE #{tables.map { |table| connection.quote_table_name(table) }.join(', ')} RESTART IDENTITY CASCADE")
  end
end

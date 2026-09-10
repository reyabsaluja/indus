require "rails_helper"
require "open3"
require "tmpdir"

RSpec.describe "the production Docker entrypoint" do
  it "prepares the database before a Rails server command with bind arguments" do
    Dir.mktmpdir do |directory|
      bin = File.join(directory, "bin")
      FileUtils.mkdir_p(bin)
      File.write(File.join(bin, "rails"), <<~SH)
        #!/bin/sh
        echo "$*" >> "#{directory}/calls"
      SH
      FileUtils.chmod(0o755, File.join(bin, "rails"))

      _output, error, status = Open3.capture3(Rails.root.join("bin/docker-entrypoint").to_s,
        "./bin/rails", "server", "-b", "0.0.0.0", chdir: directory)

      expect(status).to be_success, error
      expect(File.readlines(File.join(directory, "calls"), chomp: true)).to eq([ "db:prepare", "server -b 0.0.0.0" ])
    end
  end
end

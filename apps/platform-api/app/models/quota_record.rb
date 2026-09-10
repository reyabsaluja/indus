class QuotaRecord < ActiveRecord::Base
  self.abstract_class = true
  establish_connection ActiveRecord::Base.configurations.configs_for(env_name: Rails.env, name: "primary")
end

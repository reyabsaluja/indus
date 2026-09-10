Rails.application.routes.draw do
  get "/healthz", to: "health#live"
  get "/readyz", to: "health#ready"

  namespace :v1 do
    resource :me, only: %i[show update], controller: "me"
    resources :favorites, only: %i[index create destroy]
    resources :portfolios do
      resources :positions, only: %i[index create update destroy]
    end
    resources :reports, only: %i[index show create destroy]
    get "market/summary", to: "market#summary"
    get "instruments/search", to: "instruments#search"
    get "fundamentals/:symbol", to: "fundamentals#show"
    post "explanations", to: "explanations#create"
    post "chat", to: "chat#create"
  end
end

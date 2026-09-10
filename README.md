# Indus - AI-Powered Financial Intelligence Platform

https://github.com/user-attachments/assets/82d2c5de-a971-4c8b-8481-fa68fcffc9e4

Indus is an intelligent financial analysis platform that provides comprehensive stock market data, real-time charts, and AI-powered insights to help investors make informed decisions. Built with Next.js, TypeScript, SSE, Alpaca API, Yahoo Finance, Google Gemini, and TradingView.

## Prerequisites

- [Bun](https://bun.sh/) v1.0 or later
- A [Supabase](https://supabase.com/) project (free tier works)
- An [Alpaca](https://alpaca.markets/) account (paper trading is fine)
- A [Google AI Studio](https://aistudio.google.com/) API key (for Gemini)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/vicdenz/indus.git
cd indus
```

### 2. Install dependencies

```bash
bun install --frozen-lockfile
```

### 3. Set up environment variables

Copy the example env file and fill in your keys:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard > Project Settings > API |
| `ALPACA_API_KEY` | Alpaca dashboard > Paper Trading > API Keys |
| `ALPACA_SECRET_KEY` | Alpaca dashboard > Paper Trading > API Keys |
| `ALPACA_IS_PAPER` | Set to `true` for paper trading (recommended) |
| `GEMINI_API_KEY` | Google AI Studio > Get API key |

### 4. Set up the database

Database schema, constraints, grants, row-level security policies, and AI quotas are versioned in `supabase/migrations/`. Apply the migrations in order through the Supabase CLI or your normal database migration process. Do not recreate tables from copied SQL snippets.

For a disposable local database:

```bash
bun run db:start
bun run db:reset
```

### 5. Run the development server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start the development server |
| `bun run build` | Create a production build |
| `bun start` | Run the production server |
| `bun run lint` | Run Biome lint checks |
| `bun run lint:fix` | Auto-fix lint issues |
| `bun run format` | Format code with Biome |
| `bun test` | Run unit tests (Vitest) |
| `bun run test:watch` | Run tests in watch mode |
| `bun run test:unit:coverage` | Run unit tests with enforced coverage thresholds |
| `bun run test:database` | Replay migrations and run local pgTAP security tests |
| `bun run test:integration` | Run local HTTP and auth-boundary integration tests |
| `bun run test:browser` | Run desktop and mobile cross-browser checks |
| `bun run test:accessibility` | Run WCAG A/AA accessibility checks |
| `bun run test:authenticated` | Run authenticated product and accessibility checks against an isolated local Supabase stack |
| `bun run test:performance` | Run production-mode local performance budgets |
| `bun run test:local` | Run the complete local quality sequence |

See [Quality and Security Verification](./docs/QUALITY.md) for prerequisites, security boundaries, quota policy, and troubleshooting.

## Documentation

| Document | Purpose |
|---|---|
| [Quality and Security Verification](./docs/QUALITY.md) | Security boundaries, local verification layers, budgets, and troubleshooting |
| [Runtime Reliability](./docs/RELIABILITY.md) | Provider deadlines, retries, caching, fallbacks, rate limits, health checks, and diagnostics |
| [Revamp Plan](./docs/REVAMP_PLAN.md) | In-progress application modernization plan retained during the revamp |
| [Market Data Architecture](./docs/architecture/market-data.md) | Phase 3 ingestion, event delivery, persistence, streaming, and AWS compatibility |
| [Market Data Runbook](./docs/runbooks/market-data.md) | Local startup, replay, failure response, retention, and rollback |
| [Distributed Research Workflows](./docs/architecture/distributed-research-workflows.md) | Kafka, Temporal, grounding, and artifact invariants |
| [Local Distributed Platform](./docs/runbooks/local-distributed-platform.md) | Start and verify the complete replacement stack locally |
| [Report Workflow Recovery](./docs/runbooks/report-workflow-recovery.md) | Cancel, replay, and dependency recovery procedures |
| [Migration Rehearsal](./docs/runbooks/migration-rehearsal.md) | Supabase export, Cognito limitations, reconciliation, and rollback |

## Features

### Comprehensive Financial Analytics

- **Real-time Stock Data** - Live prices, market data, and financial metrics via Yahoo Finance and Alpaca APIs
- **Interactive Charts** - Professional trading charts powered by TradingView's Lightweight Charts
- **50+ Financial Metrics** - Valuation ratios, margins, growth rates, financial health indicators, and more
- **Cryptocurrency Support** - Track popular cryptocurrencies alongside traditional stocks

### AI-Powered Intelligence

- **Metric Explanations** - Review definitions and value-specific context for financial metrics
- **Interactive Chat** - Click on any metric to open an AI chat panel for deeper analysis
- **Educational Content** - Built-in definitions and explanations for all financial terms
- **Streaming Responses** - Real-time AI responses with proper context understanding

### Advanced Search & Discovery

- **Universal Search** - Find any publicly traded company or cryptocurrency
- **Categorized Browsing** - Explore stocks by sector (Tech, Finance, Healthcare, Energy, etc.)
- **Trending Stocks** - Discover trending and popular investments
- **Favorites System** - Save and track your favorite companies

### User Management

- **Supabase Authentication** - Secure login with email/password or Google OAuth
- **Personal Dashboard** - Customized experience with saved favorites
- **Session Management** - Persistent login state across devices

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix) + Lucide icons + next-themes |
| Auth & DB | Supabase (PostgreSQL + Auth with Google OAuth) |
| State | Zustand + TanStack Query |
| AI | Google Gemini 3.8 Flash via the REST API |
| Real-time | SSE via Next.js Route Handlers (streams Alpaca WebSocket bars to clients) |
| Charts | TradingView Lightweight Charts v5 |
| Financial Data | Alpaca Trade API + Yahoo Finance 2 |
| Validation | Zod (API inputs + environment variables) |
| Linting | Biome |
| Testing | Vitest + pgTAP + Playwright + axe-core |

## License

This project is licensed under the MIT License - see the LICENSE file for details.

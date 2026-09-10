CREATE SCHEMA IF NOT EXISTS market_data;
REVOKE ALL ON SCHEMA market_data FROM PUBLIC;

CREATE TABLE market_data.consumed_events (
  event_id uuid PRIMARY KEY,
  topic text NOT NULL,
  partition_id integer NOT NULL,
  offset_id bigint NOT NULL,
  occurred_at timestamptz NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (topic, partition_id, offset_id)
);

CREATE TABLE market_data.rejected_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id text,
  topic text NOT NULL,
  partition_id integer NOT NULL,
  offset_id bigint NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  payload bytea NOT NULL,
  rejected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (topic, partition_id, offset_id)
);

CREATE TABLE market_data.bars (
  event_id uuid NOT NULL,
  symbol varchar(20) NOT NULL,
  asset_class varchar(16) NOT NULL CHECK (asset_class IN ('equity', 'crypto')),
  interval_name varchar(8) NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL CHECK (window_end > window_start),
  open_price numeric(30, 12) NOT NULL,
  high_price numeric(30, 12) NOT NULL,
  low_price numeric(30, 12) NOT NULL,
  close_price numeric(30, 12) NOT NULL,
  volume numeric(38, 12) NOT NULL CHECK (volume >= 0),
  trade_count bigint NOT NULL CHECK (trade_count >= 0),
  volume_weighted_price numeric(30, 12),
  provider_sequence bigint NOT NULL CHECK (provider_sequence >= 0),
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY (event_id, window_start)
) PARTITION BY RANGE (window_start);

CREATE TABLE market_data.bars_default PARTITION OF market_data.bars DEFAULT;
CREATE INDEX bars_symbol_window_idx ON market_data.bars (symbol, interval_name, window_start DESC);

CREATE TABLE market_data.quotes (
  event_id uuid NOT NULL,
  symbol varchar(20) NOT NULL,
  asset_class varchar(16) NOT NULL CHECK (asset_class IN ('equity', 'crypto')),
  observed_at timestamptz NOT NULL,
  bid_price numeric(30, 12) NOT NULL,
  ask_price numeric(30, 12) NOT NULL CHECK (ask_price >= bid_price),
  bid_size numeric(38, 12) NOT NULL CHECK (bid_size >= 0),
  ask_size numeric(38, 12) NOT NULL CHECK (ask_size >= 0),
  conditions text[] NOT NULL DEFAULT '{}',
  tape varchar(8) NOT NULL DEFAULT '',
  provider_sequence bigint NOT NULL CHECK (provider_sequence >= 0),
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY (event_id, observed_at)
) PARTITION BY RANGE (observed_at);

CREATE TABLE market_data.quotes_default PARTITION OF market_data.quotes DEFAULT;
CREATE INDEX quotes_symbol_observed_idx ON market_data.quotes (symbol, observed_at DESC);

CREATE TABLE market_data.feed_measurements (
  measured_at timestamptz NOT NULL,
  connected boolean NOT NULL,
  last_event_at timestamptz,
  PRIMARY KEY (measured_at)
) PARTITION BY RANGE (measured_at);

CREATE TABLE market_data.feed_measurements_default PARTITION OF market_data.feed_measurements DEFAULT;

CREATE OR REPLACE FUNCTION market_data.ensure_monthly_partitions(months_ahead integer DEFAULT 2)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, market_data
AS $$
DECLARE
  start_date date;
  end_date date;
  suffix text;
  table_name text;
BEGIN
  IF months_ahead < 0 OR months_ahead > 12 THEN
    RAISE EXCEPTION 'months_ahead must be between 0 and 12';
  END IF;
  FOR offset_month IN -1..months_ahead LOOP
    start_date := (date_trunc('month', current_date) + make_interval(months => offset_month))::date;
    end_date := (start_date + interval '1 month')::date;
    suffix := to_char(start_date, 'YYYY_MM');
    FOREACH table_name IN ARRAY ARRAY['bars', 'quotes', 'feed_measurements'] LOOP
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS market_data.%I PARTITION OF market_data.%I FOR VALUES FROM (%L) TO (%L)',
        table_name || '_' || suffix, table_name, start_date, end_date
      );
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION market_data.apply_retention(retention_days integer)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, market_data
AS $$
BEGIN
  IF retention_days < 7 OR retention_days > 3650 THEN
    RAISE EXCEPTION 'retention_days must be between 7 and 3650';
  END IF;
  DELETE FROM market_data.bars WHERE window_start < clock_timestamp() - make_interval(days => retention_days);
  DELETE FROM market_data.quotes WHERE observed_at < clock_timestamp() - make_interval(days => LEAST(retention_days, 30));
  DELETE FROM market_data.feed_measurements WHERE measured_at < clock_timestamp() - make_interval(days => retention_days);
  DELETE FROM market_data.consumed_events WHERE consumed_at < clock_timestamp() - make_interval(days => retention_days + 7);
END;
$$;

SELECT market_data.ensure_monthly_partitions(2);

REVOKE ALL ON ALL TABLES IN SCHEMA market_data FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA market_data FROM PUBLIC;

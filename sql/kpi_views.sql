-- ============================================================
-- GridLens KPI Views for Electric Loss Analysis
-- Run this against your Azure PostgreSQL database
-- ============================================================

-- View 1: v_kpi_electric_overview_daily
-- Daily aggregated electric loss overview by tenant
CREATE OR REPLACE VIEW v_kpi_electric_overview_daily AS
WITH feeder_totals AS (
  SELECT
    m.tenant_id,
    DATE(mre.read_at) AS day,
    f.id AS feeder_id,
    COALESCE(SUM(mre.kwh), 0) AS meter_kwh,
    COALESCE(MAX(f.input_kwh), 0) AS feeder_input_kwh
  FROM meter_reads_electric mre
  JOIN meters m ON m.id = mre.meter_id
  JOIN feeders f ON f.id = m.feeder_id
  WHERE mre.read_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY m.tenant_id, DATE(mre.read_at), f.id
),
daily_loss AS (
  SELECT
    tenant_id,
    day,
    SUM(feeder_input_kwh) AS total_input_kwh,
    SUM(meter_kwh) AS total_meter_kwh,
    GREATEST(SUM(feeder_input_kwh) - SUM(meter_kwh), 0) AS loss_kwh
  FROM feeder_totals
  GROUP BY tenant_id, day
),
top_feeders AS (
  SELECT
    tenant_id,
    day,
    jsonb_agg(
      jsonb_build_object(
        'feederId', feeder_id,
        'lossKwh', GREATEST(feeder_input_kwh - meter_kwh, 0)
      ) ORDER BY (feeder_input_kwh - meter_kwh) DESC
    ) FILTER (WHERE feeder_input_kwh > meter_kwh) AS top_loss_feeders
  FROM feeder_totals
  GROUP BY tenant_id, day
)
SELECT
  dl.tenant_id,
  dl.day,
  dl.loss_kwh AS total_loss_kwh,
  CASE 
    WHEN dl.total_input_kwh > 0 
    THEN ROUND((dl.loss_kwh / dl.total_input_kwh * 100)::numeric, 2)
    ELSE 0
  END AS loss_percent_pct,
  COALESCE(tf.top_loss_feeders, '[]'::jsonb) AS top_loss_feeders,
  NOW() AS last_updated
FROM daily_loss dl
LEFT JOIN top_feeders tf ON tf.tenant_id = dl.tenant_id AND tf.day = dl.day;


-- View 2: v_kpi_electric_feeder_loss_daily
-- Daily feeder-level loss breakdown
CREATE OR REPLACE VIEW v_kpi_electric_feeder_loss_daily AS
SELECT
  m.tenant_id,
  DATE(mre.read_at) AS day,
  f.id AS feeder_id,
  GREATEST(COALESCE(MAX(f.input_kwh), 0) - COALESCE(SUM(mre.kwh), 0), 0) AS loss_kwh,
  CASE 
    WHEN COALESCE(MAX(f.input_kwh), 0) > 0 
    THEN ROUND(
      (GREATEST(COALESCE(MAX(f.input_kwh), 0) - COALESCE(SUM(mre.kwh), 0), 0) 
       / NULLIF(MAX(f.input_kwh), 0))::numeric, 4
    )
    ELSE 0
  END AS loss_percent
FROM meter_reads_electric mre
JOIN meters m ON m.id = mre.meter_id
JOIN feeders f ON f.id = m.feeder_id
WHERE mre.read_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY m.tenant_id, DATE(mre.read_at), f.id;


-- View 3: v_kpi_suspicious_meters_daily
-- Daily suspicious meter detection based on voltage/usage anomalies
CREATE OR REPLACE VIEW v_kpi_suspicious_meters_daily AS
WITH meter_daily_stats AS (
  SELECT
    m.tenant_id,
    DATE(mre.read_at) AS day,
    mre.meter_id,
    SUM(mre.kwh) AS daily_kwh,
    AVG(mre.voltage) AS avg_voltage,
    MAX(mre.voltage) AS max_voltage,
    MIN(mre.voltage) AS min_voltage,
    AVG(mre.demand_kw) AS avg_demand,
    COUNT(*) AS read_count
  FROM meter_reads_electric mre
  JOIN meters m ON m.id = mre.meter_id
  WHERE mre.read_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY m.tenant_id, DATE(mre.read_at), mre.meter_id
),
meter_baseline AS (
  SELECT
    meter_id,
    AVG(daily_kwh) AS baseline_kwh,
    AVG(avg_demand) AS baseline_demand
  FROM meter_daily_stats
  WHERE day < CURRENT_DATE - INTERVAL '1 day'
  GROUP BY meter_id
)
SELECT
  mds.tenant_id,
  mds.day,
  mds.meter_id,
  CASE
    WHEN mds.min_voltage < 108 OR mds.max_voltage > 132 
      THEN 'VOLTAGE_ANOMALY: Voltage outside normal range (108-132V)'
    WHEN mds.daily_kwh = 0 AND mds.read_count > 0 
      THEN 'ZERO_USAGE: Zero kWh during active read period'
    WHEN mb.baseline_demand > 0 
      AND ABS(mds.avg_demand - mb.baseline_demand) / mb.baseline_demand > 0.5 
      THEN 'DEMAND_ANOMALY: Demand deviates >50% from baseline'
    WHEN mb.baseline_kwh > 0 
      AND mds.daily_kwh > mb.baseline_kwh * 3 
      THEN 'SPIKE_DETECTED: Usage >300% of baseline'
    WHEN mb.baseline_kwh > 10 
      AND mds.daily_kwh < mb.baseline_kwh * 0.1 
      THEN 'DROP_DETECTED: Usage <10% of baseline'
    ELSE NULL
  END AS issue
FROM meter_daily_stats mds
LEFT JOIN meter_baseline mb ON mb.meter_id = mds.meter_id
WHERE 
  (mds.min_voltage < 108 OR mds.max_voltage > 132)
  OR (mds.daily_kwh = 0 AND mds.read_count > 0)
  OR (mb.baseline_demand > 0 AND ABS(mds.avg_demand - mb.baseline_demand) / mb.baseline_demand > 0.5)
  OR (mb.baseline_kwh > 0 AND mds.daily_kwh > mb.baseline_kwh * 3)
  OR (mb.baseline_kwh > 10 AND mds.daily_kwh < mb.baseline_kwh * 0.1);


-- ============================================================
-- Verification Queries (run after creating views)
-- ============================================================
-- SELECT COUNT(*) AS overview_count FROM v_kpi_electric_overview_daily;
-- SELECT COUNT(*) AS feeder_count FROM v_kpi_electric_feeder_loss_daily;
-- SELECT COUNT(*) AS suspicious_count FROM v_kpi_suspicious_meters_daily;

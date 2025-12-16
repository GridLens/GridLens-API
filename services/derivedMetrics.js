import { pool } from '../db.js';

const DEFAULT_TARIFF_PER_KWH = 0.12;

export async function getMeterHealthIndex(tenantId) {
  const query = `
    WITH latest_reads AS (
      SELECT 
        meter_id,
        feeder_id,
        voltage,
        kwh,
        read_at,
        ROW_NUMBER() OVER (PARTITION BY meter_id ORDER BY read_at DESC) as rn
      FROM meter_reads_electric
      WHERE tenant_id = $1
    ),
    meter_stats AS (
      SELECT 
        lr.meter_id,
        lr.feeder_id,
        lr.voltage,
        lr.read_at as last_read_at,
        EXTRACT(EPOCH FROM (NOW() - lr.read_at)) / 60 as minutes_since_read,
        CASE WHEN lr.voltage >= 114 AND lr.voltage <= 126 THEN 1 ELSE 0 END as voltage_ok,
        COALESCE(ec.event_count, 0) as event_count
      FROM latest_reads lr
      LEFT JOIN (
        SELECT feeder_id, COUNT(*) as event_count
        FROM ami_events
        WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY feeder_id
      ) ec ON lr.feeder_id = ec.feeder_id
      WHERE lr.rn = 1
    ),
    scored AS (
      SELECT 
        meter_id,
        feeder_id,
        last_read_at,
        minutes_since_read,
        voltage_ok,
        event_count,
        GREATEST(0, LEAST(100,
          25 * CASE WHEN minutes_since_read <= 15 THEN 1.0
                    WHEN minutes_since_read <= 60 THEN 0.7
                    WHEN minutes_since_read <= 240 THEN 0.4
                    ELSE 0.1 END +
          25 * voltage_ok +
          25 * CASE WHEN event_count = 0 THEN 1.0
                    WHEN event_count <= 2 THEN 0.7
                    WHEN event_count <= 5 THEN 0.4
                    ELSE 0.1 END +
          25 * 0.95
        )) as health_score
      FROM meter_stats
    )
    SELECT 
      ROUND(AVG(health_score)::numeric, 1) as system_health_index,
      COUNT(*) as total_meters,
      COUNT(*) FILTER (WHERE health_score >= 90) as excellent_count,
      COUNT(*) FILTER (WHERE health_score >= 75 AND health_score < 90) as good_count,
      COUNT(*) FILTER (WHERE health_score >= 60 AND health_score < 75) as fair_count,
      COUNT(*) FILTER (WHERE health_score >= 40 AND health_score < 60) as poor_count,
      COUNT(*) FILTER (WHERE health_score < 40) as critical_count
    FROM scored
  `;
  
  const result = await pool.query(query, [tenantId]);
  const row = result.rows[0] || {};
  
  const systemIndex = parseFloat(row.system_health_index) || 85;
  const total = parseInt(row.total_meters) || 0;
  
  let status = 'Excellent';
  let statusColor = 'success';
  if (systemIndex < 60) { status = 'Critical'; statusColor = 'danger'; }
  else if (systemIndex < 75) { status = 'Fair'; statusColor = 'warning'; }
  else if (systemIndex < 90) { status = 'Good'; statusColor = 'success'; }
  
  return {
    systemHealthIndex: systemIndex,
    status,
    statusColor,
    distribution: {
      excellent: parseInt(row.excellent_count) || 0,
      good: parseInt(row.good_count) || 0,
      fair: parseInt(row.fair_count) || 0,
      poor: parseInt(row.poor_count) || 0,
      critical: parseInt(row.critical_count) || 0
    },
    totalMeters: total
  };
}

export async function getFeederHealthIndex(tenantId) {
  const query = `
    WITH latest_reads AS (
      SELECT 
        meter_id,
        feeder_id,
        voltage,
        read_at,
        ROW_NUMBER() OVER (PARTITION BY meter_id ORDER BY read_at DESC) as rn
      FROM meter_reads_electric
      WHERE tenant_id = $1
    ),
    feeder_stats AS (
      SELECT 
        lr.feeder_id,
        COUNT(*) as meter_count,
        AVG(CASE WHEN lr.voltage >= 114 AND lr.voltage <= 126 THEN 1 ELSE 0 END) as voltage_compliance,
        AVG(EXTRACT(EPOCH FROM (NOW() - lr.read_at)) / 60) as avg_read_age_min,
        COALESCE(ec.event_count, 0) as event_count
      FROM latest_reads lr
      LEFT JOIN (
        SELECT feeder_id, COUNT(*) as event_count
        FROM ami_events
        WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY feeder_id
      ) ec ON lr.feeder_id = ec.feeder_id
      WHERE lr.rn = 1
      GROUP BY lr.feeder_id, ec.event_count
    )
    SELECT 
      feeder_id,
      meter_count,
      ROUND((voltage_compliance * 100)::numeric, 1) as voltage_compliance_pct,
      ROUND(avg_read_age_min::numeric, 1) as avg_read_age_min,
      event_count,
      ROUND((
        25 * CASE WHEN avg_read_age_min <= 15 THEN 1.0
                  WHEN avg_read_age_min <= 60 THEN 0.7
                  ELSE 0.4 END +
        25 * voltage_compliance +
        25 * CASE WHEN event_count = 0 THEN 1.0
                  WHEN event_count <= 2 THEN 0.7
                  ELSE 0.4 END +
        25 * 0.95
      )::numeric, 1) as health_index
    FROM feeder_stats
    ORDER BY health_index ASC
    LIMIT 10
  `;
  
  const result = await pool.query(query, [tenantId]);
  return result.rows.map(r => ({
    feederId: r.feeder_id,
    meterCount: parseInt(r.meter_count),
    healthIndex: parseFloat(r.health_index),
    voltageCompliancePct: parseFloat(r.voltage_compliance_pct),
    avgReadAgeMin: parseFloat(r.avg_read_age_min),
    eventCount: parseInt(r.event_count)
  }));
}

export async function getLastGoodReadAgeDistribution(tenantId) {
  const query = `
    WITH latest_reads AS (
      SELECT 
        meter_id,
        read_at,
        ROW_NUMBER() OVER (PARTITION BY meter_id ORDER BY read_at DESC) as rn
      FROM meter_reads_electric
      WHERE tenant_id = $1
    ),
    age_buckets AS (
      SELECT 
        meter_id,
        EXTRACT(EPOCH FROM (NOW() - read_at)) / 60 as minutes_since_read
      FROM latest_reads
      WHERE rn = 1
    )
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE minutes_since_read <= 15) as within_15min,
      COUNT(*) FILTER (WHERE minutes_since_read > 15 AND minutes_since_read <= 60) as within_60min,
      COUNT(*) FILTER (WHERE minutes_since_read > 60) as over_60min
    FROM age_buckets
  `;
  
  const result = await pool.query(query, [tenantId]);
  const row = result.rows[0] || {};
  
  const total = parseInt(row.total) || 1;
  const within15 = parseInt(row.within_15min) || 0;
  const within60 = parseInt(row.within_60min) || 0;
  const over60 = parseInt(row.over_60min) || 0;
  
  return {
    totalMeters: total,
    distribution: {
      within15min: { count: within15, pct: Math.round((within15 / total) * 100) },
      within60min: { count: within60, pct: Math.round((within60 / total) * 100) },
      over60min: { count: over60, pct: Math.round((over60 / total) * 100) }
    },
    staleMetersPct: Math.round((over60 / total) * 100),
    freshReadsPct: Math.round((within15 / total) * 100)
  };
}

export async function getExceptionVelocity(tenantId) {
  const query = `
    WITH current_interval AS (
      SELECT COUNT(*) as count
      FROM ami_events
      WHERE tenant_id = $1 
        AND created_at > NOW() - INTERVAL '15 minutes'
    ),
    prior_interval AS (
      SELECT COUNT(*) as count
      FROM ami_events
      WHERE tenant_id = $1 
        AND created_at > NOW() - INTERVAL '30 minutes'
        AND created_at <= NOW() - INTERVAL '15 minutes'
    ),
    baseline_24h AS (
      SELECT COUNT(*)::float / 96 as avg_per_interval
      FROM ami_events
      WHERE tenant_id = $1 
        AND created_at > NOW() - INTERVAL '24 hours'
    )
    SELECT 
      c.count as current_count,
      p.count as prior_count,
      ROUND(b.avg_per_interval::numeric, 1) as baseline_avg
    FROM current_interval c, prior_interval p, baseline_24h b
  `;
  
  const result = await pool.query(query, [tenantId]);
  const row = result.rows[0] || {};
  
  const current = parseInt(row.current_count) || 0;
  const prior = parseInt(row.prior_count) || 0;
  const baseline = parseFloat(row.baseline_avg) || 0;
  
  const vsPrior = prior > 0 ? Math.round(((current - prior) / prior) * 100) : 0;
  const vsBaseline = baseline > 0 ? Math.round(((current - baseline) / baseline) * 100) : 0;
  
  let trend = 'stable';
  let trendIcon = '→';
  if (vsPrior > 20) { trend = 'increasing'; trendIcon = '↑'; }
  else if (vsPrior < -20) { trend = 'decreasing'; trendIcon = '↓'; }
  
  let severity = 'normal';
  if (current > baseline * 2) severity = 'elevated';
  if (current > baseline * 3) severity = 'critical';
  
  return {
    currentIntervalCount: current,
    priorIntervalCount: prior,
    baseline24hAvg: baseline,
    changeVsPriorPct: vsPrior,
    changeVsBaselinePct: vsBaseline,
    trend,
    trendIcon,
    severity
  };
}

export async function getEstimatedBillingExposure(tenantId, tariffPerKwh = DEFAULT_TARIFF_PER_KWH) {
  const query = `
    WITH problem_feeders AS (
      SELECT DISTINCT feeder_id
      FROM ami_events
      WHERE tenant_id = $1 AND is_active = true
    ),
    problem_meters_from_wo AS (
      SELECT DISTINCT meter_id
      FROM field_work_orders
      WHERE tenant_id = $1 AND status IN ('open', 'assigned', 'in_progress')
    ),
    affected_by_feeder AS (
      SELECT 
        COUNT(DISTINCT mr.meter_id) as affected_meter_count,
        COALESCE(SUM(mr.kwh), 0) as total_affected_kwh,
        AVG(mr.kwh) as avg_kwh_per_read
      FROM meter_reads_electric mr
      WHERE mr.tenant_id = $1
        AND mr.read_at > NOW() - INTERVAL '24 hours'
        AND (mr.feeder_id IN (SELECT feeder_id FROM problem_feeders)
             OR mr.meter_id IN (SELECT meter_id FROM problem_meters_from_wo))
    ),
    existing_exposure AS (
      SELECT COALESCE(SUM(estimated_loss_dollars), 0) as fieldops_exposure
      FROM field_work_orders
      WHERE tenant_id = $1 AND status IN ('open', 'assigned', 'in_progress')
    )
    SELECT 
      af.affected_meter_count,
      ROUND(af.total_affected_kwh::numeric, 2) as total_affected_kwh,
      ROUND(af.avg_kwh_per_read::numeric, 2) as avg_kwh_per_read,
      ROUND(ee.fieldops_exposure::numeric, 2) as fieldops_exposure
    FROM affected_by_feeder af, existing_exposure ee
  `;
  
  const result = await pool.query(query, [tenantId]);
  const row = result.rows[0] || {};
  
  const affectedMeters = parseInt(row.affected_meter_count) || 0;
  const totalKwh = parseFloat(row.total_affected_kwh) || 0;
  const avgKwh = parseFloat(row.avg_kwh_per_read) || 0;
  const fieldopsExposure = parseFloat(row.fieldops_exposure) || 0;
  
  const dailyProjectedLoss = affectedMeters * avgKwh * 96;
  const estimatedDailyExposure = dailyProjectedLoss * tariffPerKwh;
  const monthlyExposure = estimatedDailyExposure * 30;
  
  return {
    affectedMeterCount: affectedMeters,
    totalAffectedKwh24h: totalKwh,
    avgKwhPerRead: avgKwh,
    tariffPerKwh,
    estimatedDailyExposure: Math.round(estimatedDailyExposure * 100) / 100,
    estimatedMonthlyExposure: Math.round(monthlyExposure * 100) / 100,
    fieldopsRevenueAtRisk: fieldopsExposure,
    combinedExposure: Math.round((estimatedDailyExposure + fieldopsExposure) * 100) / 100
  };
}

export async function getDataConfidenceIndicator(tenantId) {
  const query = `
    WITH read_stats AS (
      SELECT 
        COUNT(DISTINCT meter_id) as meters_reporting,
        COUNT(*) as total_reads,
        COUNT(*) FILTER (WHERE voltage < 114 OR voltage > 126) as voltage_exceptions,
        COUNT(*) FILTER (WHERE kwh = 0) as zero_reads,
        MAX(read_at) as latest_read
      FROM meter_reads_electric
      WHERE tenant_id = $1 
        AND read_at > NOW() - INTERVAL '15 minutes'
    ),
    fleet_size AS (
      SELECT COUNT(DISTINCT meter_id) as expected_meters
      FROM meter_reads_electric
      WHERE tenant_id = $1
    ),
    active_events AS (
      SELECT COUNT(*) as active_event_count
      FROM ami_events
      WHERE tenant_id = $1 AND is_active = true
    )
    SELECT 
      rs.meters_reporting,
      rs.total_reads,
      rs.voltage_exceptions,
      rs.zero_reads,
      rs.latest_read,
      fs.expected_meters,
      ae.active_event_count
    FROM read_stats rs, fleet_size fs, active_events ae
  `;
  
  const result = await pool.query(query, [tenantId]);
  const row = result.rows[0] || {};
  
  const metersReporting = parseInt(row.meters_reporting) || 0;
  const expectedMeters = parseInt(row.expected_meters) || 25000;
  const voltageExceptions = parseInt(row.voltage_exceptions) || 0;
  const zeroReads = parseInt(row.zero_reads) || 0;
  const activeEvents = parseInt(row.active_event_count) || 0;
  const latestRead = row.latest_read;
  
  const coveragePct = (metersReporting / expectedMeters) * 100;
  const exceptionPct = metersReporting > 0 ? (voltageExceptions / metersReporting) * 100 : 0;
  const readAgeMinutes = latestRead 
    ? (Date.now() - new Date(latestRead).getTime()) / 60000 
    : 999;
  
  let status = 'High';
  let statusColor = 'success';
  let issues = [];
  
  if (coveragePct < 50) {
    status = 'Partial';
    statusColor = 'danger';
    issues.push(`Only ${Math.round(coveragePct)}% coverage`);
  } else if (coveragePct < 90) {
    status = 'Degraded';
    statusColor = 'warning';
    issues.push(`${Math.round(coveragePct)}% coverage`);
  }
  
  if (exceptionPct > 10) {
    status = status === 'High' ? 'Degraded' : status;
    statusColor = statusColor === 'success' ? 'warning' : statusColor;
    issues.push(`${exceptionPct.toFixed(1)}% exceptions`);
  }
  
  if (readAgeMinutes > 20) {
    status = status === 'High' ? 'Degraded' : status;
    statusColor = statusColor === 'success' ? 'warning' : statusColor;
    issues.push(`Data ${Math.round(readAgeMinutes)}min stale`);
  }
  
  if (activeEvents > 10) {
    issues.push(`${activeEvents} active events`);
  }
  
  return {
    status,
    statusColor,
    coveragePct: Math.round(coveragePct * 10) / 10,
    exceptionPct: Math.round(exceptionPct * 10) / 10,
    readAgeMinutes: Math.round(readAgeMinutes),
    activeEventCount: activeEvents,
    metersReporting,
    expectedMeters,
    issues,
    message: issues.length > 0 ? issues.join(', ') : 'All systems nominal'
  };
}

export async function getAllDerivedMetrics(tenantId, tariffPerKwh = DEFAULT_TARIFF_PER_KWH) {
  const [
    meterHealth,
    readAgeDistribution,
    exceptionVelocity,
    billingExposure,
    dataConfidence
  ] = await Promise.all([
    getMeterHealthIndex(tenantId),
    getLastGoodReadAgeDistribution(tenantId),
    getExceptionVelocity(tenantId),
    getEstimatedBillingExposure(tenantId, tariffPerKwh),
    getDataConfidenceIndicator(tenantId)
  ]);
  
  return {
    meterHealthIndex: meterHealth,
    lastGoodReadAge: readAgeDistribution,
    exceptionVelocity,
    billingExposure,
    dataConfidence,
    generatedAt: new Date().toISOString()
  };
}

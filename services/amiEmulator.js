import { pool } from "../db.js";
import { amiQueue } from "../queues/amiQueue.js";

function alignToInterval(date, intervalMinutes) {
  const ms = date.getTime();
  const intervalMs = intervalMinutes * 60 * 1000;
  return new Date(Math.floor(ms / intervalMs) * intervalMs);
}

function getBaselineKwh(hour) {
  if (hour >= 6 && hour < 9) return 35;
  if (hour >= 9 && hour < 17) return 45;
  if (hour >= 17 && hour < 21) return 55;
  if (hour >= 21 && hour < 23) return 40;
  return 20;
}

function applyNoise(value, noiseFactor = 0.15) {
  const noise = (Math.random() - 0.5) * 2 * noiseFactor * value;
  return Math.max(0, value + noise);
}

async function getActiveEvents(tenantId, feederId, readAt) {
  try {
    const result = await pool.query(
      `SELECT event_type, severity, starts_at, ends_at 
       FROM ami_events 
       WHERE tenant_id = $1 
         AND (feeder_id = $2 OR feeder_id IS NULL)
         AND starts_at <= $3 
         AND ends_at > $3
       ORDER BY created_at DESC`,
      [tenantId, feederId, readAt.toISOString()]
    );
    return result.rows;
  } catch (err) {
    console.log("No ami_events table or query error:", err.message);
    return [];
  }
}

function applyEventEffects(reading, events) {
  let modified = { ...reading };
  
  for (const event of events) {
    const severity = parseFloat(event.severity) || 0.5;
    
    switch (event.event_type) {
      case 'theft':
        modified.kwh = modified.kwh * (1 - severity);
        break;
      case 'comms-outage':
        modified.skip = true;
        break;
      case 'voltage-sag':
        modified.voltage = 108 + Math.random() * 6;
        break;
    }
  }
  
  return modified;
}

function generateSyntheticReading(meterId, feederId, tenantId, readAt) {
  const hour = readAt.getHours();
  const baseKwh = getBaselineKwh(hour);
  const kwh = applyNoise(baseKwh, 0.15);
  const voltage = applyNoise(120, 0.02);
  
  return {
    tenant_id: tenantId,
    meter_id: meterId,
    feeder_id: feederId,
    kwh: parseFloat(kwh.toFixed(2)),
    voltage: parseFloat(voltage.toFixed(1)),
    read_at: readAt.toISOString()
  };
}

export async function buildAndEnqueueReadBatches({ 
  tenantId = "DEMO_TENANT", 
  intervalMinutes = 15, 
  batchSize = 100
}) {
  const result = await pool.query(
    `SELECT m.id AS meter_id, m.feeder_id
     FROM meters m 
     JOIN feeders f ON f.id = m.feeder_id 
     WHERE m.tenant_id = $1 OR $1 = 'DEMO_TENANT'
     ORDER BY m.feeder_id, m.id`,
    [tenantId]
  );

  if (result.rows.length === 0) {
    console.log("No meters found for tenant:", tenantId);
    return { queued: 0, batches: 0 };
  }

  const metersByFeeder = {};
  for (const row of result.rows) {
    const fid = row.feeder_id;
    if (!metersByFeeder[fid]) {
      metersByFeeder[fid] = [];
    }
    metersByFeeder[fid].push(row.meter_id);
  }

  const readAt = alignToInterval(new Date(), intervalMinutes);
  let totalQueued = 0;
  let batchCount = 0;

  for (const [feederId, meterIds] of Object.entries(metersByFeeder)) {
    const events = await getActiveEvents(tenantId, feederId, readAt);
    
    for (let i = 0; i < meterIds.length; i += batchSize) {
      const batchMeters = meterIds.slice(i, i + batchSize);
      
      const readings = [];
      for (const meterId of batchMeters) {
        let reading = generateSyntheticReading(meterId, feederId, tenantId, readAt);
        reading = applyEventEffects(reading, events);
        
        if (!reading.skip) {
          readings.push(reading);
        }
      }

      if (readings.length > 0) {
        await amiQueue.add("ingest-batch", {
          tenantId,
          feederId,
          readings,
          intervalMinutes,
          timestamp: readAt.toISOString()
        });

        totalQueued += readings.length;
        batchCount++;
      }
    }
  }

  console.log(`Enqueued ${totalQueued} readings in ${batchCount} batches for tenant ${tenantId}`);
  return { queued: totalQueued, batches: batchCount, timestamp: readAt.toISOString() };
}

export async function createEvent({ tenantId, feederId, eventType, durationMinutes = 60, severity = 0.5 }) {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
  
  const result = await pool.query(
    `INSERT INTO ami_events (tenant_id, feeder_id, event_type, severity, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, tenant_id, feeder_id, event_type, severity, starts_at, ends_at`,
    [tenantId, feederId, eventType, severity, startsAt.toISOString(), endsAt.toISOString()]
  );
  
  return result.rows[0];
}

export async function getQueueStatus() {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      amiQueue.getWaitingCount(),
      amiQueue.getActiveCount(),
      amiQueue.getCompletedCount(),
      amiQueue.getFailedCount()
    ]);
    return { waiting, active, completed, failed };
  } catch (err) {
    return { error: err.message };
  }
}

export async function getActiveEventsForTenant(tenantId) {
  try {
    const result = await pool.query(
      `SELECT id, feeder_id, event_type, severity, starts_at, ends_at
       FROM ami_events 
       WHERE tenant_id = $1 AND ends_at > NOW()
       ORDER BY starts_at DESC
       LIMIT 20`,
      [tenantId]
    );
    return result.rows;
  } catch (err) {
    return [];
  }
}

export async function getLastIngestTimestamp(tenantId) {
  try {
    const result = await pool.query(
      `SELECT MAX(read_at) as last_read FROM meter_reads_electric WHERE tenant_id = $1`,
      [tenantId]
    );
    return result.rows[0]?.last_read || null;
  } catch (err) {
    return null;
  }
}

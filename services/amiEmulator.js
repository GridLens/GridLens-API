import { pool } from "../db.js";
import { amiQueue } from "../queues/amiQueue.js";

let demoMode = false;
let lastPublishAt = null;
let lastEventInjected = null;
let kpiSnapshotBeforeEvent = null;

export function setDemoMode(enabled) {
  demoMode = enabled;
  if (demoMode) {
    console.log("[DEMO MODE] Demo mode ENABLED - deterministic behavior active");
  } else {
    console.log("[DEMO MODE] Demo mode DISABLED");
  }
  return demoMode;
}

export function getDemoMode() {
  return demoMode;
}

export function getLastPublishAt() {
  return lastPublishAt;
}

export function getLastEventInjected() {
  return lastEventInjected;
}

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
  if (demoMode) {
    return value;
  }
  const noise = (Math.random() - 0.5) * 2 * noiseFactor * value;
  return Math.max(0, value + noise);
}

async function getActiveEvents(tenantId, feederId, readAt) {
  try {
    const result = await pool.query(
      `SELECT event_type, severity, start_at, end_at 
       FROM ami_events 
       WHERE tenant_id = $1 
         AND (feeder_id = $2 OR feeder_id IS NULL)
         AND start_at <= $3 
         AND end_at > $3
         AND is_active = true
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
        if (demoMode) {
          modified.voltage = 108.5;
        } else {
          modified.voltage = 105 + Math.random() * 7;
        }
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
    `SELECT m.meter_id, m.feeder_id
     FROM meters m 
     JOIN feeders f ON f.id = m.feeder_id 
     WHERE m.tenant_id = $1 OR $1 = 'DEMO_TENANT'
     ORDER BY m.feeder_id, m.meter_id`,
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

  lastPublishAt = readAt.toISOString();
  
  if (demoMode) {
    console.log(`[DEMO MODE] Published ${totalQueued} readings in ${batchCount} batches for tenant ${tenantId} at ${lastPublishAt}`);
    
    setTimeout(async () => {
      const beforeSnap = kpiSnapshotBeforeEvent;
      const validation = await validateKpiMovement(tenantId, beforeSnap);
      
      if (beforeSnap) {
        const suspBefore = beforeSnap.suspiciousMetersCount || 0;
        const suspAfter = validation.snapshot?.suspiciousMetersCount || 0;
        const tasksBefore = beforeSnap.totalFieldopsTasks || 0;
        const tasksAfter = validation.snapshot?.totalFieldopsTasks || 0;
        
        if (suspBefore === suspAfter && tasksBefore === tasksAfter) {
          console.warn(`[DEMO MODE] WARNING: No KPI movement detected! Before: suspicious=${suspBefore}, tasks=${tasksBefore} | After: suspicious=${suspAfter}, tasks=${tasksAfter}. Event may not have affected reads.`);
        } else {
          console.log(`[DEMO MODE] KPI movement detected! Before: suspicious=${suspBefore}, tasks=${tasksBefore} | After: suspicious=${suspAfter}, tasks=${tasksAfter}`);
        }
      } else {
        console.log(`[DEMO MODE] KPI snapshot (no comparison): suspiciousMeters=${validation.snapshot?.suspiciousMetersCount}, fieldopsTasks=${validation.snapshot?.totalFieldopsTasks}`);
      }
      
      kpiSnapshotBeforeEvent = null;
    }, 2000);
  } else {
    console.log(`Enqueued ${totalQueued} readings in ${batchCount} batches for tenant ${tenantId}`);
  }
  
  return { queued: totalQueued, batches: batchCount, timestamp: readAt.toISOString() };
}

export async function createEvent({ tenantId, feederId, eventType, durationMinutes = 60, severity = 0.5 }) {
  const startAt = new Date();
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
  
  if (demoMode) {
    const beforeSnapshot = await validateKpiMovement(tenantId);
    kpiSnapshotBeforeEvent = beforeSnapshot.snapshot;
    console.log(`[DEMO MODE] Captured KPI snapshot before event: suspiciousMeters=${kpiSnapshotBeforeEvent?.suspiciousMetersCount}, fieldopsTasks=${kpiSnapshotBeforeEvent?.totalFieldopsTasks}`);
    
    const existingEvents = await pool.query(
      `SELECT id, event_type FROM ami_events 
       WHERE tenant_id = $1 AND feeder_id = $2 AND is_active = true AND end_at > NOW()`,
      [tenantId, feederId]
    );
    
    if (existingEvents.rows.length > 0) {
      console.log(`[DEMO MODE] WARNING: Feeder ${feederId} already has ${existingEvents.rows.length} active event(s). Deactivating before new event.`);
      await pool.query(
        `UPDATE ami_events SET is_active = false WHERE tenant_id = $1 AND feeder_id = $2 AND is_active = true`,
        [tenantId, feederId]
      );
    }
  }
  
  const result = await pool.query(
    `INSERT INTO ami_events (tenant_id, feeder_id, event_type, severity, start_at, end_at, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     RETURNING id, tenant_id, feeder_id, event_type, severity, start_at, end_at`,
    [tenantId, feederId, eventType, severity, startAt.toISOString(), endAt.toISOString()]
  );
  
  const event = result.rows[0];
  lastEventInjected = { ...event, injectedAt: new Date().toISOString() };
  
  if (demoMode) {
    console.log(`[DEMO MODE] Event injected: ${eventType} on ${feederId} (severity: ${severity}, duration: ${durationMinutes}min)`);
  }
  
  return event;
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
      `SELECT id, feeder_id, event_type, severity, start_at, end_at
       FROM ami_events 
       WHERE tenant_id = $1 AND end_at > NOW() AND is_active = true
       ORDER BY start_at DESC
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

export async function resetDemo({ tenantId, clearReads = false }) {
  let clearedEvents = 0;
  let clearedReads = 0;
  
  try {
    const eventsResult = await pool.query(
      `UPDATE ami_events SET is_active = false WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    );
    clearedEvents = eventsResult.rowCount || 0;
    
    if (clearReads) {
      const readsResult = await pool.query(
        `DELETE FROM meter_reads_electric WHERE tenant_id = $1`,
        [tenantId]
      );
      clearedReads = readsResult.rowCount || 0;
    }
    
    lastEventInjected = null;
    lastPublishAt = null;
    
    if (demoMode) {
      console.log(`[DEMO MODE] Demo reset complete for ${tenantId}: ${clearedEvents} events deactivated, ${clearedReads} reads cleared`);
    }
    
    return { clearedEvents, clearedReads, tenantId };
  } catch (err) {
    console.error("Demo reset error:", err.message);
    throw err;
  }
}

export async function validateKpiMovement(tenantId, beforeSnapshot = null) {
  const warnings = [];
  
  try {
    const [suspiciousResult, fieldopsResult, feederResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as cnt FROM v_kpi_suspicious_meters_daily WHERE tenant_id = $1`,
        [tenantId]
      ).catch(() => ({ rows: [{ cnt: 0 }] })),
      
      pool.query(
        `SELECT SUM(open_tasks) as total_tasks FROM v_kpi_fieldops_daily WHERE tenant_id = $1`,
        [tenantId]
      ).catch(() => ({ rows: [{ total_tasks: 0 }] })),
      
      pool.query(
        `SELECT feeder, loss_percent FROM v_kpi_electric_feeder_loss_daily WHERE tenant_id = $1 ORDER BY loss_percent DESC LIMIT 3`,
        [tenantId]
      ).catch(() => ({ rows: [] }))
    ]);
    
    const current = {
      suspiciousMetersCount: parseInt(suspiciousResult.rows[0]?.cnt) || 0,
      totalFieldopsTasks: parseInt(fieldopsResult.rows[0]?.total_tasks) || 0,
      topFeeders: feederResult.rows.map(r => ({ feeder: r.feeder, lossPercent: parseFloat(r.loss_percent) }))
    };
    
    if (beforeSnapshot) {
      let anyChange = false;
      
      if (current.suspiciousMetersCount !== beforeSnapshot.suspiciousMetersCount) {
        anyChange = true;
      }
      if (current.totalFieldopsTasks !== beforeSnapshot.totalFieldopsTasks) {
        anyChange = true;
      }
      
      const currentTopFeeder = current.topFeeders[0]?.feeder;
      const beforeTopFeeder = beforeSnapshot.topFeeders[0]?.feeder;
      if (currentTopFeeder !== beforeTopFeeder) {
        anyChange = true;
      }
      
      if (!anyChange) {
        const msg = `[KPI VALIDATION WARNING] No KPI movement detected after event. Possible causes: event not active, reads not published, or insufficient data.`;
        console.warn(msg);
        warnings.push(msg);
      }
    }
    
    return { snapshot: current, warnings };
  } catch (err) {
    const msg = `KPI validation error: ${err.message}`;
    console.error(msg);
    return { snapshot: null, warnings: [msg] };
  }
}

export function getDemoStatus() {
  return {
    demoMode,
    lastPublishAt,
    lastEventInjected
  };
}

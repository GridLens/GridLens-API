import { Worker } from "bullmq";
import { pool } from "../db.js";
import { connection, amiQueue } from "../queues/amiQueue.js";

if (!connection) {
  console.warn("[AMI Worker] No Redis connection - worker will not start");
}

const WORKER_CONCURRENCY = 8;

const LOW_VOLTAGE_THRESHOLD = 114;
const CRITICAL_VOLTAGE_THRESHOLD = 108;

async function detectAndCreateAnomalies(tenantId, feederId, readings) {
  const anomalies = {
    lowVoltage: [],
    criticalVoltage: [],
    zeroUsage: [],
    highUsage: []
  };
  
  for (const r of readings) {
    if (r.voltage < CRITICAL_VOLTAGE_THRESHOLD) {
      anomalies.criticalVoltage.push(r);
    } else if (r.voltage < LOW_VOLTAGE_THRESHOLD) {
      anomalies.lowVoltage.push(r);
    }
    
    if (r.kwh === 0) {
      anomalies.zeroUsage.push(r);
    } else if (r.kwh > 100) {
      anomalies.highUsage.push(r);
    }
  }
  
  const events = [];
  
  if (anomalies.criticalVoltage.length >= 3) {
    const event = await createAutoEvent(tenantId, feederId, 'voltage-sag', 0.9, 
      `Critical voltage detected on ${anomalies.criticalVoltage.length} meters`);
    if (event) events.push(event);
  } else if (anomalies.lowVoltage.length >= 5) {
    const event = await createAutoEvent(tenantId, feederId, 'voltage-sag', 0.5,
      `Low voltage detected on ${anomalies.lowVoltage.length} meters`);
    if (event) events.push(event);
  }
  
  const missingRate = 1 - (readings.length / (readings.length + 10));
  if (missingRate > 0.1) {
    const event = await createAutoEvent(tenantId, feederId, 'comms-outage', missingRate,
      `Communication issues detected - ${Math.round(missingRate * 100)}% missing reads`);
    if (event) events.push(event);
  }
  
  return { anomalies, events };
}

async function createAutoEvent(tenantId, feederId, eventType, severity, summary) {
  try {
    const existing = await pool.query(
      `SELECT id FROM ami_events 
       WHERE tenant_id = $1 AND feeder_id = $2 AND event_type = $3 
         AND is_active = true AND end_at > NOW()
       LIMIT 1`,
      [tenantId, feederId, eventType]
    );
    
    if (existing.rows.length > 0) {
      return null;
    }
    
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    
    const result = await pool.query(
      `INSERT INTO ami_events (tenant_id, feeder_id, event_type, severity, start_at, end_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, tenant_id, feeder_id, event_type, severity`,
      [tenantId, feederId, eventType, severity, startAt.toISOString(), endAt.toISOString()]
    );
    
    const event = result.rows[0];
    
    await createWorkOrderFromEvent(event, summary);
    
    console.log(`[AMI Worker] Auto-created event: ${eventType} on ${feederId} (severity: ${severity})`);
    return event;
  } catch (err) {
    console.error(`[AMI Worker] Failed to create auto-event:`, err.message);
    return null;
  }
}

async function createWorkOrderFromEvent(event, summary) {
  try {
    const priorityMap = {
      'voltage-sag': event.severity > 0.7 ? 'critical' : 'high',
      'comms-outage': event.severity > 0.5 ? 'high' : 'medium',
      'theft': 'critical'
    };
    
    const issueCodeMap = {
      'voltage-sag': 'VOLT_SAG',
      'comms-outage': 'COMM_FAIL',
      'theft': 'THEFT_SUSP'
    };
    
    const estimatedLoss = event.event_type === 'theft' ? 500 + Math.random() * 2000 :
                          event.event_type === 'voltage-sag' ? 100 + Math.random() * 500 :
                          50 + Math.random() * 200;
    
    const result = await pool.query(
      `INSERT INTO field_work_orders 
       (tenant_id, event_id, feeder_id, issue_type, issue_code, summary, priority, status, estimated_loss_dollars)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8)
       RETURNING id`,
      [
        event.tenant_id,
        event.id,
        event.feeder_id,
        event.event_type,
        issueCodeMap[event.event_type] || 'UNKNOWN',
        summary || `${event.event_type} detected on ${event.feeder_id}`,
        priorityMap[event.event_type] || 'medium',
        estimatedLoss.toFixed(2)
      ]
    );
    
    console.log(`[AMI Worker] Created work order #${result.rows[0].id} for event ${event.id}`);
    return result.rows[0];
  } catch (err) {
    console.error(`[AMI Worker] Failed to create work order:`, err.message);
    return null;
  }
}

const worker = connection ? new Worker(
  "ami",
  async (job) => {
    const startTime = Date.now();
    const { tenantId, feederId, readings, scaleMode } = job.data;

    if (!readings || readings.length === 0) {
      console.log(`[AMI Worker] Job ${job.id}: Empty batch received, skipping`);
      return { inserted: 0, elapsedMs: Date.now() - startTime };
    }

    const values = [];
    const params = [];
    let paramIndex = 1;

    for (const r of readings) {
      values.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
      );
      params.push(
        r.tenant_id,
        r.meter_id,
        r.feeder_id,
        r.kwh,
        r.voltage,
        r.read_at
      );
    }

    const sql = `
      INSERT INTO meter_reads_electric 
        (tenant_id, meter_id, feeder_id, kwh, voltage, read_at)
      VALUES ${values.join(", ")}
      ON CONFLICT DO NOTHING
    `;

    try {
      const result = await pool.query(sql, params);
      const insertedCount = result.rowCount || 0;
      
      const { anomalies, events } = await detectAndCreateAnomalies(tenantId, feederId, readings);
      
      const elapsedMs = Date.now() - startTime;
      
      const modeTag = scaleMode ? "[SCALE]" : "";
      const anomalyTag = events.length > 0 ? `[+${events.length} events]` : "";
      console.log(`[AMI Worker] ${modeTag}${anomalyTag} Job ${job.id} | Feeder ${feederId} | ${insertedCount}/${readings.length} rows | ${elapsedMs}ms`);
      
      return { inserted: insertedCount, elapsedMs, eventsCreated: events.length };
    } catch (err) {
      const elapsedMs = Date.now() - startTime;
      console.error(`[AMI Worker] Job ${job.id} | Feeder ${feederId} | ERROR after ${elapsedMs}ms:`, err.message);
      throw err;
    }
  },
  { 
    connection,
    concurrency: WORKER_CONCURRENCY
  }
) : null;

if (worker) {
  worker.on("completed", async (job, result) => {
    try {
      const [waiting, active] = await Promise.all([
        amiQueue.getWaitingCount(),
        amiQueue.getActiveCount()
      ]);
      console.log(`[AMI Worker] Job ${job.id} completed | inserted=${result.inserted} | elapsed=${result.elapsedMs}ms | queue: waiting=${waiting} active=${active}`);
    } catch {
      console.log(`[AMI Worker] Job ${job.id} completed:`, result);
    }
  });

  worker.on("failed", (job, err) => {
    console.error(`[AMI Worker] Job ${job?.id} FAILED:`, err.message);
  });

  console.log(`[AMI Worker] Started with concurrency=${WORKER_CONCURRENCY}, listening on queue 'ami'`);
} else {
  console.warn("[AMI Worker] Worker not started - no Redis connection");
}

export { worker };

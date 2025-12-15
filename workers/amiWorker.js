import { Worker } from "bullmq";
import { pool } from "../db.js";
import { connection } from "../queues/amiQueue.js";

if (!connection) {
  console.warn("[AMI Worker] No Redis connection - worker will not start");
}

const worker = connection ? new Worker(
  "ami",
  async (job) => {
    const { tenantId, feederId, readings } = job.data;

    if (!readings || readings.length === 0) {
      console.log("[AMI Worker] Empty batch received, skipping");
      return { inserted: 0, updated: 0 };
    }

    const values = [];
    const params = [];
    let paramIndex = 1;

    for (const r of readings) {
      values.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
      );
      params.push(
        r.tenant_id,
        r.meter_id,
        r.feeder_id,
        r.kwh,
        r.kw_demand,
        r.voltage,
        r.read_at,
        r.quality_flags || 'NORMAL',
        r.updated_at || new Date().toISOString()
      );
    }

    const sql = `
      INSERT INTO meter_reads_electric 
        (tenant_id, meter_id, feeder_id, kwh, kw_demand, voltage, read_at, quality_flags, updated_at)
      VALUES ${values.join(", ")}
      ON CONFLICT (tenant_id, meter_id, read_at) 
      DO UPDATE SET 
        kwh = EXCLUDED.kwh,
        voltage = EXCLUDED.voltage,
        quality_flags = EXCLUDED.quality_flags,
        updated_at = EXCLUDED.updated_at
    `;

    try {
      const result = await pool.query(sql, params);
      const affectedCount = result.rowCount || 0;
      console.log(`[AMI Worker] Feeder ${feederId}: processed ${affectedCount}/${readings.length} rows`);
      return { processed: affectedCount };
    } catch (err) {
      console.error(`[AMI Worker] Insert error for feeder ${feederId}:`, err.message);
      throw err;
    }
  },
  { connection }
) : null;

if (worker) {
  worker.on("completed", (job, result) => {
    console.log(`[AMI Worker] Job ${job.id} completed:`, result);
  });

  worker.on("failed", (job, err) => {
    console.error(`[AMI Worker] Job ${job?.id} failed:`, err.message);
  });

  console.log("[AMI Worker] Started and listening for jobs on queue 'ami'");
} else {
  console.warn("[AMI Worker] Worker not started - no Redis connection");
}

export { worker };

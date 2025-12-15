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
      console.log("Empty batch received, skipping");
      return { inserted: 0 };
    }

    const values = [];
    const params = [];
    let paramIndex = 1;

    for (const r of readings) {
      values.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
      );
      params.push(
        r.tenant_id,
        r.meter_id,
        r.feeder_id,
        r.kwh,
        r.kw_demand,
        r.voltage,
        r.read_at
      );
    }

    const sql = `
      INSERT INTO meter_reads_electric 
        (tenant_id, meter_id, feeder_id, kwh, kw_demand, voltage, read_at)
      VALUES ${values.join(", ")}
      ON CONFLICT (tenant_id, meter_id, read_at) DO NOTHING
    `;

    try {
      const result = await pool.query(sql, params);
      const insertedCount = result.rowCount || 0;
      console.log(`[AMI Worker] Feeder ${feederId}: inserted ${insertedCount}/${readings.length} rows`);
      return { inserted: insertedCount };
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

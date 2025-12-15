import { Worker } from "bullmq";
import { pool } from "../db.js";
import { connection, amiQueue } from "../queues/amiQueue.js";

if (!connection) {
  console.warn("[AMI Worker] No Redis connection - worker will not start");
}

const WORKER_CONCURRENCY = 8;

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
      const elapsedMs = Date.now() - startTime;
      
      const modeTag = scaleMode ? "[SCALE]" : "";
      console.log(`[AMI Worker] ${modeTag} Job ${job.id} | Feeder ${feederId} | ${insertedCount}/${readings.length} rows | ${elapsedMs}ms`);
      
      return { inserted: insertedCount, elapsedMs };
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

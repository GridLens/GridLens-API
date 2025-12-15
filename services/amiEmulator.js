import { pool } from "../db.js";
import { amiQueue } from "../queues/amiQueue.js";

function alignToInterval(date, intervalMinutes) {
  const ms = date.getTime();
  const intervalMs = intervalMinutes * 60 * 1000;
  return new Date(Math.floor(ms / intervalMs) * intervalMs);
}

function generateSyntheticReading(meterId, feederId, tenantId, readAt) {
  return {
    tenant_id: tenantId,
    meter_id: meterId,
    feeder_id: feederId,
    kwh: parseFloat((Math.random() * 50 + 10).toFixed(2)),
    kw_demand: parseFloat((Math.random() * 5 + 1).toFixed(2)),
    voltage: parseFloat((118 + Math.random() * 4).toFixed(1)),
    read_at: readAt.toISOString()
  };
}

export async function buildAndEnqueueReadBatches({ tenantId = "DEMO_TENANT", intervalMinutes = 15, batchSize = 100 }) {
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
    for (let i = 0; i < meterIds.length; i += batchSize) {
      const batchMeters = meterIds.slice(i, i + batchSize);
      
      const readings = batchMeters.map(meterId => 
        generateSyntheticReading(meterId, feederId, tenantId, readAt)
      );

      await amiQueue.add("ingest-batch", {
        tenantId,
        feederId,
        readings,
        intervalMinutes
      });

      totalQueued += readings.length;
      batchCount++;
    }
  }

  console.log(`Enqueued ${totalQueued} readings in ${batchCount} batches for tenant ${tenantId}`);
  return { queued: totalQueued, batches: batchCount };
}

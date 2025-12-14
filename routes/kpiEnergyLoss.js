import express from "express";
import pg from "pg";

const { Pool } = pg;
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function resolveTenantId(req) {
  if (req.query.tenantId && req.query.tenantId.trim() !== "") {
    return req.query.tenantId.trim();
  }
  
  try {
    const result = await pool.query(
      "SELECT tenant_id FROM meters WHERE tenant_id IS NOT NULL AND tenant_id <> '' LIMIT 1"
    );
    if (result.rows.length > 0) {
      return result.rows[0].tenant_id;
    }
  } catch (err) {
    console.error("Error resolving tenant_id:", err.message);
  }
  
  return "DEMO_TENANT";
}

router.get("/overview", async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    
    const result = await pool.query(
      `SELECT total_loss_kwh, loss_percent_pct, top_loss_feeders, last_updated
       FROM v_kpi_electric_overview_daily
       WHERE tenant_id = $1
       ORDER BY day DESC
       LIMIT 1`,
      [tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.json({
        totalLossKWh: 0,
        lossPercent: 0,
        topLossFeeders: [],
        lastUpdated: new Date().toISOString()
      });
    }
    
    const row = result.rows[0];
    res.json({
      totalLossKWh: Number(row.total_loss_kwh || 0),
      lossPercent: Number(row.loss_percent_pct || 0),
      topLossFeeders: row.top_loss_feeders || [],
      lastUpdated: row.last_updated || new Date().toISOString()
    });
  } catch (err) {
    console.error("KPI overview error:", err.message);
    res.status(500).json({ error: "KPI query failed", detail: err.message });
  }
});

router.get("/feeders", async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    
    const result = await pool.query(
      `SELECT
         COALESCE(f.feeder_name, f.feeder_code, fl.feeder_id::text) AS feeder,
         round((fl.loss_percent * 100)::numeric, 2) AS loss_percent
       FROM v_kpi_electric_feeder_loss_daily fl
       LEFT JOIN feeders f ON f.id = fl.feeder_id
       WHERE fl.tenant_id = $1
       ORDER BY fl.day DESC, fl.loss_percent DESC
       LIMIT 50`,
      [tenantId]
    );
    
    res.json(result.rows.map(r => ({
      feeder: r.feeder,
      lossPercent: Number(r.loss_percent || 0)
    })));
  } catch (err) {
    console.error("KPI feeders error:", err.message);
    res.status(500).json({ error: "KPI query failed", detail: err.message });
  }
});

router.get("/suspicious-meters", async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    
    const result = await pool.query(
      `SELECT meter_id, issue
       FROM v_kpi_suspicious_meters_daily
       WHERE tenant_id = $1
       ORDER BY day DESC
       LIMIT 50`,
      [tenantId]
    );
    
    res.json(result.rows.map(r => ({
      meterId: r.meter_id,
      issue: r.issue
    })));
  } catch (err) {
    console.error("KPI suspicious-meters error:", err.message);
    res.status(500).json({ error: "KPI query failed", detail: err.message });
  }
});

export default router;

/*
 * Smoke test commands:
 * curl http://localhost:5000/api/kpi/energy-loss/overview
 * curl http://localhost:5000/api/kpi/energy-loss/feeders
 * curl http://localhost:5000/api/kpi/energy-loss/suspicious-meters
 */

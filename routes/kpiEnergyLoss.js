import express from "express";
import pg from "pg";

const { Pool } = pg;
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function resolveTenantId(req) {
  const headerTenant = req.header('x-tenant-id');
  if (headerTenant && headerTenant.trim() !== "") {
    return headerTenant.trim();
  }
  
  if (req.query.tenantId && req.query.tenantId.trim() !== "") {
    return req.query.tenantId.trim();
  }
  
  return "DEMO_TENANT";
}

router.get("/overview", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    
    const result = await pool.query(
      `SELECT day, total_loss_kwh, loss_percent_pct, top_loss_feeders
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
      totalLossKWh: parseFloat(row.total_loss_kwh) || 0,
      lossPercent: parseFloat(row.loss_percent_pct) || 0,
      topLossFeeders: row.top_loss_feeders || [],
      lastUpdated: row.day ? new Date(row.day).toISOString() : new Date().toISOString()
    });
  } catch (err) {
    console.error("KPI overview error:", err.message);
    if (err.message.includes("does not exist")) {
      return res.status(500).json({ error: "KPI view missing", details: err.message });
    }
    res.status(500).json({ error: "KPI query failed", details: err.message });
  }
});

router.get("/feeders", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    
    const result = await pool.query(
      `SELECT feeder, loss_percent
       FROM v_kpi_electric_feeder_loss_daily
       WHERE tenant_id = $1
       ORDER BY loss_percent DESC
       LIMIT 10`,
      [tenantId]
    );
    
    res.json(result.rows.map(r => ({
      feeder: r.feeder,
      lossPercent: parseFloat(r.loss_percent) || 0
    })));
  } catch (err) {
    console.error("KPI feeders error:", err.message);
    if (err.message.includes("does not exist")) {
      return res.status(500).json({ error: "KPI view missing", details: err.message });
    }
    res.status(500).json({ error: "KPI query failed", details: err.message });
  }
});

router.get("/suspicious-meters", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    
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
    if (err.message.includes("does not exist")) {
      return res.status(500).json({ error: "KPI view missing", details: err.message });
    }
    res.status(500).json({ error: "KPI query failed", details: err.message });
  }
});

export default router;

/*
 * Smoke test commands:
 * curl http://localhost:5000/api/kpi/energy-loss/overview
 * curl http://localhost:5000/api/kpi/energy-loss/feeders
 * curl http://localhost:5000/api/kpi/energy-loss/suspicious-meters
 * 
 * With tenant header:
 * curl -H "x-tenant-id: MY_TENANT" http://localhost:5000/api/kpi/energy-loss/overview
 * 
 * With query param:
 * curl "http://localhost:5000/api/kpi/energy-loss/overview?tenantId=MY_TENANT"
 */

/**
 * GridLens Tenant Admin API Router
 * 
 * Endpoints for tenant configuration management.
 * Mount point: /api/admin/tenant
 */

import express from "express";
import pg from 'pg';
import { getTenantConfig, setTenantEnvironmentMode, clearTenantCache } from "../../services/tenant/tenantConfig.js";
import { logAuditEvent } from "../../services/audit/auditLogger.js";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 3
});

const router = express.Router();

/**
 * GET /api/admin/tenant/config
 * Get tenant configuration
 */
router.get("/config", async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({
        status: "error",
        error: "tenantId query parameter is required"
      });
    }
    
    const result = await getTenantConfig(tenantId);
    
    if (!result.ok) {
      return res.status(404).json({
        status: "error",
        error: result.error
      });
    }
    
    res.json({
      status: "ok",
      ts: new Date().toISOString(),
      tenant: result.tenant
    });
  } catch (err) {
    console.error("[TenantRouter] Get config error:", err.message);
    res.status(500).json({
      status: "error",
      error: "Failed to get tenant config"
    });
  }
});

/**
 * POST /api/admin/tenant/environment
 * Toggle tenant environment mode (LIVE/DEMO)
 */
router.post("/environment", async (req, res) => {
  try {
    const { tenantId, environment_mode } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        status: "error",
        error: "tenantId is required"
      });
    }
    
    if (!environment_mode || !['LIVE', 'DEMO'].includes(environment_mode)) {
      return res.status(400).json({
        status: "error",
        error: "environment_mode must be LIVE or DEMO"
      });
    }
    
    const result = await setTenantEnvironmentMode(tenantId, environment_mode);
    
    if (!result.ok) {
      return res.status(500).json({
        status: "error",
        error: result.error
      });
    }
    
    logAuditEvent({
      tenantId,
      actorType: req.body.actorId ? 'user' : 'api',
      actorId: req.body.actorId || null,
      actorLabel: req.body.actorLabel || null,
      source: 'api',
      module: 'Admin',
      action: 'TENANT_ENV_TOGGLE',
      objectType: 'tenant',
      objectId: tenantId,
      severity: 'INFO',
      status: 'SUCCESS',
      message: `Tenant ${tenantId} environment changed to ${environment_mode}`,
      diff: { before: null, after: { environment_mode } },
      metadata: { requestId: req.requestId, path: req.path }
    }).catch(err => console.warn('[TenantRouter] Audit log failed:', err.message));
    
    res.json({
      status: "ok",
      ts: new Date().toISOString(),
      tenantId: result.tenantId,
      environment_mode: result.environment_mode,
      message: `Tenant ${tenantId} is now in ${environment_mode} mode`
    });
  } catch (err) {
    console.error("[TenantRouter] Set environment error:", err.message);
    res.status(500).json({
      status: "error",
      error: "Failed to set environment mode"
    });
  }
});

/**
 * POST /api/admin/tenant/cache/clear
 * Clear tenant config cache
 */
router.post("/cache/clear", async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    clearTenantCache(tenantId);
    
    res.json({
      status: "ok",
      ts: new Date().toISOString(),
      message: tenantId ? `Cache cleared for ${tenantId}` : "All tenant cache cleared"
    });
  } catch (err) {
    console.error("[TenantRouter] Clear cache error:", err.message);
    res.status(500).json({
      status: "error",
      error: "Failed to clear cache"
    });
  }
});

/**
 * POST /api/admin/tenant/status
 * Update tenant status (ACTIVE/SUSPENDED)
 */
router.post("/status", async (req, res) => {
  try {
    const { tenantId, status, actorId, actorLabel } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        status: "error",
        error: "tenantId is required"
      });
    }
    
    if (!status || !['ACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({
        status: "error",
        error: "status must be ACTIVE or SUSPENDED"
      });
    }
    
    const beforeResult = await pool.query(
      'SELECT status FROM restoreiq.tenants WHERE tenant_id = $1',
      [tenantId]
    );
    const beforeStatus = beforeResult.rows[0]?.status;
    
    await pool.query(
      `UPDATE restoreiq.tenants SET status = $2, updated_at = NOW() WHERE tenant_id = $1`,
      [tenantId, status]
    );
    
    clearTenantCache(tenantId);
    
    logAuditEvent({
      tenantId,
      actorType: actorId ? 'user' : 'api',
      actorId: actorId || null,
      actorLabel: actorLabel || null,
      source: 'api',
      module: 'Admin',
      action: status === 'SUSPENDED' ? 'TENANT_SUSPEND' : 'TENANT_ACTIVATE',
      objectType: 'tenant',
      objectId: tenantId,
      severity: status === 'SUSPENDED' ? 'WARN' : 'INFO',
      status: 'SUCCESS',
      message: `Tenant ${tenantId} status changed from ${beforeStatus} to ${status}`,
      diff: { before: { status: beforeStatus }, after: { status } },
      metadata: { requestId: req.requestId, path: req.path }
    }).catch(err => console.warn('[TenantRouter] Audit log failed:', err.message));
    
    res.json({
      status: "ok",
      ts: new Date().toISOString(),
      tenantId,
      tenantStatus: status,
      message: `Tenant ${tenantId} is now ${status}`
    });
  } catch (err) {
    console.error("[TenantRouter] Set status error:", err.message);
    res.status(500).json({
      status: "error",
      error: "Failed to set tenant status"
    });
  }
});

/**
 * POST /api/admin/tenant/features
 * Update tenant feature flags
 */
router.post("/features", async (req, res) => {
  try {
    const { tenantId, features, actorId, actorLabel } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        status: "error",
        error: "tenantId is required"
      });
    }
    
    if (!features || typeof features !== 'object') {
      return res.status(400).json({
        status: "error",
        error: "features object is required"
      });
    }
    
    const beforeResult = await pool.query(
      'SELECT features FROM restoreiq.tenants WHERE tenant_id = $1',
      [tenantId]
    );
    const beforeFeatures = beforeResult.rows[0]?.features || {};
    
    const mergedFeatures = { ...beforeFeatures, ...features };
    
    await pool.query(
      `UPDATE restoreiq.tenants SET features = $2, updated_at = NOW() WHERE tenant_id = $1`,
      [tenantId, JSON.stringify(mergedFeatures)]
    );
    
    clearTenantCache(tenantId);
    
    logAuditEvent({
      tenantId,
      actorType: actorId ? 'user' : 'api',
      actorId: actorId || null,
      actorLabel: actorLabel || null,
      source: 'api',
      module: 'Admin',
      action: 'TENANT_FEATURES_UPDATE',
      objectType: 'tenant',
      objectId: tenantId,
      severity: 'INFO',
      status: 'SUCCESS',
      message: `Tenant ${tenantId} features updated`,
      diff: { before: beforeFeatures, after: mergedFeatures },
      metadata: { requestId: req.requestId, path: req.path }
    }).catch(err => console.warn('[TenantRouter] Audit log failed:', err.message));
    
    res.json({
      status: "ok",
      ts: new Date().toISOString(),
      tenantId,
      features: mergedFeatures,
      message: `Tenant ${tenantId} features updated`
    });
  } catch (err) {
    console.error("[TenantRouter] Set features error:", err.message);
    res.status(500).json({
      status: "error",
      error: "Failed to update tenant features"
    });
  }
});

export default router;

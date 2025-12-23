/**
 * GridLens Tenant Admin API Router
 * 
 * Endpoints for tenant configuration management.
 * Mount point: /api/admin/tenant
 */

import express from "express";
import { getTenantConfig, setTenantEnvironmentMode, clearTenantCache } from "../../services/tenant/tenantConfig.js";

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

export default router;

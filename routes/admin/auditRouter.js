/**
 * GridLens Audit Log API Router
 * 
 * REST endpoints for querying audit logs.
 * Mount point: /api/admin/audit
 */

import express from "express";
import { queryAuditLogs, getAuditLogById } from "../../services/audit/auditLogger.js";

const router = express.Router();

/**
 * GET /api/admin/audit/logs
 * Query audit logs with filters
 * 
 * Query params:
 *   tenantId (required)
 *   from - ISO date string
 *   to - ISO date string
 *   severity - INFO|WARN|CRITICAL
 *   module - MeterIQ|RestoreIQ|FieldOps|Admin
 *   action - specific action name
 *   objectType - type of object
 *   actorType - user|system|workflow|api
 *   search - text search in message/action/objectId
 *   limit - max results (default 100, max 1000)
 *   offset - pagination offset
 */
router.get("/logs", async (req, res) => {
  try {
    const {
      tenantId,
      from,
      to,
      severity,
      module,
      action,
      objectType,
      actorType,
      search,
      limit,
      offset
    } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({
        status: "error",
        error: "tenantId query parameter is required"
      });
    }
    
    const result = await queryAuditLogs({
      tenantId,
      from,
      to,
      severity,
      module,
      action,
      objectType,
      actorType,
      search,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0
    });
    
    if (!result.ok) {
      return res.status(500).json({
        status: "error",
        error: result.error
      });
    }
    
    res.json({
      status: "ok",
      ts: new Date().toISOString(),
      tenantId,
      logs: result.logs,
      total: result.total,
      limit: result.limit,
      offset: result.offset
    });
  } catch (err) {
    console.error("[AuditRouter] Query error:", err.message);
    res.status(500).json({
      status: "error",
      error: "Failed to query audit logs"
    });
  }
});

/**
 * GET /api/admin/audit/logs/:id
 * Get single audit log by ID
 */
router.get("/logs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({
        status: "error",
        error: "tenantId query parameter is required"
      });
    }
    
    const result = await getAuditLogById(tenantId, id);
    
    if (!result.ok) {
      return res.status(result.error === 'Audit log not found' ? 404 : 500).json({
        status: "error",
        error: result.error
      });
    }
    
    res.json({
      status: "ok",
      ts: new Date().toISOString(),
      log: result.log
    });
  } catch (err) {
    console.error("[AuditRouter] GetById error:", err.message);
    res.status(500).json({
      status: "error",
      error: "Failed to get audit log"
    });
  }
});

/**
 * GET /api/admin/audit/stats
 * Get audit log statistics for dashboard
 */
router.get("/stats", async (req, res) => {
  try {
    const { tenantId, from, to } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({
        status: "error",
        error: "tenantId query parameter is required"
      });
    }
    
    res.json({
      status: "ok",
      ts: new Date().toISOString(),
      tenantId,
      stats: {
        total: 0,
        bySeverity: { INFO: 0, WARN: 0, CRITICAL: 0 },
        byModule: { MeterIQ: 0, RestoreIQ: 0, FieldOps: 0, Admin: 0 },
        byStatus: { SUCCESS: 0, FAILURE: 0, PENDING: 0 }
      },
      message: "Stats endpoint ready - will populate with real data"
    });
  } catch (err) {
    console.error("[AuditRouter] Stats error:", err.message);
    res.status(500).json({
      status: "error",
      error: "Failed to get audit stats"
    });
  }
});

export default router;

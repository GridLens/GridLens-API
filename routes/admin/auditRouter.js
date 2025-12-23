/**
 * GridLens Audit Log API Router
 * 
 * REST endpoints for querying audit logs.
 * Mount point: /api/admin/audit
 */

import express from "express";
import { queryAuditLogs, getAuditLogById, logAuditEvent } from "../../services/audit/auditLogger.js";

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
 * POST /api/admin/audit/logs
 * Write a new audit log entry (for Retool UI events)
 * 
 * Body:
 *   tenantId (required)
 *   module - MeterIQ|RestoreIQ|FieldOps|Admin (required)
 *   action - action name (required)
 *   objectType - type of object (required)
 *   objectId - ID of the object
 *   severity - INFO|WARN|CRITICAL (default: INFO)
 *   status - SUCCESS|FAILURE|PENDING (default: SUCCESS)
 *   message - description of the action
 *   diff - {before, after} object for change tracking
 *   metadata - additional context (user info, etc.)
 *   actorType - user|system|workflow|api (default: user)
 *   actorId - user ID or identifier
 *   actorLabel - display name of actor
 *   source - retool|api|workflow (default: retool)
 */
router.post("/logs", async (req, res) => {
  try {
    const {
      tenantId,
      module,
      action,
      objectType,
      objectId,
      severity,
      status,
      message,
      diff,
      metadata,
      actorType,
      actorId,
      actorLabel,
      source
    } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        status: "error",
        error: "tenantId is required"
      });
    }
    
    if (!module || !action || !objectType) {
      return res.status(400).json({
        status: "error",
        error: "module, action, and objectType are required"
      });
    }
    
    const result = await logAuditEvent({
      tenantId,
      module,
      action,
      objectType,
      objectId,
      severity: severity || 'INFO',
      status: status || 'SUCCESS',
      message,
      diff,
      metadata,
      actorType: actorType || 'user',
      actorId,
      actorLabel,
      source: source || 'retool'
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
      id: result.id,
      occurredAt: result.occurredAt
    });
  } catch (err) {
    console.error("[AuditRouter] Write error:", err.message);
    res.status(500).json({
      status: "error",
      error: "Failed to write audit log"
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

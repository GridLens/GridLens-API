import express from 'express';
import { pool } from '../db.js';
import { logAuditEvent } from '../services/audit/auditLogger.js';

const router = express.Router();

router.get('/queue', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || 'DEMO_TENANT';
    
    const result = await pool.query(`
      SELECT 
        wo.id,
        wo.event_id,
        wo.meter_id,
        wo.feeder_id,
        wo.issue_type,
        wo.issue_code,
        wo.summary,
        wo.priority,
        wo.status,
        wo.assigned_to,
        wo.estimated_loss_dollars,
        wo.created_at,
        wo.updated_at,
        EXTRACT(DAY FROM NOW() - wo.created_at) as age_days
      FROM field_work_orders wo
      WHERE wo.tenant_id = $1
      ORDER BY 
        CASE wo.priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END,
        wo.created_at DESC
      LIMIT 100
    `, [tenantId]);
    
    const queue = result.rows.map(wo => ({
      id: wo.id,
      eventId: wo.event_id,
      meterId: wo.meter_id,
      feeder: wo.feeder_id,
      issueType: wo.issue_type,
      issueCode: wo.issue_code,
      summary: wo.summary,
      priority: wo.priority,
      status: wo.status,
      assignedTo: wo.assigned_to,
      createdAt: wo.created_at,
      updatedAt: wo.updated_at,
      ageDays: parseInt(wo.age_days) || 0,
      estLossDollars: parseFloat(wo.estimated_loss_dollars) || 0,
      linkContext: {
        page: "events",
        params: { feederId: wo.feeder_id }
      }
    }));
    
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'open') as open_count,
        COUNT(*) FILTER (WHERE status = 'assigned') as assigned_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
        COUNT(*) FILTER (WHERE priority = 'critical') as critical_count,
        COUNT(*) FILTER (WHERE priority = 'high') as high_count,
        SUM(estimated_loss_dollars) FILTER (WHERE status != 'closed') as total_open_loss
      FROM field_work_orders
      WHERE tenant_id = $1
    `, [tenantId]);
    
    const stats = statsResult.rows[0] || {};
    
    res.json({
      queue,
      stats: {
        openCount: parseInt(stats.open_count) || 0,
        assignedCount: parseInt(stats.assigned_count) || 0,
        inProgressCount: parseInt(stats.in_progress_count) || 0,
        closedCount: parseInt(stats.closed_count) || 0,
        criticalCount: parseInt(stats.critical_count) || 0,
        highCount: parseInt(stats.high_count) || 0,
        totalOpenLoss: parseFloat(stats.total_open_loss) || 0
      },
      source: 'live'
    });
  } catch (err) {
    console.error('FieldOps queue error:', err.message);
    res.status(500).json({ error: err.message, source: 'error' });
  }
});

router.get('/work-order/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        wo.*,
        EXTRACT(DAY FROM NOW() - wo.created_at) as age_days,
        e.event_type as related_event_type,
        e.severity as related_event_severity,
        e.start_at as event_start,
        e.end_at as event_end
      FROM field_work_orders wo
      LEFT JOIN ami_events e ON wo.event_id = e.id
      WHERE wo.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Work order not found" });
    }
    
    const wo = result.rows[0];
    res.json({
      id: wo.id,
      eventId: wo.event_id,
      meterId: wo.meter_id,
      feeder: wo.feeder_id,
      issueType: wo.issue_type,
      issueCode: wo.issue_code,
      summary: wo.summary,
      priority: wo.priority,
      status: wo.status,
      assignedTo: wo.assigned_to,
      estimatedLoss: parseFloat(wo.estimated_loss_dollars) || 0,
      createdAt: wo.created_at,
      updatedAt: wo.updated_at,
      ageDays: parseInt(wo.age_days) || 0,
      relatedEvent: wo.event_id ? {
        type: wo.related_event_type,
        severity: parseFloat(wo.related_event_severity),
        startAt: wo.event_start,
        endAt: wo.event_end
      } : null,
      source: 'live'
    });
  } catch (err) {
    console.error('Work order detail error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/work-order/:id', async (req, res) => {
  try {
    const { status, assignedTo, actorId, actorLabel } = req.body;
    const tenantId = req.body.tenantId || req.query.tenantId || 'DEMO_TENANT';
    const updates = [];
    const params = [req.params.id];
    let paramIdx = 2;
    
    const beforeResult = await pool.query(
      'SELECT status, assigned_to FROM field_work_orders WHERE id = $1',
      [req.params.id]
    );
    const before = beforeResult.rows[0] || {};
    
    if (status) {
      updates.push(`status = $${paramIdx++}`);
      params.push(status);
    }
    if (assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramIdx++}`);
      params.push(assignedTo);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }
    
    updates.push(`updated_at = NOW()`);
    
    const result = await pool.query(`
      UPDATE field_work_orders
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Work order not found" });
    }
    
    const after = result.rows[0];
    
    let action = 'WORKORDER_UPDATE';
    if (status === 'assigned' || assignedTo) action = 'WORKORDER_ASSIGN';
    else if (status === 'closed') action = 'WORKORDER_CLOSE';
    else if (status === 'in_progress') action = 'WORKORDER_START';
    
    logAuditEvent({
      tenantId,
      actorType: actorId ? 'user' : 'api',
      actorId: actorId || null,
      actorLabel: actorLabel || null,
      source: 'api',
      module: 'FieldOps',
      action,
      objectType: 'work_order',
      objectId: req.params.id,
      severity: 'INFO',
      status: 'SUCCESS',
      message: `Work order ${req.params.id} updated: ${Object.keys(req.body).filter(k => !['tenantId', 'actorId', 'actorLabel'].includes(k)).join(', ')}`,
      diff: { before: { status: before.status, assignedTo: before.assigned_to }, after: { status: after.status, assignedTo: after.assigned_to } },
      metadata: { requestId: req.requestId, path: req.path, method: req.method }
    }).catch(err => console.warn('[FieldOps] Audit log failed:', err.message));
    
    res.json({ ok: true, workOrder: result.rows[0] });
  } catch (err) {
    console.error('Work order update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

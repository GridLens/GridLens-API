/**
 * GridLens Audit Logger Service
 * 
 * Enterprise-grade audit logging with non-blocking writes.
 * Audit failures never break primary operations.
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

const VALID_SEVERITIES = ['INFO', 'WARN', 'CRITICAL'];
const VALID_STATUSES = ['SUCCESS', 'FAILURE', 'PENDING'];
const VALID_MODULES = ['MeterIQ', 'RestoreIQ', 'FieldOps', 'Admin', 'System'];
const VALID_ACTOR_TYPES = ['user', 'system', 'workflow', 'api', 'scheduler'];
const VALID_SOURCES = ['retool', 'api', 'workflow', 'scheduler', 'internal'];

function validateEvent(event) {
  const errors = [];
  
  if (!event.tenantId) errors.push('tenantId is required');
  if (!event.module) errors.push('module is required');
  if (!event.action) errors.push('action is required');
  if (!event.objectType) errors.push('objectType is required');
  
  if (event.severity && !VALID_SEVERITIES.includes(event.severity)) {
    errors.push(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }
  
  if (event.status && !VALID_STATUSES.includes(event.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  
  return errors;
}

function normalizeEvent(event) {
  return {
    tenantId: event.tenantId,
    actorType: VALID_ACTOR_TYPES.includes(event.actorType) ? event.actorType : 'system',
    actorId: event.actorId || null,
    actorLabel: event.actorLabel || null,
    source: VALID_SOURCES.includes(event.source) ? event.source : 'api',
    module: VALID_MODULES.includes(event.module) ? event.module : 'System',
    action: event.action,
    objectType: event.objectType,
    objectId: event.objectId || null,
    severity: VALID_SEVERITIES.includes(event.severity) ? event.severity : 'INFO',
    status: VALID_STATUSES.includes(event.status) ? event.status : 'SUCCESS',
    message: event.message || null,
    diff: event.diff || null,
    metadata: event.metadata || null
  };
}

export async function logAuditEvent(event) {
  try {
    const errors = validateEvent(event);
    if (errors.length > 0) {
      console.warn('[AuditLogger] Validation failed:', errors);
      return { ok: false, error: errors.join('; ') };
    }
    
    const normalized = normalizeEvent(event);
    
    const query = `
      INSERT INTO restoreiq.audit_logs (
        tenant_id, actor_type, actor_id, actor_label,
        source, module, action, object_type, object_id,
        severity, status, message, diff, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, occurred_at
    `;
    
    const values = [
      normalized.tenantId,
      normalized.actorType,
      normalized.actorId,
      normalized.actorLabel,
      normalized.source,
      normalized.module,
      normalized.action,
      normalized.objectType,
      normalized.objectId,
      normalized.severity,
      normalized.status,
      normalized.message,
      normalized.diff ? JSON.stringify(normalized.diff) : null,
      normalized.metadata ? JSON.stringify(normalized.metadata) : null
    ];
    
    const result = await pool.query(query, values);
    
    return {
      ok: true,
      id: result.rows[0].id,
      occurredAt: result.rows[0].occurred_at
    };
  } catch (err) {
    console.warn('[AuditLogger] Write failed (non-blocking):', err.message);
    return { ok: false, error: err.message };
  }
}

export function info(tenantId, module, action, objectType, options = {}) {
  return logAuditEvent({
    tenantId,
    module,
    action,
    objectType,
    severity: 'INFO',
    ...options
  });
}

export function warn(tenantId, module, action, objectType, options = {}) {
  return logAuditEvent({
    tenantId,
    module,
    action,
    objectType,
    severity: 'WARN',
    ...options
  });
}

export function critical(tenantId, module, action, objectType, options = {}) {
  return logAuditEvent({
    tenantId,
    module,
    action,
    objectType,
    severity: 'CRITICAL',
    ...options
  });
}

export async function queryAuditLogs(filters = {}) {
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
      limit = 100,
      offset = 0
    } = filters;
    
    if (!tenantId) {
      return { ok: false, error: 'tenantId is required' };
    }
    
    let query = `
      SELECT id, occurred_at, tenant_id, actor_type, actor_id, actor_label,
             source, module, action, object_type, object_id,
             severity, status, message, diff, metadata
      FROM restoreiq.audit_logs
      WHERE tenant_id = $1
    `;
    const values = [tenantId];
    let paramIndex = 2;
    
    if (from) {
      query += ` AND occurred_at >= $${paramIndex}`;
      values.push(from);
      paramIndex++;
    }
    
    if (to) {
      query += ` AND occurred_at <= $${paramIndex}`;
      values.push(to);
      paramIndex++;
    }
    
    if (severity) {
      query += ` AND severity = $${paramIndex}`;
      values.push(severity);
      paramIndex++;
    }
    
    if (module) {
      query += ` AND module = $${paramIndex}`;
      values.push(module);
      paramIndex++;
    }
    
    if (action) {
      query += ` AND action = $${paramIndex}`;
      values.push(action);
      paramIndex++;
    }
    
    if (objectType) {
      query += ` AND object_type = $${paramIndex}`;
      values.push(objectType);
      paramIndex++;
    }
    
    if (actorType) {
      query += ` AND actor_type = $${paramIndex}`;
      values.push(actorType);
      paramIndex++;
    }
    
    if (search) {
      query += ` AND (message ILIKE $${paramIndex} OR action ILIKE $${paramIndex} OR object_id ILIKE $${paramIndex})`;
      values.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY occurred_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(Math.min(limit, 1000), offset);
    
    const result = await pool.query(query, values);
    
    const countQuery = `
      SELECT COUNT(*) as total FROM restoreiq.audit_logs WHERE tenant_id = $1
    `;
    const countResult = await pool.query(countQuery, [tenantId]);
    
    return {
      ok: true,
      logs: result.rows.map(row => ({
        id: row.id,
        occurredAt: row.occurred_at,
        tenantId: row.tenant_id,
        actorType: row.actor_type,
        actorId: row.actor_id,
        actorLabel: row.actor_label,
        source: row.source,
        module: row.module,
        action: row.action,
        objectType: row.object_type,
        objectId: row.object_id,
        severity: row.severity,
        status: row.status,
        message: row.message,
        diff: row.diff,
        metadata: row.metadata
      })),
      total: parseInt(countResult.rows[0].total, 10),
      limit,
      offset
    };
  } catch (err) {
    console.error('[AuditLogger] Query failed:', err.message);
    return { ok: false, error: err.message };
  }
}

export async function getAuditLogById(tenantId, logId) {
  try {
    if (!tenantId || !logId) {
      return { ok: false, error: 'tenantId and logId are required' };
    }
    
    const query = `
      SELECT id, occurred_at, tenant_id, actor_type, actor_id, actor_label,
             source, module, action, object_type, object_id,
             severity, status, message, diff, metadata
      FROM restoreiq.audit_logs
      WHERE tenant_id = $1 AND id = $2
    `;
    
    const result = await pool.query(query, [tenantId, logId]);
    
    if (result.rows.length === 0) {
      return { ok: false, error: 'Audit log not found' };
    }
    
    const row = result.rows[0];
    return {
      ok: true,
      log: {
        id: row.id,
        occurredAt: row.occurred_at,
        tenantId: row.tenant_id,
        actorType: row.actor_type,
        actorId: row.actor_id,
        actorLabel: row.actor_label,
        source: row.source,
        module: row.module,
        action: row.action,
        objectType: row.object_type,
        objectId: row.object_id,
        severity: row.severity,
        status: row.status,
        message: row.message,
        diff: row.diff,
        metadata: row.metadata
      }
    };
  } catch (err) {
    console.error('[AuditLogger] GetById failed:', err.message);
    return { ok: false, error: err.message };
  }
}

export function createRequestMetadata(req) {
  return {
    requestId: req.requestId || null,
    ip: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.get('user-agent') || null,
    route: req.originalUrl || req.path || null,
    method: req.method || null
  };
}

export default {
  logAuditEvent,
  info,
  warn,
  critical,
  queryAuditLogs,
  getAuditLogById,
  createRequestMetadata
};

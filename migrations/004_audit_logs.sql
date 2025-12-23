-- GridLens Audit Logging Schema
-- Migration: 004_audit_logs.sql
-- Purpose: Enterprise-grade audit logging for compliance and operational tracking

-- Ensure restoreiq schema exists
CREATE SCHEMA IF NOT EXISTS restoreiq;

-- Audit logs table
CREATE TABLE IF NOT EXISTS restoreiq.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id TEXT NOT NULL,
    
    -- Actor information
    actor_type TEXT NOT NULL DEFAULT 'system',  -- user, system, workflow, api
    actor_id TEXT,
    actor_label TEXT,
    
    -- Source and context
    source TEXT NOT NULL DEFAULT 'api',  -- retool, api, workflow, scheduler
    module TEXT NOT NULL,  -- MeterIQ, RestoreIQ, FieldOps, Admin
    
    -- Action details
    action TEXT NOT NULL,  -- REPORT_EXPORT, WORKORDER_UPDATE, ROLE_UPDATE, etc.
    object_type TEXT NOT NULL,  -- replay, work_order, role, tenant, report, etc.
    object_id TEXT,
    
    -- Status and severity
    severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARN', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILURE', 'PENDING')),
    
    -- Details
    message TEXT,
    diff JSONB,  -- before/after state changes
    metadata JSONB,  -- request_id, ip, user_agent, route, method
    
    -- Indexing helpers
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_time 
    ON restoreiq.audit_logs (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_module_action 
    ON restoreiq.audit_logs (module, action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity 
    ON restoreiq.audit_logs (severity) 
    WHERE severity IN ('WARN', 'CRITICAL');

CREATE INDEX IF NOT EXISTS idx_audit_logs_object 
    ON restoreiq.audit_logs (object_type, object_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor 
    ON restoreiq.audit_logs (actor_type, actor_id);

-- Comment for documentation
COMMENT ON TABLE restoreiq.audit_logs IS 'Enterprise audit log for all GridLens modules';
COMMENT ON COLUMN restoreiq.audit_logs.diff IS 'JSON object with before/after state for change tracking';
COMMENT ON COLUMN restoreiq.audit_logs.metadata IS 'Request context: request_id, ip, user_agent, route, method';

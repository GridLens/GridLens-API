/**
 * GridLens Tenant Configuration Service
 * 
 * Manages tenant configuration with caching and environment mode (LIVE/DEMO).
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

const tenantCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

const DEFAULT_TENANT_CONFIG = {
  tenant_id: 'DEMO_TENANT',
  name: 'Demo Tenant',
  plan: 'enterprise',
  status: 'ACTIVE',
  environment_mode: 'DEMO',
  features: {
    meteriq_enabled: true,
    restoreiq_enabled: true,
    fieldops_enabled: true,
    admin_enabled: true,
    audit_logs_enabled: true
  },
  config: {}
};

export function getCachedTenant(tenantId) {
  const cached = tenantCache.get(tenantId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

export function setCachedTenant(tenantId, data) {
  tenantCache.set(tenantId, {
    data,
    cachedAt: Date.now()
  });
}

export function clearTenantCache(tenantId) {
  if (tenantId) {
    tenantCache.delete(tenantId);
  } else {
    tenantCache.clear();
  }
}

export async function getTenantConfig(tenantId) {
  if (!tenantId) {
    return { ok: false, error: 'tenantId is required' };
  }

  const cached = getCachedTenant(tenantId);
  if (cached) {
    return { ok: true, tenant: cached };
  }

  try {
    const result = await pool.query(
      `SELECT tenant_id, name, plan, status, environment_mode, features, config 
       FROM restoreiq.tenants WHERE tenant_id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      if (tenantId === 'DEMO_TENANT') {
        setCachedTenant(tenantId, DEFAULT_TENANT_CONFIG);
        return { ok: true, tenant: DEFAULT_TENANT_CONFIG };
      }
      return { ok: false, error: 'Tenant not found' };
    }

    const tenant = {
      tenant_id: result.rows[0].tenant_id,
      name: result.rows[0].name,
      plan: result.rows[0].plan || 'standard',
      status: result.rows[0].status || 'ACTIVE',
      environment_mode: result.rows[0].environment_mode || 'DEMO',
      features: result.rows[0].features || {},
      config: result.rows[0].config || {}
    };

    setCachedTenant(tenantId, tenant);
    return { ok: true, tenant };
  } catch (err) {
    console.warn('[TenantConfig] DB query failed, using defaults:', err.message);
    if (tenantId === 'DEMO_TENANT') {
      return { ok: true, tenant: DEFAULT_TENANT_CONFIG };
    }
    return { ok: true, tenant: { ...DEFAULT_TENANT_CONFIG, tenant_id: tenantId } };
  }
}

export async function setTenantEnvironmentMode(tenantId, environmentMode) {
  if (!tenantId) {
    return { ok: false, error: 'tenantId is required' };
  }

  if (!['LIVE', 'DEMO'].includes(environmentMode)) {
    return { ok: false, error: 'environment_mode must be LIVE or DEMO' };
  }

  try {
    await pool.query(
      `INSERT INTO restoreiq.tenants (tenant_id, name, plan, environment_mode, features, config)
       VALUES ($1, $2, 'standard', $3, '{}', '{}')
       ON CONFLICT (tenant_id) DO UPDATE SET environment_mode = $3`,
      [tenantId, tenantId, environmentMode]
    );

    clearTenantCache(tenantId);

    return { ok: true, tenantId, environment_mode: environmentMode };
  } catch (err) {
    console.error('[TenantConfig] Failed to set environment mode:', err.message);
    return { ok: false, error: err.message };
  }
}

export function isLiveMode(tenant) {
  return tenant?.environment_mode === 'LIVE';
}

export function isDemoMode(tenant) {
  return !tenant || tenant.environment_mode !== 'LIVE';
}

export default {
  getTenantConfig,
  setTenantEnvironmentMode,
  getCachedTenant,
  clearTenantCache,
  isLiveMode,
  isDemoMode
};

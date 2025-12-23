/**
 * GridLens Tenant Context Middleware
 * 
 * Attaches tenant configuration to requests for environment mode handling.
 */

import { getTenantConfig, isDemoMode } from '../services/tenant/tenantConfig.js';

export async function attachTenantContext(req, res, next) {
  const tenantId = req.body?.tenantId || req.query?.tenantId || 'DEMO_TENANT';
  
  try {
    const result = await getTenantConfig(tenantId);
    
    if (result.ok) {
      req.tenant = result.tenant;
      req.isDemoMode = isDemoMode(result.tenant);
    } else {
      req.tenant = {
        tenant_id: tenantId,
        name: tenantId,
        plan: 'standard',
        environment_mode: 'DEMO',
        features: {}
      };
      req.isDemoMode = true;
    }
  } catch (err) {
    console.warn('[TenantContext] Failed to load tenant:', err.message);
    req.tenant = {
      tenant_id: tenantId,
      name: tenantId,
      plan: 'standard',
      environment_mode: 'DEMO',
      features: {}
    };
    req.isDemoMode = true;
  }
  
  next();
}

export default attachTenantContext;

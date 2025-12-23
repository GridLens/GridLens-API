/**
 * GridLens Entitlement Enforcement Middleware
 * 
 * Blocks requests with 403 if feature is disabled or tenant is suspended.
 */

export function enforceEntitlement(featureKey) {
  return (req, res, next) => {
    const tenant = req.tenant;
    
    if (!tenant) {
      return res.status(403).json({
        status: "error",
        error: "ACCESS_DENIED",
        message: "Tenant context not available"
      });
    }

    if (tenant.status === 'SUSPENDED') {
      return res.status(403).json({
        status: "error",
        error: "TENANT_SUSPENDED",
        message: "Your account has been suspended. Please contact support."
      });
    }

    const features = tenant.features || {};
    
    if (featureKey && features[featureKey] === false) {
      return res.status(403).json({
        status: "error",
        error: "FEATURE_DISABLED",
        feature: featureKey,
        message: `This feature is not available on your current plan. Please upgrade to access ${featureKey.replace('_enabled', '').replace('_', ' ')}.`
      });
    }

    next();
  };
}

export function requireActiveStatus(req, res, next) {
  const tenant = req.tenant;
  
  if (!tenant) {
    return next();
  }

  if (tenant.status === 'SUSPENDED') {
    return res.status(403).json({
      status: "error",
      error: "TENANT_SUSPENDED",
      message: "Your account has been suspended. Please contact support."
    });
  }

  next();
}

export default enforceEntitlement;

/**
 * GridLens Energy - System Health API Router
 * 
 * Provides MeterIQ System Health endpoints for Retool dashboards.
 * Mount point: /api/ami/system/health
 * 
 * All endpoints return deterministic demo data for DEMO_TENANT.
 */

import express from "express";

const router = express.Router();

const DEMO_TENANT = "DEMO_TENANT";

function validateTenant(tenantId) {
  return tenantId === DEMO_TENANT;
}

function getTimestamp() {
  return new Date().toISOString();
}

const DEMO_FEEDER_EXCEPTIONS = [
  { feederId: "FD-102", riskBand: "High", exceptionScore: 78, affectedMeters: 312 },
  { feederId: "FD-214", riskBand: "Medium", exceptionScore: 52, affectedMeters: 188 },
  { feederId: "FD-087", riskBand: "Medium", exceptionScore: 48, affectedMeters: 145 },
  { feederId: "FD-331", riskBand: "Low", exceptionScore: 31, affectedMeters: 89 },
  { feederId: "FD-156", riskBand: "Low", exceptionScore: 24, affectedMeters: 67 }
];

const DEMO_METERS_REVIEW = [
  { meterId: "MTR-88412", issue: "No reads in 48h", severity: "High", feederId: "FD-102" },
  { meterId: "MTR-77109", issue: "Low voltage detected", severity: "Medium", feederId: "FD-214" },
  { meterId: "MTR-65234", issue: "Intermittent communication", severity: "Medium", feederId: "FD-087" },
  { meterId: "MTR-91847", issue: "High voltage spike", severity: "High", feederId: "FD-102" },
  { meterId: "MTR-43291", issue: "Tamper alert", severity: "High", feederId: "FD-331" },
  { meterId: "MTR-28756", issue: "No reads in 24h", severity: "Medium", feederId: "FD-156" },
  { meterId: "MTR-55123", issue: "Reverse flow detected", severity: "Low", feederId: "FD-214" },
  { meterId: "MTR-72890", issue: "Battery low", severity: "Low", feederId: "FD-087" }
];

const DEMO_TOP_NON_REPORTING = [
  { feederId: "FD-102", missingPct: 18.2 },
  { feederId: "FD-214", missingPct: 14.9 },
  { feederId: "FD-087", missingPct: 11.3 },
  { feederId: "FD-331", missingPct: 8.7 },
  { feederId: "FD-156", missingPct: 6.2 }
];

/**
 * GET /api/ami/system/health/summary
 * System Health Summary for Executive Overview
 */
router.get("/summary", (req, res) => {
  const tenantId = req.query.tenantId || DEMO_TENANT;
  
  if (!validateTenant(tenantId)) {
    return res.json({
      tenantId,
      systemHealthIndex: 0,
      status: "Unknown",
      dataConfidence: "None",
      affectedMeters: 0,
      estimatedDailyExposure: 0,
      exceptionVelocity: "Unknown",
      generatedAt: getTimestamp()
    });
  }
  
  res.json({
    tenantId: DEMO_TENANT,
    systemHealthIndex: 86,
    status: "Good",
    dataConfidence: "High",
    affectedMeters: 412,
    estimatedDailyExposure: 18750,
    exceptionVelocity: "Stable",
    generatedAt: getTimestamp()
  });
});

/**
 * GET /api/ami/system/health/reporting24h
 * 24-Hour Reporting Status
 */
router.get("/reporting24h", (req, res) => {
  const tenantId = req.query.tenantId || DEMO_TENANT;
  
  if (!validateTenant(tenantId)) {
    return res.json({
      expectedMeters: 0,
      reportingMeters: 0,
      readSuccessRatePct: 0,
      topNonReportingFeeders: [],
      generatedAt: getTimestamp()
    });
  }
  
  res.json({
    expectedMeters: 25000,
    reportingMeters: 24112,
    readSuccessRatePct: 96.4,
    topNonReportingFeeders: DEMO_TOP_NON_REPORTING,
    generatedAt: getTimestamp()
  });
});

/**
 * GET /api/ami/system/health/feeders/exceptions
 * Feeder Exception Risk
 */
router.get("/feeders/exceptions", (req, res) => {
  const tenantId = req.query.tenantId || DEMO_TENANT;
  
  if (!validateTenant(tenantId)) {
    return res.json([]);
  }
  
  res.json(DEMO_FEEDER_EXCEPTIONS);
});

/**
 * GET /api/ami/system/health/meters/review
 * Meters Requiring Review
 */
router.get("/meters/review", (req, res) => {
  const tenantId = req.query.tenantId || DEMO_TENANT;
  
  if (!validateTenant(tenantId)) {
    return res.json([]);
  }
  
  res.json(DEMO_METERS_REVIEW);
});

/**
 * GET /api/ami/system/health/powerquality
 * Power Quality Metrics
 */
router.get("/powerquality", (req, res) => {
  const tenantId = req.query.tenantId || DEMO_TENANT;
  
  if (!validateTenant(tenantId)) {
    return res.json({
      lowVoltageReadsPct: 0,
      highVoltageReadsPct: 0,
      affectedMeters: 0,
      generatedAt: getTimestamp()
    });
  }
  
  res.json({
    lowVoltageReadsPct: 2.6,
    highVoltageReadsPct: 0.4,
    affectedMeters: 621,
    generatedAt: getTimestamp()
  });
});

/**
 * GET /api/ami/system/health/comms
 * Communications Health
 */
router.get("/comms", (req, res) => {
  const tenantId = req.query.tenantId || DEMO_TENANT;
  
  if (!validateTenant(tenantId)) {
    return res.json({
      meshLatencyMs: 0,
      packetLossPct: 0,
      degradedNodes: 0,
      generatedAt: getTimestamp()
    });
  }
  
  res.json({
    meshLatencyMs: 184,
    packetLossPct: 1.2,
    degradedNodes: 17,
    generatedAt: getTimestamp()
  });
});

export default router;

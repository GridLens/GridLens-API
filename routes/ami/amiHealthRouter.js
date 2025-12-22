/**
 * GridLens Energy - AMI Health API Router
 * 
 * Provides AMI Health endpoints for Retool dashboards.
 * Mount point: /api/ami/health
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

/**
 * GET /api/ami/health/read-performance
 * AMI Read Performance Metrics
 */
router.get("/read-performance", (req, res) => {
  const tenantId = req.query.tenantId || DEMO_TENANT;
  
  if (!validateTenant(tenantId)) {
    return res.json({
      tenantId,
      totalMeters: 0,
      successfulReads: 0,
      failedReads: 0,
      readSuccessRate: 0,
      avgReadLatencyMs: 0,
      last24hTrend: [],
      generatedAt: getTimestamp()
    });
  }
  
  res.json({
    tenantId: DEMO_TENANT,
    totalMeters: 25000,
    successfulReads: 24112,
    failedReads: 888,
    readSuccessRate: 96.4,
    avgReadLatencyMs: 342,
    last24hTrend: [
      { hour: "00:00", rate: 96.2 },
      { hour: "04:00", rate: 96.8 },
      { hour: "08:00", rate: 95.9 },
      { hour: "12:00", rate: 96.1 },
      { hour: "16:00", rate: 96.5 },
      { hour: "20:00", rate: 96.4 }
    ],
    generatedAt: getTimestamp()
  });
});

/**
 * GET /api/ami/health/comms-status
 * AMI Communications Status
 */
router.get("/comms-status", (req, res) => {
  const tenantId = req.query.tenantId || DEMO_TENANT;
  
  if (!validateTenant(tenantId)) {
    return res.json({
      tenantId,
      meshLatencyMs: 0,
      packetLossPct: 0,
      degradedNodes: 0,
      totalCollectors: 0,
      onlineCollectors: 0,
      offlineCollectors: [],
      generatedAt: getTimestamp()
    });
  }
  
  res.json({
    tenantId: DEMO_TENANT,
    meshLatencyMs: 184,
    packetLossPct: 1.2,
    degradedNodes: 17,
    totalCollectors: 142,
    onlineCollectors: 139,
    offlineCollectors: [
      { collectorId: "COL-087", lastSeen: "2025-12-21T18:45:00Z", area: "Industrial Park" },
      { collectorId: "COL-156", lastSeen: "2025-12-21T20:12:00Z", area: "Riverside Heights" },
      { collectorId: "COL-203", lastSeen: "2025-12-21T19:30:00Z", area: "Downtown Core" }
    ],
    generatedAt: getTimestamp()
  });
});

/**
 * GET /api/ami/health/power-quality
 * Power Quality Metrics
 */
router.get("/power-quality", (req, res) => {
  const tenantId = req.query.tenantId || DEMO_TENANT;
  
  if (!validateTenant(tenantId)) {
    return res.json({
      tenantId,
      lowVoltageReadsPct: 0,
      highVoltageReadsPct: 0,
      affectedMeters: 0,
      voltageEvents: [],
      generatedAt: getTimestamp()
    });
  }
  
  res.json({
    tenantId: DEMO_TENANT,
    lowVoltageReadsPct: 2.6,
    highVoltageReadsPct: 0.4,
    affectedMeters: 621,
    voltageEvents: [
      { eventId: "VE-001", type: "LOW_VOLTAGE", feederId: "FD-102", metersAffected: 187, detectedAt: "2025-12-21T14:22:00Z" },
      { eventId: "VE-002", type: "LOW_VOLTAGE", feederId: "FD-214", metersAffected: 134, detectedAt: "2025-12-21T16:45:00Z" },
      { eventId: "VE-003", type: "HIGH_VOLTAGE", feederId: "FD-087", metersAffected: 52, detectedAt: "2025-12-21T09:18:00Z" },
      { eventId: "VE-004", type: "LOW_VOLTAGE", feederId: "FD-331", metersAffected: 248, detectedAt: "2025-12-21T11:33:00Z" }
    ],
    generatedAt: getTimestamp()
  });
});

/**
 * GET /api/ami/health/exceptions
 * AMI Exceptions Summary
 */
router.get("/exceptions", (req, res) => {
  const tenantId = req.query.tenantId || DEMO_TENANT;
  
  if (!validateTenant(tenantId)) {
    return res.json({
      tenantId,
      totalExceptions: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      exceptions: [],
      generatedAt: getTimestamp()
    });
  }
  
  res.json({
    tenantId: DEMO_TENANT,
    totalExceptions: 412,
    criticalCount: 47,
    warningCount: 189,
    infoCount: 176,
    exceptions: [
      { type: "NO_READS_48H", severity: "CRITICAL", count: 23, feeders: ["FD-102", "FD-214"] },
      { type: "NO_READS_24H", severity: "WARNING", count: 89, feeders: ["FD-087", "FD-156", "FD-331"] },
      { type: "LOW_VOLTAGE", severity: "WARNING", count: 67, feeders: ["FD-102", "FD-214"] },
      { type: "HIGH_VOLTAGE", severity: "WARNING", count: 33, feeders: ["FD-087"] },
      { type: "TAMPER_ALERT", severity: "CRITICAL", count: 24, feeders: ["FD-331", "FD-102"] },
      { type: "COMM_FAILURE", severity: "INFO", count: 176, feeders: ["FD-156", "FD-087", "FD-214"] }
    ],
    generatedAt: getTimestamp()
  });
});

/**
 * GET /api/ami/health/guidance
 * AI-Generated Guidance (Deterministic Advisory)
 */
router.get("/guidance", (req, res) => {
  const tenantId = req.query.tenantId || DEMO_TENANT;
  
  if (!validateTenant(tenantId)) {
    return res.json({
      tenantId,
      recommendations: [],
      generatedAt: getTimestamp(),
      advisory: "Advisory-only recommendations. Operator validation required."
    });
  }
  
  res.json({
    tenantId: DEMO_TENANT,
    recommendations: [
      {
        priority: 1,
        category: "CRITICAL",
        title: "Address 48-hour read gaps on FD-102",
        description: "23 meters on feeder FD-102 have not reported in 48+ hours. Recommend dispatching field crew for physical inspection.",
        affectedMeters: 23,
        estimatedRevenueLoss: 4250,
        suggestedAction: "Dispatch field crew to FD-102 service area"
      },
      {
        priority: 2,
        category: "HIGH",
        title: "Investigate tamper alerts on FD-331",
        description: "24 tamper alerts detected on feeder FD-331. Pattern suggests potential unauthorized access or meter bypass.",
        affectedMeters: 24,
        estimatedRevenueLoss: 8900,
        suggestedAction: "Schedule revenue protection investigation"
      },
      {
        priority: 3,
        category: "MEDIUM",
        title: "Monitor low voltage conditions on FD-214",
        description: "Persistent low voltage readings affecting 134 meters. May indicate transformer loading issues.",
        affectedMeters: 134,
        estimatedRevenueLoss: 1200,
        suggestedAction: "Review transformer load balance and consider upgrade"
      },
      {
        priority: 4,
        category: "LOW",
        title: "Replace aging collectors in Industrial Park",
        description: "3 collectors showing degraded performance with increased packet loss. Proactive replacement recommended.",
        affectedMeters: 0,
        estimatedRevenueLoss: 0,
        suggestedAction: "Schedule collector replacement during next maintenance window"
      }
    ],
    generatedAt: getTimestamp(),
    advisory: "Advisory-only recommendations. Operator validation required."
  });
});

export default router;

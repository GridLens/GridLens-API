/**
 * GridLens Demo Datasets
 * 
 * Deterministic demo data for DEMO mode responses.
 * All data is static and consistent across refreshes.
 */

export const SYSTEM_HEALTH = {
  summary: {
    tenantId: "DEMO_TENANT",
    systemHealthIndex: 86,
    status: "Good",
    dataConfidence: "High",
    affectedMeters: 412,
    estimatedDailyExposure: 18750,
    exceptionVelocity: "Stable"
  },
  
  reporting24h: {
    expectedMeters: 25000,
    reportingMeters: 24112,
    readSuccessRatePct: 96.4,
    topNonReportingFeeders: [
      { feederId: "FD-102", missingPct: 18.2 },
      { feederId: "FD-214", missingPct: 14.9 },
      { feederId: "FD-087", missingPct: 11.3 },
      { feederId: "FD-331", missingPct: 8.7 },
      { feederId: "FD-156", missingPct: 6.2 }
    ]
  },
  
  feedersExceptions: [
    { feederId: "FD-102", riskBand: "High", exceptionScore: 78, affectedMeters: 312 },
    { feederId: "FD-214", riskBand: "Medium", exceptionScore: 52, affectedMeters: 188 },
    { feederId: "FD-087", riskBand: "Medium", exceptionScore: 48, affectedMeters: 145 },
    { feederId: "FD-331", riskBand: "Low", exceptionScore: 31, affectedMeters: 89 },
    { feederId: "FD-156", riskBand: "Low", exceptionScore: 24, affectedMeters: 67 }
  ],
  
  metersReview: [
    { meterId: "MTR-88412", issue: "No reads in 48h", severity: "High", feederId: "FD-102" },
    { meterId: "MTR-77109", issue: "Low voltage detected", severity: "Medium", feederId: "FD-214" },
    { meterId: "MTR-65234", issue: "Intermittent communication", severity: "Medium", feederId: "FD-087" },
    { meterId: "MTR-91847", issue: "High voltage spike", severity: "High", feederId: "FD-102" },
    { meterId: "MTR-43291", issue: "Tamper alert", severity: "High", feederId: "FD-331" },
    { meterId: "MTR-28756", issue: "No reads in 24h", severity: "Medium", feederId: "FD-156" },
    { meterId: "MTR-55123", issue: "Reverse flow detected", severity: "Low", feederId: "FD-214" },
    { meterId: "MTR-72890", issue: "Battery low", severity: "Low", feederId: "FD-087" }
  ],
  
  powerQuality: {
    lowVoltageReadsPct: 2.6,
    highVoltageReadsPct: 0.4,
    affectedMeters: 621
  },
  
  comms: {
    meshLatencyMs: 184,
    packetLossPct: 1.2,
    degradedNodes: 17
  }
};

export const AMI_HEALTH = {
  readPerformance: {
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
    ]
  },
  
  commsStatus: {
    meshLatencyMs: 184,
    packetLossPct: 1.2,
    degradedNodes: 17,
    totalCollectors: 142,
    onlineCollectors: 139,
    offlineCollectors: [
      { collectorId: "COL-087", lastSeen: "2025-12-21T18:45:00Z", area: "Industrial Park" },
      { collectorId: "COL-156", lastSeen: "2025-12-21T20:12:00Z", area: "Riverside Heights" },
      { collectorId: "COL-203", lastSeen: "2025-12-21T19:30:00Z", area: "Downtown Core" }
    ]
  },
  
  powerQuality: {
    lowVoltageReadsPct: 2.6,
    highVoltageReadsPct: 0.4,
    affectedMeters: 621,
    voltageEvents: [
      { eventId: "VE-001", type: "LOW_VOLTAGE", feederId: "FD-102", metersAffected: 187, detectedAt: "2025-12-21T14:22:00Z" },
      { eventId: "VE-002", type: "LOW_VOLTAGE", feederId: "FD-214", metersAffected: 134, detectedAt: "2025-12-21T16:45:00Z" },
      { eventId: "VE-003", type: "HIGH_VOLTAGE", feederId: "FD-087", metersAffected: 52, detectedAt: "2025-12-21T09:18:00Z" },
      { eventId: "VE-004", type: "LOW_VOLTAGE", feederId: "FD-331", metersAffected: 248, detectedAt: "2025-12-21T11:33:00Z" }
    ]
  },
  
  exceptions: {
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
    ]
  },
  
  guidance: {
    recommendations: [
      {
        priority: 1,
        category: "CRITICAL",
        title: "Address 48-hour read gaps on FD-102",
        description: "23 meters on feeder FD-102 have not reported in 48+ hours.",
        affectedMeters: 23,
        estimatedRevenueLoss: 4250,
        suggestedAction: "Dispatch field crew to FD-102 service area"
      },
      {
        priority: 2,
        category: "HIGH",
        title: "Investigate tamper alerts on FD-331",
        description: "24 tamper alerts detected on feeder FD-331.",
        affectedMeters: 24,
        estimatedRevenueLoss: 8900,
        suggestedAction: "Schedule revenue protection investigation"
      },
      {
        priority: 3,
        category: "MEDIUM",
        title: "Monitor low voltage conditions on FD-214",
        description: "Persistent low voltage readings affecting 134 meters.",
        affectedMeters: 134,
        estimatedRevenueLoss: 1200,
        suggestedAction: "Review transformer load balance"
      }
    ]
  }
};

export const FIELDOPS = {
  queue: [
    {
      ticketId: "WO-78234",
      incidentId: "INC-2024-001",
      type: "OUTAGE_REPAIR",
      status: "IN_PROGRESS",
      priority: "P1",
      assignedTo: "Crew Alpha-7",
      createdAt: "2025-12-21T13:05:00Z",
      ageMin: 180,
      severity: "RED",
      area: "Downtown Core",
      customersAffected: 2847
    },
    {
      ticketId: "WO-78235",
      incidentId: "INC-2024-002",
      type: "OUTAGE_REPAIR",
      status: "DISPATCHED",
      priority: "P1",
      assignedTo: "Crew Beta-3",
      createdAt: "2025-12-21T14:00:00Z",
      ageMin: 125,
      severity: "RED",
      area: "Industrial Park East",
      customersAffected: 1523
    },
    {
      ticketId: "WO-78236",
      incidentId: "INC-2024-006",
      type: "EMERGENCY",
      status: "PENDING",
      priority: "P1",
      assignedTo: null,
      createdAt: "2025-12-21T15:30:00Z",
      ageMin: 35,
      severity: "RED",
      area: "Commerce District",
      customersAffected: 1200
    },
    {
      ticketId: "WO-78237",
      incidentId: "INC-2024-003",
      type: "BROWNOUT_CHECK",
      status: "VERIFICATION",
      priority: "P2",
      assignedTo: "Crew Delta-1",
      createdAt: "2025-12-21T11:30:00Z",
      ageMin: 270,
      severity: "YELLOW",
      area: "Riverside Heights",
      customersAffected: 892
    },
    {
      ticketId: "WO-78238",
      incidentId: "INC-2024-005",
      type: "METER_CHECK",
      status: "IN_PROGRESS",
      priority: "P3",
      assignedTo: "Crew Echo-2",
      createdAt: "2025-12-21T09:00:00Z",
      ageMin: 420,
      severity: "GREEN",
      area: "Oak Valley",
      customersAffected: 156
    }
  ],
  
  stats: {
    totalOpen: 5,
    byPriority: { P1: 3, P2: 1, P3: 1 },
    byStatus: { PENDING: 1, DISPATCHED: 1, IN_PROGRESS: 2, VERIFICATION: 1 },
    avgAgeMinutes: 206,
    crewsDeployed: 4,
    crewsAvailable: 2
  }
};

export const RESTOREIQ = {
  incidents: [
    {
      id: "INC-2024-001",
      severity: "RED",
      type: "OUTAGE",
      classification: "Equipment Failure - Transformer",
      feeder: "FDR-1147",
      area: "Downtown Core",
      locationHint: "Near intersection of Main St and 5th Ave, substation TX-42",
      customersAffected: 2847,
      metersAffected: 3102,
      status: "IN_PROGRESS",
      recommendedNext: "Dispatch secondary crew for parallel restoration via FDR-1148 tie switch"
    },
    {
      id: "INC-2024-002",
      severity: "RED",
      type: "OUTAGE",
      classification: "Line Fault - Tree Contact",
      feeder: "FDR-0892",
      area: "Industrial Park East",
      locationHint: "Section between poles P-892-17 and P-892-23",
      customersAffected: 1523,
      metersAffected: 1891,
      status: "DISPATCHED",
      recommendedNext: "Confirm crew arrival and begin sectionalizing"
    },
    {
      id: "INC-2024-003",
      severity: "YELLOW",
      type: "BROWNOUT",
      classification: "Low Voltage - Transformer Overload",
      feeder: "FDR-0456",
      area: "Riverside Heights",
      locationHint: "Distribution transformer DT-456-08",
      customersAffected: 892,
      metersAffected: 1045,
      status: "VERIFICATION",
      recommendedNext: "Monitor voltage levels after load transfer"
    }
  ],
  
  kpis: {
    activeIncidents: 6,
    customersAffected: 7262,
    metersAffected: 8815,
    restorationProgressPct: 12,
    estDailyExposure: 148145,
    severityBreakdown: { RED: 3, YELLOW: 2, GREEN: 1 }
  }
};

export function getTimestamp() {
  return new Date().toISOString();
}

export default {
  SYSTEM_HEALTH,
  AMI_HEALTH,
  FIELDOPS,
  RESTOREIQ,
  getTimestamp
};

/**
 * GridLens RestoreIQ - API Router
 * 
 * Mount point: /api/v1
 * 
 * Exposes endpoints for:
 * - Step 17: POST /api/v1/fault-zones/rank
 * - Step 20: POST /api/v1/replays/after-action/generate
 * - Step 21: POST /api/v1/reports/after-action/export
 * 
 * All endpoints are ADVISORY ONLY - no operational commands.
 */

import express from "express";
import crypto from "crypto";
import { rankFaultZones, getRankingByRunId } from "../../services/restoreiq/faultZoneRanking.js";
import { generateAfterActionReplay, getReplayById, getReplaysByOutage } from "../../services/restoreiq/outageReplayGenerator.js";
import { exportAfterActionReport, getReportBlobRef, getReportStream, getStorageProviderInfo } from "../../services/restoreiq/reportExporter.js";
import auditLogger from "../../services/audit/auditLogger.js";

const router = express.Router();

const ADVISORY_DISCLAIMER = "Advisory-only recommendations. Operator validation required.";

const downloadTokens = new Map();
const TOKEN_EXPIRY_MS = 15 * 60 * 1000;

function validateUUID(value, fieldName) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!value || !uuidRegex.test(value)) {
    throw new Error(`Invalid ${fieldName}: must be a valid UUID`);
  }
  return value;
}

function resolveTenantId(req) {
  return req.body?.tenantId || req.query?.tenantId || 'DEMO_TENANT';
}

function generateDownloadToken(replayId, tenantId) {
  const token = crypto.randomBytes(32).toString('hex');
  downloadTokens.set(token, {
    replayId,
    tenantId,
    createdAt: Date.now()
  });
  
  setTimeout(() => downloadTokens.delete(token), TOKEN_EXPIRY_MS);
  
  return token;
}

/**
 * Step 17: POST /api/v1/fault-zones/rank
 * Rank fault zones for a given outage
 */
router.post('/fault-zones/rank', async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { outageId, createdBy } = req.body;
    
    if (!outageId) {
      return res.status(400).json({
        status: 'error',
        error: 'outageId is required',
        advisory: ADVISORY_DISCLAIMER
      });
    }
    
    try {
      validateUUID(outageId, 'outageId');
    } catch (e) {
      return res.status(400).json({
        status: 'error',
        error: e.message,
        advisory: ADVISORY_DISCLAIMER
      });
    }
    
    const result = await rankFaultZones({
      tenantId,
      outageId,
      createdBy: createdBy || 'api'
    });
    
    auditLogger.info(tenantId, 'RestoreIQ', 'FAULT_ZONE_RANK', 'fault_zone', {
      objectId: result.run_id,
      message: `Ranked ${result.zones?.length || 0} fault zones for outage ${outageId}`,
      metadata: auditLogger.createRequestMetadata(req)
    });
    
    res.json(result);
    
  } catch (err) {
    console.error('[RestoreIQ] Fault zone ranking error:', err.message);
    res.status(500).json({
      status: 'error',
      error: err.message,
      advisory: ADVISORY_DISCLAIMER
    });
  }
});

/**
 * GET /api/v1/fault-zones/rankings/:runId
 * Get ranking results by run ID
 */
router.get('/fault-zones/rankings/:runId', async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { runId } = req.params;
    
    try {
      validateUUID(runId, 'runId');
    } catch (e) {
      return res.status(400).json({
        status: 'error',
        error: e.message
      });
    }
    
    const rankings = await getRankingByRunId(tenantId, runId);
    
    res.json({
      status: 'ok',
      run_id: runId,
      rankings,
      count: rankings.length,
      advisory: ADVISORY_DISCLAIMER
    });
    
  } catch (err) {
    console.error('[RestoreIQ] Get rankings error:', err.message);
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

/**
 * Step 20: POST /api/v1/replays/after-action/generate
 * Generate an after-action replay for an outage
 */
router.post('/replays/after-action/generate', async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { outageId, generatedBy } = req.body;
    
    if (!outageId) {
      return res.status(400).json({
        status: 'error',
        error: 'outageId is required',
        advisory: ADVISORY_DISCLAIMER
      });
    }
    
    try {
      validateUUID(outageId, 'outageId');
    } catch (e) {
      return res.status(400).json({
        status: 'error',
        error: e.message,
        advisory: ADVISORY_DISCLAIMER
      });
    }
    
    const result = await generateAfterActionReplay({
      tenantId,
      outageId,
      generatedBy: generatedBy || 'api'
    });
    
    auditLogger.info(tenantId, 'RestoreIQ', 'REPLAY_GENERATE', 'replay', {
      objectId: result.replay_id,
      message: `Generated after-action replay for outage ${outageId}`,
      metadata: auditLogger.createRequestMetadata(req)
    });
    
    res.json(result);
    
  } catch (err) {
    console.error('[RestoreIQ] Replay generation error:', err.message);
    res.status(500).json({
      status: 'error',
      error: err.message,
      advisory: ADVISORY_DISCLAIMER
    });
  }
});

/**
 * GET /api/v1/replays/:replayId
 * Get a replay by ID
 */
router.get('/replays/:replayId', async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { replayId } = req.params;
    
    try {
      validateUUID(replayId, 'replayId');
    } catch (e) {
      return res.status(400).json({
        status: 'error',
        error: e.message
      });
    }
    
    const replay = await getReplayById(tenantId, replayId);
    
    if (!replay) {
      return res.status(404).json({
        status: 'error',
        error: 'Replay not found'
      });
    }
    
    res.json({
      status: 'ok',
      replay,
      advisory: ADVISORY_DISCLAIMER
    });
    
  } catch (err) {
    console.error('[RestoreIQ] Get replay error:', err.message);
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

/**
 * GET /api/v1/replays/outage/:outageId
 * Get all replays for an outage
 */
router.get('/replays/outage/:outageId', async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { outageId } = req.params;
    
    try {
      validateUUID(outageId, 'outageId');
    } catch (e) {
      return res.status(400).json({
        status: 'error',
        error: e.message
      });
    }
    
    const replays = await getReplaysByOutage(tenantId, outageId);
    
    res.json({
      status: 'ok',
      outage_id: outageId,
      replays,
      count: replays.length,
      advisory: ADVISORY_DISCLAIMER
    });
    
  } catch (err) {
    console.error('[RestoreIQ] Get replays error:', err.message);
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

/**
 * Step 21: POST /api/v1/reports/after-action/export
 * Export an after-action report to PDF
 */
router.post('/reports/after-action/export', async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { replayId, outageId } = req.body;
    
    if (!replayId) {
      return res.status(400).json({
        status: 'error',
        error: 'replayId is required',
        advisory: ADVISORY_DISCLAIMER
      });
    }
    
    try {
      validateUUID(replayId, 'replayId');
    } catch (e) {
      return res.status(400).json({
        status: 'error',
        error: e.message,
        advisory: ADVISORY_DISCLAIMER
      });
    }
    
    const result = await exportAfterActionReport({
      tenantId,
      replayId,
      outageId
    });
    
    auditLogger.info(tenantId, 'RestoreIQ', 'REPORT_EXPORT', 'report', {
      objectId: replayId,
      message: `Exported after-action report for replay ${replayId}`,
      metadata: auditLogger.createRequestMetadata(req)
    });
    
    const downloadToken = generateDownloadToken(replayId, tenantId);
    
    res.json({
      ...result,
      download_url: `/api/v1/reports/download?token=${downloadToken}`,
      token_expires_in_seconds: TOKEN_EXPIRY_MS / 1000
    });
    
  } catch (err) {
    console.error('[RestoreIQ] Report export error:', err.message);
    res.status(500).json({
      status: 'error',
      error: err.message,
      advisory: ADVISORY_DISCLAIMER
    });
  }
});

/**
 * GET /api/v1/reports/download?token=xxx
 * Download PDF using secure tokenized link (streams from local or Azure)
 */
router.get('/reports/download', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({
        status: 'error',
        error: 'Download token is required'
      });
    }
    
    const tokenData = downloadTokens.get(token);
    
    if (!tokenData) {
      return res.status(401).json({
        status: 'error',
        error: 'Invalid or expired download token. Request a new export.'
      });
    }
    
    if (Date.now() - tokenData.createdAt > TOKEN_EXPIRY_MS) {
      downloadTokens.delete(token);
      return res.status(401).json({
        status: 'error',
        error: 'Download token has expired. Request a new export.'
      });
    }
    
    const reportData = await getReportStream(tokenData.tenantId, tokenData.replayId);
    
    if (!reportData || !reportData.stream) {
      return res.status(404).json({
        status: 'error',
        error: 'Report file not found. Generate a new export.'
      });
    }
    
    console.log(`[RestoreIQ] Streaming PDF from ${reportData.provider}: ${reportData.fileName}`);
    
    res.setHeader('Content-Type', reportData.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${reportData.fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Storage-Provider', reportData.provider);
    
    reportData.stream.pipe(res);
    
    reportData.stream.on('error', (err) => {
      console.error('[RestoreIQ] Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ status: 'error', error: 'Failed to stream file' });
      }
    });
    
  } catch (err) {
    console.error('[RestoreIQ] Download error:', err.message);
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

/**
 * GET /api/v1/reports/:replayId/info
 * Get report metadata (no raw paths exposed)
 */
router.get('/reports/:replayId/info', async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { replayId } = req.params;
    
    try {
      validateUUID(replayId, 'replayId');
    } catch (e) {
      return res.status(400).json({
        status: 'error',
        error: e.message
      });
    }
    
    const blobRef = await getReportBlobRef(tenantId, replayId);
    
    if (!blobRef) {
      return res.status(404).json({
        status: 'error',
        error: 'Report not found. Generate report first using POST /api/v1/reports/after-action/export'
      });
    }
    
    const downloadToken = generateDownloadToken(replayId, tenantId);
    
    res.json({
      status: 'ok',
      replay_id: replayId,
      format: blobRef.format || 'pdf',
      generated_at: blobRef.pdf_generated_at,
      download_url: `/api/v1/reports/download?token=${downloadToken}`,
      token_expires_in_seconds: TOKEN_EXPIRY_MS / 1000,
      advisory: ADVISORY_DISCLAIMER
    });
    
  } catch (err) {
    console.error('[RestoreIQ] Get report info error:', err.message);
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

// =============================================================================
// RESTOREIQ DASHBOARD ENDPOINTS (Mock Data for UI Demo)
// =============================================================================

const DEMO_START_TIME = new Date(Date.now() - 3 * 60 * 60 * 1000);

const incidentActionsLog = new Map();

const MOCK_INCIDENTS = [
  {
    id: 'INC-2024-001',
    severity: 'RED',
    type: 'OUTAGE',
    classification: 'Equipment Failure - Transformer',
    feeder: 'FDR-1147',
    area: 'Downtown Core',
    locationHint: 'Near intersection of Main St and 5th Ave, substation TX-42',
    startTime: new Date(Date.now() - 147 * 60 * 1000).toISOString(),
    customersAffected: 2847,
    metersAffected: 3102,
    status: 'IN_PROGRESS',
    recommendedNext: 'Dispatch secondary crew for parallel restoration via FDR-1148 tie switch'
  },
  {
    id: 'INC-2024-002',
    severity: 'RED',
    type: 'OUTAGE',
    classification: 'Storm Damage - Downed Lines',
    feeder: 'FDR-0892',
    area: 'Industrial Park East',
    locationHint: 'Between poles 127-134 on Industrial Blvd',
    startTime: new Date(Date.now() - 89 * 60 * 1000).toISOString(),
    customersAffected: 1523,
    metersAffected: 1891,
    status: 'DISPATCHED',
    recommendedNext: 'Confirm crew arrival and assess line damage extent'
  },
  {
    id: 'INC-2024-003',
    severity: 'YELLOW',
    type: 'BROWNOUT',
    classification: 'Voltage Sag - Load Imbalance',
    feeder: 'FDR-0456',
    area: 'Riverside Heights',
    locationHint: 'Capacitor bank CB-12 showing fault indicators',
    startTime: new Date(Date.now() - 234 * 60 * 1000).toISOString(),
    customersAffected: 892,
    metersAffected: 1045,
    status: 'VERIFICATION',
    recommendedNext: 'Monitor voltage levels post capacitor switch; confirm stabilization'
  },
  {
    id: 'INC-2024-004',
    severity: 'YELLOW',
    type: 'COMMS',
    classification: 'AMI Communication Loss',
    feeder: 'FDR-0721',
    area: 'Westfield Commons',
    locationHint: 'Collector node CN-88 non-responsive',
    startTime: new Date(Date.now() - 312 * 60 * 1000).toISOString(),
    customersAffected: 0,
    metersAffected: 487,
    status: 'NEW',
    recommendedNext: 'Dispatch technician to inspect collector node CN-88 antenna'
  },
  {
    id: 'INC-2024-005',
    severity: 'GREEN',
    type: 'OUTAGE',
    classification: 'Planned Maintenance',
    feeder: 'FDR-0333',
    area: 'Oak Valley',
    locationHint: 'Scheduled recloser replacement at pole 45',
    startTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    customersAffected: 124,
    metersAffected: 156,
    status: 'IN_PROGRESS',
    recommendedNext: 'Proceed with planned restoration at 14:30'
  },
  {
    id: 'INC-2024-006',
    severity: 'RED',
    type: 'OUTAGE',
    classification: 'Vehicle Strike - Pole Damage',
    feeder: 'FDR-1205',
    area: 'Commerce District',
    locationHint: 'Pole 78 at Commerce Dr and Highway 101 off-ramp',
    startTime: new Date(Date.now() - 23 * 60 * 1000).toISOString(),
    customersAffected: 1876,
    metersAffected: 2134,
    status: 'NEW',
    recommendedNext: 'Coordinate with emergency services; assess pole replacement need'
  }
];

const MOCK_QUEUE = [
  { ticketId: 'WO-78234', incidentId: 'INC-2024-001', status: 'IN_PROGRESS', assignedTo: 'Crew Alpha-7', priority: 'P1' },
  { ticketId: 'WO-78235', incidentId: 'INC-2024-002', status: 'DISPATCHED', assignedTo: 'Crew Beta-3', priority: 'P1' },
  { ticketId: 'WO-78236', incidentId: 'INC-2024-006', status: 'PENDING', assignedTo: null, priority: 'P1' },
  { ticketId: 'WO-78237', incidentId: 'INC-2024-003', status: 'VERIFICATION', assignedTo: 'Crew Delta-1', priority: 'P2' },
  { ticketId: 'WO-78238', incidentId: 'INC-2024-004', status: 'PENDING', assignedTo: null, priority: 'P3' },
  { ticketId: 'WO-78239', incidentId: 'INC-2024-005', status: 'IN_PROGRESS', assignedTo: 'Crew Gamma-2', priority: 'P3' }
];

function getIncidentAge(startTime) {
  return Math.round((Date.now() - new Date(startTime).getTime()) / 60000);
}

/**
 * GET /api/v1/restoreiq/kpis
 * Dashboard KPIs for RestoreIQ
 */
router.get('/restoreiq/kpis', (req, res) => {
  const activeIncidents = MOCK_INCIDENTS.filter(i => i.status !== 'CLOSED').length;
  const customersAffected = MOCK_INCIDENTS
    .filter(i => i.status !== 'CLOSED')
    .reduce((sum, i) => sum + i.customersAffected, 0);
  const metersAffected = MOCK_INCIDENTS
    .filter(i => i.status !== 'CLOSED')
    .reduce((sum, i) => sum + i.metersAffected, 0);
  
  const closedCount = MOCK_INCIDENTS.filter(i => i.status === 'CLOSED').length;
  const restorationProgressPct = Math.round((closedCount / MOCK_INCIDENTS.length) * 100) || 12;
  
  const estDailyExposure = Math.round(customersAffected * 0.85 * 24);
  
  const severityBreakdown = {
    RED: MOCK_INCIDENTS.filter(i => i.severity === 'RED' && i.status !== 'CLOSED').length,
    YELLOW: MOCK_INCIDENTS.filter(i => i.severity === 'YELLOW' && i.status !== 'CLOSED').length,
    GREEN: MOCK_INCIDENTS.filter(i => i.severity === 'GREEN' && i.status !== 'CLOSED').length
  };
  
  res.json({
    status: 'ok',
    ts: new Date().toISOString(),
    activeIncidents,
    customersAffected,
    metersAffected,
    restorationProgressPct,
    estDailyExposure,
    severityBreakdown,
    advisory: ADVISORY_DISCLAIMER
  });
});

/**
 * GET /api/v1/restoreiq/incidents
 * List all incidents
 */
router.get('/restoreiq/incidents', (req, res) => {
  const incidents = MOCK_INCIDENTS.map(inc => ({
    id: inc.id,
    severity: inc.severity,
    type: inc.type,
    feeder: inc.feeder,
    area: inc.area,
    startTime: inc.startTime,
    ageMin: getIncidentAge(inc.startTime),
    customersAffected: inc.customersAffected,
    metersAffected: inc.metersAffected,
    status: inc.status
  }));
  
  res.json({
    status: 'ok',
    ts: new Date().toISOString(),
    count: incidents.length,
    incidents,
    advisory: ADVISORY_DISCLAIMER
  });
});

/**
 * GET /api/v1/restoreiq/incidents/:id
 * Get incident detail
 */
router.get('/restoreiq/incidents/:id', (req, res) => {
  const { id } = req.params;
  const incident = MOCK_INCIDENTS.find(i => i.id === id);
  
  if (!incident) {
    return res.status(404).json({
      status: 'error',
      ts: new Date().toISOString(),
      error: `Incident ${id} not found`
    });
  }
  
  const baseActions = [
    { at: new Date(new Date(incident.startTime).getTime() + 2 * 60000).toISOString(), by: 'SCADA', note: 'Outage detected via telemetry' },
    { at: new Date(new Date(incident.startTime).getTime() + 5 * 60000).toISOString(), by: 'RestoreIQ', note: 'Incident created and classified' }
  ];
  
  if (incident.status !== 'NEW') {
    baseActions.push({
      at: new Date(new Date(incident.startTime).getTime() + 12 * 60000).toISOString(),
      by: 'Dispatcher',
      note: 'Crew dispatched to location'
    });
  }
  
  if (incident.status === 'IN_PROGRESS' || incident.status === 'VERIFICATION') {
    baseActions.push({
      at: new Date(new Date(incident.startTime).getTime() + 35 * 60000).toISOString(),
      by: 'Field Crew',
      note: 'On site, assessing damage'
    });
  }
  
  const customActions = incidentActionsLog.get(id) || [];
  const allActions = [...baseActions, ...customActions].sort((a, b) => 
    new Date(a.at).getTime() - new Date(b.at).getTime()
  );
  
  res.json({
    status: 'ok',
    ts: new Date().toISOString(),
    incident: {
      id: incident.id,
      severity: incident.severity,
      type: incident.type,
      classification: incident.classification,
      feeder: incident.feeder,
      area: incident.area,
      locationHint: incident.locationHint,
      startTime: incident.startTime,
      ageMin: getIncidentAge(incident.startTime),
      customersAffected: incident.customersAffected,
      metersAffected: incident.metersAffected,
      status: incident.status,
      actions: allActions,
      recommendedNext: incident.recommendedNext
    },
    advisory: ADVISORY_DISCLAIMER
  });
});

/**
 * GET /api/v1/restoreiq/queue
 * Get work ticket queue
 */
router.get('/restoreiq/queue', (req, res) => {
  const queue = MOCK_QUEUE.map(ticket => {
    const incident = MOCK_INCIDENTS.find(i => i.id === ticket.incidentId);
    return {
      ticketId: ticket.ticketId,
      incidentId: ticket.incidentId,
      status: ticket.status,
      assignedTo: ticket.assignedTo,
      priority: ticket.priority,
      ageMin: incident ? getIncidentAge(incident.startTime) : 0,
      severity: incident?.severity || 'UNKNOWN',
      area: incident?.area || 'Unknown'
    };
  });
  
  res.json({
    status: 'ok',
    ts: new Date().toISOString(),
    count: queue.length,
    queue,
    advisory: ADVISORY_DISCLAIMER
  });
});

/**
 * POST /api/v1/restoreiq/incidents/:id/actions
 * Add action to incident log (demo mode, in-memory)
 */
router.post('/restoreiq/incidents/:id/actions', (req, res) => {
  const { id } = req.params;
  const { by, note } = req.body;
  
  const incident = MOCK_INCIDENTS.find(i => i.id === id);
  
  if (!incident) {
    return res.status(404).json({
      status: 'error',
      ts: new Date().toISOString(),
      error: `Incident ${id} not found`
    });
  }
  
  if (!by || !note) {
    return res.status(400).json({
      status: 'error',
      ts: new Date().toISOString(),
      error: 'Both "by" and "note" fields are required'
    });
  }
  
  const newAction = {
    at: new Date().toISOString(),
    by: by,
    note: note
  };
  
  if (!incidentActionsLog.has(id)) {
    incidentActionsLog.set(id, []);
  }
  incidentActionsLog.get(id).push(newAction);
  
  console.log(`[RestoreIQ] Action added to ${id}: ${by} - ${note}`);
  
  res.json({
    status: 'ok',
    ts: new Date().toISOString(),
    incidentId: id,
    action: newAction,
    totalActions: incidentActionsLog.get(id).length,
    advisory: ADVISORY_DISCLAIMER
  });
});

// =============================================================================
// HEALTH & STATUS ENDPOINTS
// =============================================================================

/**
 * RestoreIQ Health check endpoint (namespaced to avoid collision)
 */
router.get('/restoreiq/health', async (req, res) => {
  try {
    const storageInfo = await getStorageProviderInfo();
    
    res.json({
      status: 'ok',
      service: 'RestoreIQ',
      version: '1.0.0',
      storage: {
        provider: storageInfo.provider,
        azure_configured: storageInfo.azure_configured
      },
      endpoints: {
        dashboard: [
          'GET  /api/v1/restoreiq/kpis',
          'GET  /api/v1/restoreiq/incidents',
          'GET  /api/v1/restoreiq/incidents/:id',
          'GET  /api/v1/restoreiq/queue',
          'POST /api/v1/restoreiq/incidents/:id/actions'
        ],
        analytics: [
          'POST /api/v1/fault-zones/rank',
          'GET  /api/v1/fault-zones/rankings/:runId',
          'POST /api/v1/replays/after-action/generate',
          'GET  /api/v1/replays/:replayId',
          'GET  /api/v1/replays/outage/:outageId',
          'POST /api/v1/reports/after-action/export',
          'GET  /api/v1/reports/download?token=xxx',
          'GET  /api/v1/reports/:replayId/info'
        ],
        health: 'GET  /api/v1/restoreiq/health'
      },
      advisory: ADVISORY_DISCLAIMER
    });
  } catch (err) {
    res.json({
      status: 'ok',
      service: 'RestoreIQ',
      version: '1.0.0',
      storage: { provider: 'unknown', error: err.message },
      advisory: ADVISORY_DISCLAIMER
    });
  }
});

export default router;

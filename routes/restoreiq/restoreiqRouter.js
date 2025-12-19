/**
 * GridLens RestoreIQ - API Router
 * 
 * Exposes endpoints for:
 * - Step 17: POST /v1/fault-zones/rank
 * - Step 20: POST /v1/replays/after-action/generate
 * - Step 21: POST /v1/reports/after-action/export
 * 
 * All endpoints are ADVISORY ONLY - no operational commands.
 */

import express from "express";
import { rankFaultZones, getRankingByRunId } from "../../services/restoreiq/faultZoneRanking.js";
import { generateAfterActionReplay, getReplayById, getReplaysByOutage } from "../../services/restoreiq/outageReplayGenerator.js";
import { exportAfterActionReport, getReportBlobRef } from "../../services/restoreiq/reportExporter.js";

const router = express.Router();

const ADVISORY_DISCLAIMER = "Advisory-only recommendations. Operator validation required.";

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

/**
 * Step 17: POST /v1/fault-zones/rank
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
 * GET /v1/fault-zones/rankings/:runId
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
 * Step 20: POST /v1/replays/after-action/generate
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
 * GET /v1/replays/:replayId
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
 * GET /v1/replays/outage/:outageId
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
 * Step 21: POST /v1/reports/after-action/export
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
    
    res.json(result);
    
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
 * GET /v1/reports/:replayId/download
 * Get report blob reference for download
 */
router.get('/reports/:replayId/download', async (req, res) => {
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
        error: 'Report not found. Generate report first using POST /v1/reports/after-action/export'
      });
    }
    
    res.json({
      status: 'ok',
      replay_id: replayId,
      report: blobRef,
      advisory: ADVISORY_DISCLAIMER
    });
    
  } catch (err) {
    console.error('[RestoreIQ] Get report error:', err.message);
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RestoreIQ',
    version: '1.0.0',
    endpoints: [
      'POST /v1/fault-zones/rank',
      'GET /v1/fault-zones/rankings/:runId',
      'POST /v1/replays/after-action/generate',
      'GET /v1/replays/:replayId',
      'GET /v1/replays/outage/:outageId',
      'POST /v1/reports/after-action/export',
      'GET /v1/reports/:replayId/download'
    ],
    advisory: ADVISORY_DISCLAIMER
  });
});

export default router;

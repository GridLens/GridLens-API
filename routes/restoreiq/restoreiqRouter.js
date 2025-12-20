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
      endpoints: [
        'POST /api/v1/fault-zones/rank',
        'GET  /api/v1/fault-zones/rankings/:runId',
        'POST /api/v1/replays/after-action/generate',
        'GET  /api/v1/replays/:replayId',
        'GET  /api/v1/replays/outage/:outageId',
        'POST /api/v1/reports/after-action/export',
        'GET  /api/v1/reports/download?token=xxx',
        'GET  /api/v1/reports/:replayId/info',
        'GET  /api/v1/restoreiq/health'
      ],
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

/**
 * GridLens Smart MeterIQ — Core API (MSE)
 * Express server + endpoints
 */

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

import systemHealthRouter from "./routes/systemHealthRouter.js";
import waterLeaksRouter from "./routes/waterLeaksRouter.js";
import electricUsageRouter from "./routes/electricUsageRouter.js";
import energyLossRouter from "./routes/energyLossRouter.js";
import kpiEnergyLoss from "./routes/kpiEnergyLoss.js";
import outagesRouter from "./routes/outagesRouter.js";
import fieldOpsRouter from "./routes/fieldOpsRouter.js";
import { buildAndEnqueueReadBatches } from "./services/amiEmulator.js";
import "./workers/amiWorker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ----------------------
// Core Middleware Setup
// ----------------------

// CORS Configuration - Enable cross-origin resource sharing
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Request body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Request timing middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  req.requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-Id', req.requestId);
  
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - req.startTime;
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${duration}ms`);
    }
    return originalSend.call(this, body);
  };
  
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - Request ID: ${req.requestId}`);
  next();
});

// Cache control for API responses (disable caching by default)
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || !req.path.match(/\.(html|css|js|png|jpg|svg|ico)$/)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// ----------------------

// Temporary API authentication middleware
const authMiddleware = (req, res, next) => {
  // Allow public access to dashboard HTML and static assets
  if (req.path.startsWith('/dashboard') || req.path.match(/\.(html|css|js|png|jpg|svg)$/)) {
    return next();
  }

  // Check for API key
  const apiKey = process.env.GRIDLENS_API_KEY;
  
  // If no API key is set, allow access (auth disabled)
  if (!apiKey) {
    return next();
  }

  // Temporary protection: Allow all GET requests (read-only), require auth for writes
  // This keeps the dashboard working while blocking external write access
  if (req.method === 'GET') {
    return next();
  }

  // Require API key for POST, PATCH, DELETE operations
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'API key required for write operations. Provide as: Authorization: Bearer YOUR_API_KEY' 
    });
  }

  const providedKey = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  if (providedKey !== apiKey) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Invalid API key' 
    });
  }

  next();
};

// Apply authentication to all routes
app.use(authMiddleware);
app.use(express.static(path.join(__dirname, "public")));

// -----------------------------
// Mount Modular Routers
// -----------------------------
app.use('/api/kpi/system-health', systemHealthRouter);
app.use('/api/kpi/water-leaks', waterLeaksRouter);
app.use('/api/kpi/electric-usage', electricUsageRouter);
app.use('/api/kpi/energy-loss', kpiEnergyLoss);
app.use('/api/kpi/outages', outagesRouter);
app.use('/api/fieldops', fieldOpsRouter);

// -----------------------------
// AMI Emulator Endpoints
// -----------------------------
let amiTimer = null;
let amiIntervalMinutes = 15;

app.post('/api/ami/publish-once', async (req, res) => {
  try {
    const { tenantId = 'DEMO_TENANT', intervalMinutes = 15, batchSize = 100 } = req.body || {};
    const result = await buildAndEnqueueReadBatches({ tenantId, intervalMinutes, batchSize });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('AMI publish-once error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/ami/start', async (req, res) => {
  try {
    if (amiTimer) {
      return res.json({ ok: true, message: 'AMI emulator already running', intervalMinutes: amiIntervalMinutes });
    }
    
    const { tenantId = 'DEMO_TENANT', intervalMinutes = 15, batchSize = 100 } = req.body || {};
    amiIntervalMinutes = intervalMinutes;
    
    const runBatch = async () => {
      try {
        await buildAndEnqueueReadBatches({ tenantId, intervalMinutes, batchSize });
      } catch (err) {
        console.error('AMI scheduled batch error:', err.message);
      }
    };
    
    await runBatch();
    amiTimer = setInterval(runBatch, intervalMinutes * 60 * 1000);
    
    res.json({ ok: true, message: `AMI emulator started (every ${intervalMinutes} minutes)` });
  } catch (err) {
    console.error('AMI start error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/ami/stop', (req, res) => {
  if (amiTimer) {
    clearInterval(amiTimer);
    amiTimer = null;
    res.json({ ok: true, message: 'AMI emulator stopped' });
  } else {
    res.json({ ok: true, message: 'AMI emulator was not running' });
  }
});

// -----------------------------
// Fake in-memory data (MVP only)
// -----------------------------
const meters = [
  {
    id: "MTR-1001",
    status: "active",
    type: "electric",
    lastReadKwh: 12450,
    lastReadAt: "2025-11-20T14:10:00Z",
    location: { city: "Holly Springs", state: "MS" },
    multiplier: 1,
    notes: ""
  },
  {
    id: "MTR-1002",
    status: "active",
    type: "water",
    lastReadKwh: null,
    lastReadAt: "2025-11-21T08:22:00Z",
    location: { city: "Byhalia", state: "MS" },
    multiplier: 1,
    notes: ""
  },
  {
    id: "MTR-1003",
    status: "inactive",
    type: "electric",
    lastReadKwh: 0,
    lastReadAt: "2025-11-01T02:00:00Z",
    location: { city: "Byhalia", state: "MS" },
    multiplier: 1,
    notes: "Disconnected for non-payment"
  }
];

const amiEvents = [
  {
    id: "EVT-9001",
    meterId: "MTR-1001",
    eventType: "last_gasp",
    severity: "high",
    occurredAt: "2025-11-21T09:00:00Z",
    meta: { source: "headend", note: "power loss" }
  },
  {
    id: "EVT-9002",
    meterId: "MTR-1002",
    eventType: "comm_fail",
    severity: "medium",
    occurredAt: "2025-11-22T03:12:00Z",
    meta: { retries: 3 }
  }
];

const usageReads = [
  { meterId: "MTR-1001", ts: "2025-11-22T00:00:00Z", kwh: 12.4 },
  { meterId: "MTR-1001", ts: "2025-11-22T01:00:00Z", kwh: 10.9 },
  { meterId: "MTR-1002", ts: "2025-11-22T00:00:00Z", gallons: 34 }
];

// ----------------------------------
// Billing Integrity Engine (v2 MVP)
// Uses BOTH usageReads + amiEvents
// ----------------------------------
function buildBillingFlagsV2(meter, reads, events) {
  const flags = [];
  const now = new Date();

  // ---- Guardrails ----
  if (!reads || reads.length === 0) {
    flags.push({
      code: "missing_reads",
      level: "high",
      msg: "No usage reads found in window",
    });
    return flags;
  }

  // Normalize numeric values
  const values = reads.map(r => r.kwh ?? r.gallons).filter(v => typeof v === "number");
  if (values.length === 0) {
    flags.push({
      code: "missing_reads",
      level: "high",
      msg: "Reads exist but no numeric usage values",
    });
    return flags;
  }

  const avg = values.reduce((a,b)=>a+b,0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);

  // ---- 1) Zero-use / stuck trend ----
  const zeroCount = values.filter(v => v === 0).length;
  if (zeroCount >= Math.ceil(values.length * 0.8)) {
    flags.push({
      code: "zero_use",
      level: "medium",
      msg: "Sustained zero usage (possible stuck / vacant / bypass)",
      stats: { zeroCount, total: values.length }
    });
  }

  // ---- 2) Impossible spike ----
  if (avg > 0 && max > avg * 5) {
    flags.push({
      code: "impossible_spike",
      level: "high",
      msg: "Usage spike exceeds threshold vs. baseline",
      stats: { avg, max }
    });
  }

  // ---- 3) Negative / rollback / bad read ----
  const hasNegative = values.some(v => v < 0);
  if (hasNegative) {
    flags.push({
      code: "negative_reads",
      level: "high",
      msg: "Negative usage detected (rollback / register error)",
    });
  }

  // ---- 4) Inactive meter still billing ----
  if (meter?.status === "inactive" && avg > 0) {
    flags.push({
      code: "inactive_billing_risk",
      level: "high",
      msg: "Inactive meter producing reads (billing risk)",
      stats: { avg }
    });
  }

  // ---- 5) AMI comm-fail correlation ----
  const commFailEvents = (events || []).filter(e =>
    ["comm_fail", "last_gasp", "no_radio", "tamper"].includes(e.eventType)
  );

  if (commFailEvents.length > 0) {
    flags.push({
      code: "ami_event_risk",
      level: "medium",
      msg: "AMI trouble events present in window",
      stats: { eventCount: commFailEvents.length },
      events: commFailEvents.slice(-5)
    });
  }

  // ---- 6) Read gap risk (time-based) ----
  const sortedReads = reads
    .map(r => ({...r, _ts: new Date(r.ts)}))
    .filter(r => !isNaN(r._ts))
    .sort((a,b) => a._ts - b._ts);

  if (sortedReads.length >= 2) {
    const last = sortedReads[sortedReads.length - 1]._ts;
    const hoursSinceLast = (now - last) / (1000 * 60 * 60);

    if (hoursSinceLast > 24) {
      flags.push({
        code: "read_gap",
        level: "medium",
        msg: "No reads in last 24h (estimate / held bill risk)",
        stats: { hoursSinceLast: Math.round(hoursSinceLast) }
      });
    }
  }

  // ---- 7) Flatline (too little variance) ----
  const range = max - min;
  if (avg > 0 && range / avg < 0.02) {
    flags.push({
      code: "flatline_usage",
      level: "low",
      msg: "Usage flatlined vs. normal variance (possible register issue)",
      stats: { min, max, avg }
    });
  }

  return flags;
}

// ----------------------------------
// Meter Health Index™ (MVP v1)
// Score 0–100 using reads + AMI events
// ----------------------------------
function computeMeterHealthIndex(meter, reads = [], events = []) {
  let score = 100;
  const issues = [];
  const now = new Date();

  // Normalize values
  const values = reads
    .map(r => r.kwh ?? r.gallons)
    .filter(v => typeof v === "number");

  // ---- Rule A: Missing reads ----
  if (reads.length === 0 || values.length === 0) {
    score -= 35;
    issues.push({
      code: "missing_reads",
      severity: "high",
      msg: "No usable reads in window"
    });
  }

  // ---- Rule B: Zero-use meters ----
  if (values.length > 0) {
    const zeroCount = values.filter(v => v === 0).length;
    if (zeroCount >= Math.ceil(values.length * 0.8)) {
      score -= 20;
      issues.push({
        code: "zero_use",
        severity: "medium",
        msg: "Sustained zero usage",
        stats: { zeroCount, total: values.length }
      });
    }
  }

  // ---- Rule C: Stuck / flatline meters ----
  if (values.length >= 5) {
    const max = Math.max(...values);
    const min = Math.min(...values);
    const avg = values.reduce((a,b)=>a+b,0) / values.length;
    const range = max - min;

    if (avg > 0 && range / avg < 0.01) {
      score -= 15;
      issues.push({
        code: "stuck_or_flatline",
        severity: "medium",
        msg: "Usage variance extremely low (possible stuck register)",
        stats: { min, max, avg }
      });
    }
  }

  // ---- Rule D: Negative reads / rollback ----
  if (values.some(v => v < 0)) {
    score -= 25;
    issues.push({
      code: "negative_reads",
      severity: "high",
      msg: "Negative usage detected (rollback/register issue)"
    });
  }

  // ---- Rule E: Dead AMI radio / comm failures ----
  const commEvents = events.filter(e =>
    ["comm_fail", "no_radio", "last_gasp"].includes(e.eventType)
  );
  if (commEvents.length > 0) {
    score -= Math.min(25, commEvents.length * 5);
    issues.push({
      code: "ami_comm_trouble",
      severity: "high",
      msg: "AMI comm/radio trouble events present",
      stats: { eventCount: commEvents.length }
    });
  }

  // ---- Rule F: Reversed meter / tamper ----
  const reverseEvents = events.filter(e =>
    ["reverse_energy", "reverse_flow", "tamper"].includes(e.eventType)
  );
  if (reverseEvents.length > 0) {
    score -= 20;
    issues.push({
      code: "reverse_or_tamper",
      severity: "high",
      msg: "Reverse energy/flow or tamper events detected",
      stats: { eventCount: reverseEvents.length }
    });
  }

  // ---- Rule G: No events at all (quiet meter) ----
  if (events.length === 0) {
    score -= 5;
    issues.push({
      code: "no_events",
      severity: "low",
      msg: "No AMI events in window (may be fine, but worth watching)"
    });
  }

  // ---- Rule H: Read gap / repeated estimation proxy ----
  const sortedReads = reads
    .map(r => ({...r, _ts: new Date(r.ts)}))
    .filter(r => !isNaN(r._ts))
    .sort((a,b) => a._ts - b._ts);

  if (sortedReads.length > 0) {
    const lastTs = sortedReads[sortedReads.length - 1]._ts;
    const hoursSinceLast = (now - lastTs) / (1000 * 60 * 60);

    if (hoursSinceLast > 24) {
      score -= 10;
      issues.push({
        code: "read_gap",
        severity: "medium",
        msg: "No reads in last 24h (estimate/held bill risk)",
        stats: { hoursSinceLast: Math.round(hoursSinceLast) }
      });
    }
  }

  // Clamp score 0–100
  score = Math.max(0, Math.min(100, score));

  // Health band
  const band =
    score >= 90 ? "excellent" :
    score >= 75 ? "good" :
    score >= 60 ? "fair" :
    score >= 40 ? "poor" : "critical";

  return { score, band, issues };
}

// -------------
// Health endpoint
// -------------
app.get("/health", (req, res) => {
  res.json({ ok: true, api: "up", db: "mvp-mock" });
});

app.get("/api/health", (req, res) => {
  console.log("[API] GET /api/health");
  res.status(200).json({ status: "ok" });
});

// ---------------------------
// GET /api/debug/test
// Simple debug endpoint
// ---------------------------
app.get("/api/debug/test", (req, res) => {
  res.json({ ok: true, message: "Debug endpoints working" });
});

// ---------------------------
// GET /api/kpi/energy-loss/overview
// Hero metrics / overview (MOCK DATA)
// ---------------------------
app.get("/api/kpi/energy-loss/overview", (req, res) => {
  console.log("[API] GET /api/kpi/energy-loss/overview");
  res.status(200).json({
    totalMeters: 12000,
    healthyMeters: 11250,
    problemMeters: 750,
    systemHealthPercent: 93.8,
    percentHealthyByZone: [
      { zone: "Zone 1", percentHealthy: 92 },
      { zone: "Zone 2", percentHealthy: 94 },
      { zone: "Zone 3", percentHealthy: 95 },
      { zone: "Zone 4", percentHealthy: 91 }
    ]
  });
});

// ---------------------------
// GET /api/kpi/energy-loss/feeders
// Feeder / zone loss view (MOCK DATA)
// ---------------------------
app.get("/api/kpi/energy-loss/feeders", (req, res) => {
  console.log("[API] GET /api/kpi/energy-loss/feeders");
  res.status(200).json([
    {
      name: "Feeder 101",
      zone: "Zone 1",
      loss_percent: 4.2,
      loss_kwh: 12500,
      loss_dollars: 18750,
      active_work_orders: 2
    },
    {
      name: "Feeder 202",
      zone: "Zone 2",
      loss_percent: 3.1,
      loss_kwh: 9800,
      loss_dollars: 14700,
      active_work_orders: 1
    },
    {
      name: "Feeder 303",
      zone: "Zone 3",
      loss_percent: 2.6,
      loss_kwh: 7600,
      loss_dollars: 11400,
      active_work_orders: 0
    },
    {
      name: "Feeder 404",
      zone: "Zone 3",
      loss_percent: 5.0,
      loss_kwh: 15000,
      loss_dollars: 22500,
      active_work_orders: 3
    }
  ]);
});

// ---------------------------
// GET /api/kpi/energy-loss/suspicious-meters
// Suspicious meters table (MOCK DATA)
// ---------------------------
app.get("/api/kpi/energy-loss/suspicious-meters", (req, res) => {
  console.log("[API] GET /api/kpi/energy-loss/suspicious-meters");
  res.status(200).json([
    {
      meterId: "E-551032",
      address: "456 Pine St",
      zone: "Zone 2",
      status: "In Progress",
      riskScore: 0.87
    },
    {
      meterId: "E-445021",
      address: "123 Oak St",
      zone: "Zone 1",
      status: "Unassigned",
      riskScore: 0.91
    },
    {
      meterId: "E-662148",
      address: "789 Elm Ave",
      zone: "Zone 3",
      status: "Scheduled",
      riskScore: 0.72
    },
    {
      meterId: "E-773259",
      address: "321 Main St",
      zone: "Zone 3",
      status: "Open",
      riskScore: 0.95
    },
    {
      meterId: "E-884370",
      address: "555 Cedar Blvd",
      zone: "Zone 2",
      status: "In Progress",
      riskScore: 0.68
    }
  ]);
});

// ---------------------------
// GET /api/kpi/energy-loss/fieldops
// FieldOps KPI summary (MOCK DATA)
// ---------------------------
app.get("/api/kpi/energy-loss/fieldops", (req, res) => {
  console.log("[API] GET /api/kpi/energy-loss/fieldops");
  res.status(200).json([
    {
      id: "WO-1001",
      meterId: "E-551032",
      type: "suspected_theft",
      location: "456 Pine St",
      zone: "Zone 2",
      status: "In Progress",
      priority: "High",
      ageDays: 4,
      assignedTo: "Tech Team A",
      estimatedRecoveredDollars: 320
    },
    {
      id: "WO-1002",
      meterId: "E-445021",
      type: "stopped_meter",
      location: "123 Oak St",
      zone: "Zone 1",
      status: "Open",
      priority: "High",
      ageDays: 8,
      assignedTo: "Unassigned",
      estimatedRecoveredDollars: 190
    },
    {
      id: "WO-1003",
      meterId: "E-662148",
      type: "reverse_flow",
      location: "789 Elm Ave",
      zone: "Zone 3",
      status: "Scheduled",
      priority: "Medium",
      ageDays: 2,
      assignedTo: "Tech Team B",
      estimatedRecoveredDollars: 85
    },
    {
      id: "WO-1004",
      meterId: "E-773259",
      type: "suspected_bypass",
      location: "321 Main St",
      zone: "Zone 1",
      status: "Open",
      priority: "Critical",
      ageDays: 5,
      assignedTo: "Unassigned",
      estimatedRecoveredDollars: 425
    },
    {
      id: "WO-1005",
      meterId: "E-884370",
      type: "meter_inspection",
      location: "555 Cedar Blvd",
      zone: "Zone 2",
      status: "In Progress",
      priority: "Medium",
      ageDays: 14,
      assignedTo: "Tech Team A",
      estimatedRecoveredDollars: 156
    }
  ]);
});

// ---------------------------
// GET /api/kpi/feeders
// Feeder / zone loss view (MOCK DATA) - SHORT PATH
// ---------------------------
app.get("/api/kpi/feeders", (req, res) => {
  res.json({
    tenant: "HSUD",
    feeders: [
      {
        feederName: "FDR-3",
        zoneName: "North Zone",
        lossPct: 7.5,
        kwhLostMonth: 18000,
        dollarsLostMonth: 9500,
        activeWorkOrders: 2
      },
      {
        feederName: "FDR-5",
        zoneName: "Central Zone",
        lossPct: 5.3,
        kwhLostMonth: 12000,
        dollarsLostMonth: 6400,
        activeWorkOrders: 1
      },
      {
        feederName: "FDR-7",
        zoneName: "South Zone",
        lossPct: 4.1,
        kwhLostMonth: 8200,
        dollarsLostMonth: 4100,
        activeWorkOrders: 0
      }
    ]
  });
});

// ---------------------------
// GET /api/kpi/suspicious-meters
// Suspicious meters table (MOCK DATA) - SHORT PATH
// ---------------------------
app.get("/api/kpi/suspicious-meters", (req, res) => {
  res.json({
    tenant: "HSUD",
    meters: [
      {
        meterId: "E-10021",
        accountName: "Smith Residence",
        location: "120 Oak St",
        pattern: "Suspected bypass",
        estLossDollarsMonth: 220,
        daysInState: 7,
        status: "Open"
      },
      {
        meterId: "E-55192",
        accountName: "Residential",
        location: "309 Pine St",
        pattern: "Zero usage anomaly",
        estLossDollarsMonth: 80,
        daysInState: 11,
        status: "Investigating"
      },
      {
        meterId: "E-88012",
        accountName: "Corner Market",
        location: "510 Main St",
        pattern: "Voltage mismatch + tamper",
        estLossDollarsMonth: 310,
        daysInState: 4,
        status: "In progress"
      }
    ]
  });
});

// ---------------------------
// GET /api/kpi/fieldops
// FieldOps KPI summary (MOCK DATA) - SHORT PATH
// ---------------------------
app.get("/api/kpi/fieldops", (req, res) => {
  res.json({
    tenant: "HSUD",
    summary: {
      openLossWorkOrders: 12,
      avgAgeDays: 5.3,
      truckRollsAvoidedEstimate: 8,
      resolvedLast30d: 19
    }
  });
});

// ---------------------------
// GET /meters
// List all meters
// Optional query: ?status=active&type=electric
// ---------------------------
app.get("/meters", (req, res) => {
  const { status, type } = req.query;

  let results = meters;
  if (status) results = results.filter(m => m.status === status);
  if (type) results = results.filter(m => m.type === type);

  res.json({
    count: results.length,
    data: results
  });
});

// ---------------------------
// GET /meter/:id
// Get one meter by id
// ---------------------------
app.get("/meter/:id", (req, res) => {
  const { id } = req.params;
  const meter = meters.find(m => m.id === id);

  if (!meter) {
    return res.status(404).json({
      error: "Meter not found",
      id
    });
  }

  res.json(meter);
});

// ---------------------------
// PATCH /meter/:id
// Update meter fields (partial update)
// Allowed fields:
//   status: "active" | "inactive"
//   type: "electric" | "water" | "gas"
//   location: { city, state, zone, feeder }
//   multiplier: number
//   notes: string
//   meta: any object
// ---------------------------
app.patch("/meter/:id", (req, res) => {
  const { id } = req.params;
  const meterIndex = meters.findIndex(m => m.id === id);

  if (meterIndex === -1) {
    return res.status(404).json({
      error: "Meter not found",
      id
    });
  }

  const meter = meters[meterIndex];
  const updates = req.body || {};

  // -------- Validation (light MVP rules) --------
  if (updates.status && !["active", "inactive"].includes(updates.status)) {
    return res.status(400).json({
      error: "Invalid status. Use 'active' or 'inactive'."
    });
  }

  if (updates.type && !["electric", "water", "gas"].includes(updates.type)) {
    return res.status(400).json({
      error: "Invalid type. Use 'electric', 'water', or 'gas'."
    });
  }

  if (updates.multiplier !== undefined) {
    const mult = Number(updates.multiplier);
    if (isNaN(mult) || mult <= 0) {
      return res.status(400).json({
        error: "multiplier must be a positive number"
      });
    }
    updates.multiplier = mult;
  }

  if (updates.location !== undefined) {
    if (updates.location === null || typeof updates.location !== "object" || Array.isArray(updates.location)) {
      return res.status(400).json({
        error: "location must be a valid object (not null or array)"
      });
    }
  }

  // -------- Apply partial updates (whitelist allowed fields only) --------
  const allowedUpdates = {};
  
  if (updates.status !== undefined) allowedUpdates.status = updates.status;
  if (updates.type !== undefined) allowedUpdates.type = updates.type;
  if (updates.multiplier !== undefined) allowedUpdates.multiplier = updates.multiplier;
  if (updates.notes !== undefined) allowedUpdates.notes = updates.notes;
  if (updates.meta !== undefined) allowedUpdates.meta = updates.meta;
  if (updates.location !== undefined) {
    allowedUpdates.location = { ...(meter.location || {}), ...updates.location };
  }

  const updatedMeter = {
    ...meter,
    ...allowedUpdates
  };

  meters[meterIndex] = updatedMeter;

  res.json({
    message: "Meter updated",
    data: updatedMeter
  });
});

// ---------------------------
// GET /ami/events
// List AMI events
// Optional filters:
//   ?meterId=MTR-1001
//   ?eventType=comm_fail
//   ?severity=high
//   ?since=2025-11-01T00:00:00Z
//   ?limit=50
// ---------------------------
app.get("/ami/events", (req, res) => {
  const { meterId, eventType, severity, since } = req.query;
  const limit = Number(req.query.limit || 100);

  let results = amiEvents;

  if (meterId) results = results.filter(e => e.meterId === meterId);
  if (eventType) results = results.filter(e => e.eventType === eventType);
  if (severity) results = results.filter(e => e.severity === severity);

  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate)) {
      results = results.filter(e => new Date(e.occurredAt) >= sinceDate);
    }
  }

  // newest first
  results = results.sort(
    (a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)
  );

  res.json({
    count: results.length,
    data: results.slice(0, limit)
  });
});

// ---------------------------
// POST /ami/events
// Ingest a new AMI event
// ---------------------------
app.post("/ami/events", (req, res) => {
  const {
    id,
    meterId,
    eventType,
    severity = "low",
    occurredAt,
    meta = {}
  } = req.body || {};

  // Basic validation
  if (!meterId || !eventType || !occurredAt) {
    return res.status(400).json({
      error: "meterId, eventType, and occurredAt are required",
      example: {
        meterId: "MTR-1001",
        eventType: "comm_fail",
        severity: "medium",
        occurredAt: "2025-11-23T05:10:00Z",
        meta: { source: "headend" }
      }
    });
  }

  const dt = new Date(occurredAt);
  if (isNaN(dt)) {
    return res.status(400).json({
      error: "occurredAt must be a valid ISO date string"
    });
  }

  const newEvent = {
    id: id || `EVT-${Date.now()}`,
    meterId,
    eventType,
    severity,
    occurredAt: dt.toISOString(),
    meta
  };

  amiEvents.push(newEvent);

  res.status(201).json({
    message: "AMI event ingested",
    data: newEvent
  });
});

// ---------------------------
// GET /usage/:meter
// Get usage reads for a given meter
// ---------------------------
app.get("/usage/:meter", (req, res) => {
  const { meter } = req.params;
  const limit = Number(req.query.limit || 100);
  const { since, until } = req.query;

  let reads = usageReads.filter(r => r.meterId === meter);

  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate)) {
      reads = reads.filter(r => new Date(r.ts) >= sinceDate);
    }
  }

  if (until) {
    const untilDate = new Date(until);
    if (!isNaN(untilDate)) {
      reads = reads.filter(r => new Date(r.ts) <= untilDate);
    }
  }

  // oldest → newest
  reads = reads.sort((a, b) => new Date(a.ts) - new Date(b.ts));

  res.json({
    meterId: meter,
    count: reads.length,
    data: reads.slice(-limit)
  });
});

// ---------------------------
// POST /usage/:meter
// Ingest ONE usage read for a meter
// ---------------------------
app.post("/usage/:meter", (req, res) => {
  const { meter } = req.params;
  const { ts, kwh, gallons, meterId } = req.body || {};

  // meterId consistency check
  if (meterId && meterId !== meter) {
    return res.status(400).json({
      error: "meterId in body must match /usage/:meter route param",
      routeMeter: meter,
      bodyMeter: meterId
    });
  }

  if (!ts) {
    return res.status(400).json({
      error: "ts is required (ISO date string)",
      exampleElectric: { ts: "2025-11-23T05:10:00Z", kwh: 14.2 },
      exampleWater: { ts: "2025-11-23T05:10:00Z", gallons: 55 }
    });
  }

  const dt = new Date(ts);
  if (isNaN(dt)) {
    return res.status(400).json({ error: "ts must be a valid ISO date" });
  }

  // must supply either kwh or gallons
  const hasKwh = typeof kwh === "number";
  const hasGallons = typeof gallons === "number";
  if (!hasKwh && !hasGallons) {
    return res.status(400).json({
      error: "Provide kwh (number) or gallons (number)."
    });
  }

  const newRead = {
    meterId: meter,
    ts: dt.toISOString(),
    ...(hasKwh ? { kwh } : {}),
    ...(hasGallons ? { gallons } : {})
  };

  usageReads.push(newRead);

  res.status(201).json({
    message: "Usage read ingested",
    data: newRead
  });
});

// ---------------------------
// POST /usage/:meter/bulk
// Ingest MULTIPLE reads at once
// ---------------------------
app.post("/usage/:meter/bulk", (req, res) => {
  const { meter } = req.params;
  const { reads } = req.body || {};

  if (!Array.isArray(reads) || reads.length === 0) {
    return res.status(400).json({
      error: "reads must be a non-empty array"
    });
  }

  const inserted = [];
  const rejected = [];

  reads.forEach((r, idx) => {
    const dt = new Date(r.ts);
    const hasKwh = typeof r.kwh === "number";
    const hasGallons = typeof r.gallons === "number";

    if (!r.ts || isNaN(dt) || (!hasKwh && !hasGallons)) {
      rejected.push({ index: idx, reason: "invalid read", read: r });
      return;
    }

    const newRead = {
      meterId: meter,
      ts: dt.toISOString(),
      ...(hasKwh ? { kwh: r.kwh } : {}),
      ...(hasGallons ? { gallons: r.gallons } : {})
    };

    usageReads.push(newRead);
    inserted.push(newRead);
  });

  res.status(201).json({
    message: "Bulk usage ingestion complete",
    insertedCount: inserted.length,
    rejectedCount: rejected.length,
    inserted,
    rejected
  });
});

// ---------------------------
// GET /billing/flags
// Billing Integrity Engine for ALL meters
// Optional query:
//   ?since=ISO_DATE   (default last 7 days)
//   ?limit=200 reads per meter
// ---------------------------
app.get("/billing/flags", (req, res) => {
  const { since } = req.query;
  const limit = Number(req.query.limit || 200);

  const sinceDate = since ? new Date(since) : new Date(Date.now() - 7*24*60*60*1000);

  const results = meters.map(m => {
    const reads = usageReads
      .filter(r => r.meterId === m.id)
      .filter(r => !sinceDate || new Date(r.ts) >= sinceDate)
      .slice(-limit);

    const events = amiEvents
      .filter(e => e.meterId === m.id)
      .filter(e => !sinceDate || new Date(e.occurredAt) >= sinceDate);

    const flags = buildBillingFlagsV2(m, reads, events);

    return {
      meterId: m.id,
      flagCount: flags.length,
      flags
    };
  });

  res.json({
    since: sinceDate.toISOString(),
    count: results.length,
    data: results
  });
});

// ---------------------------
// GET /billing/flags/:meterId
// Billing flags for ONE meter
// Optional query:
//   ?since=ISO_DATE
//   ?limit=200
// ---------------------------
app.get("/billing/flags/:meterId", (req, res) => {
  const { meterId } = req.params;
  const { since } = req.query;
  const limit = Number(req.query.limit || 200);

  const meter = meters.find(m => m.id === meterId);
  if (!meter) {
    return res.status(404).json({ error: "Meter not found", meterId });
  }

  const sinceDate = since ? new Date(since) : new Date(Date.now() - 7*24*60*60*1000);

  const reads = usageReads
    .filter(r => r.meterId === meterId)
    .filter(r => !sinceDate || new Date(r.ts) >= sinceDate)
    .slice(-limit);

  const events = amiEvents
    .filter(e => e.meterId === meterId)
    .filter(e => !sinceDate || new Date(e.occurredAt) >= sinceDate);

  const flags = buildBillingFlagsV2(meter, reads, events);

  res.json({
    meterId,
    since: sinceDate.toISOString(),
    flagCount: flags.length,
    flags
  });
});

// ---------------------------
// GET /meter-health/score
// Health Index for ALL meters
// Optional query:
//   ?since=ISO_DATE (default last 7 days)
//   ?limit=200 reads per meter
// ---------------------------
app.get("/meter-health/score", (req, res) => {
  const { since } = req.query;
  const limit = Number(req.query.limit || 200);
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 7*24*60*60*1000);

  const results = meters.map(m => {
    const reads = usageReads
      .filter(r => r.meterId === m.id)
      .filter(r => !sinceDate || new Date(r.ts) >= sinceDate)
      .slice(-limit);

    const events = amiEvents
      .filter(e => e.meterId === m.id)
      .filter(e => !sinceDate || new Date(e.occurredAt) >= sinceDate);

    const health = computeMeterHealthIndex(m, reads, events);

    return {
      meterId: m.id,
      type: m.type,
      status: m.status,
      score: health.score,
      band: health.band,
      issues: health.issues
    };
  });

  res.json({
    since: sinceDate.toISOString(),
    count: results.length,
    data: results
  });
});

// ---------------------------
// GET /meter-health/score/:meterId
// Health Index for ONE meter
// Optional query:
//   ?since=ISO_DATE
//   ?limit=200
// ---------------------------
app.get("/meter-health/score/:meterId", (req, res) => {
  const { meterId } = req.params;
  const { since } = req.query;
  const limit = Number(req.query.limit || 200);
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 7*24*60*60*1000);

  const meter = meters.find(m => m.id === meterId);
  if (!meter) {
    return res.status(404).json({ error: "Meter not found", meterId });
  }

  const reads = usageReads
    .filter(r => r.meterId === meterId)
    .filter(r => !sinceDate || new Date(r.ts) >= sinceDate)
    .slice(-limit);

  const events = amiEvents
    .filter(e => e.meterId === meterId)
    .filter(e => !sinceDate || new Date(e.occurredAt) >= sinceDate);

  const health = computeMeterHealthIndex(meter, reads, events);

  res.json({
    meterId,
    type: meter.type,
    status: meter.status,
    since: sinceDate.toISOString(),
    score: health.score,
    band: health.band,
    issues: health.issues
  });
});

// ---------------------------
// GET /api/meter-health/summary
// Meter health summary (MOCK DATA)
// Query: ?tenant=HSUD (default)
// ---------------------------
app.get("/api/meter-health/summary", (req, res) => {
  const tenant = req.query.tenant || "HSUD";

  res.json({
    tenant,
    totals: {
      meters_total: 12000,
      meters_healthy: 11250,
      meters_problem: 750,
      percent_healthy: 93.75
    },
    by_zone: [
      { zone: "Zone 1", meters_total: 3000, meters_healthy: 2920, meters_problem: 80, percent_healthy: 97.33 },
      { zone: "Zone 2", meters_total: 4500, meters_healthy: 4200, meters_problem: 300, percent_healthy: 93.33 },
      { zone: "Zone 3", meters_total: 4500, meters_healthy: 4130, meters_problem: 370, percent_healthy: 91.78 }
    ],
    problem_meters_sample: [
      { meter_id: "10012345", address: "123 Main St", zone: "Zone 2", status: "UNREACHABLE" },
      { meter_id: "10056789", address: "456 Oak St", zone: "Zone 3", status: "LEAK_SUSPECT" }
    ]
  });
});

// ---------------------------
// GET /api/leak-candidates
// Leaks & Loss (MOCK DATA)
// Query: ?tenant=HSUD (default)
// ---------------------------
app.get("/api/leak-candidates", (req, res) => {
  const tenant = req.query.tenant || "HSUD";

  res.json({
    tenant,
    total_estimated_loss: 24850.35,
    candidates: [
      {
        meter_id: "20054321",
        address: "45 Oak St",
        zone: "Zone 3",
        estimated_loss_volume: 123.4,
        estimated_loss_value: 520.75,
        days_continuous_flow: 9,
        risk_score: 0.91,
        status: "New"
      },
      {
        meter_id: "20098765",
        address: "99 Pine Ave",
        zone: "Zone 2",
        estimated_loss_volume: 80.2,
        estimated_loss_value: 310.10,
        days_continuous_flow: 6,
        risk_score: 0.84,
        status: "Investigating"
      }
    ]
  });
});

// ---------------------------
// GET /api/events
// Events & Outages (MOCK DATA)
// Query: ?tenant=HSUD (default)
// ---------------------------
app.get("/api/events", (req, res) => {
  const tenant = req.query.tenant || "HSUD";

  res.json({
    tenant,
    events: [
      {
        event_id: 1,
        meter_id: "10012345",
        event_type: "OUTAGE",
        raw_code: "EV201",
        event_timestamp: "2025-11-30T01:42:00Z",
        zone: "Zone 1",
        details: "Voltage below threshold for > 5 min"
      },
      {
        event_id: 2,
        meter_id: "10056789",
        event_type: "TAMPER",
        raw_code: "EV305",
        event_timestamp: "2025-11-30T02:15:00Z",
        zone: "Zone 3",
        details: "Meter cover removed"
      }
    ]
  });
});

// ---------------------------
// GET /api/work-queue
// FieldOps Queue (MOCK DATA)
// Query: ?tenant=HSUD (default)
// ---------------------------
app.get("/api/work-queue", (req, res) => {
  const tenant = req.query.tenant || "HSUD";

  res.json({
    tenant,
    items: [
      {
        id: 987,
        source_type: "Leak",
        meter_id: "20054321",
        address: "45 Oak St",
        zone: "Zone 3",
        priority: "High",
        status: "New",
        created_at: "2025-11-29T14:05:00Z",
        last_update: "2025-11-29T14:05:00Z"
      },
      {
        id: 988,
        source_type: "Outage pattern",
        meter_id: "10012345",
        address: "123 Main St",
        zone: "Zone 1",
        priority: "Medium",
        status: "Investigating",
        created_at: "2025-11-28T10:22:00Z",
        last_update: "2025-11-29T09:10:00Z"
      }
    ]
  });
});

// ---------------------------
// GET /api/meters/:id
// Single meter detail from PostgreSQL
// Query: ?tenant=HSUD (default)
// ---------------------------
app.get("/api/meters/:id", async (req, res) => {
  const tenant = req.query.tenant || "HSUD";
  const meterId = req.params.id;

  try {
    const meterResult = await queryDb(`
      SELECT tenant_id, meter_id, address, zone, service_type, status
      FROM meters
      WHERE tenant_id = $1 AND meter_id = $2
    `, [tenant, meterId]);

    if (meterResult.rows.length === 0) {
      return res.status(404).json({ error: "Meter not found" });
    }

    const eventsResult = await queryDb(`
      SELECT event_type, event_timestamp, raw_code, details
      FROM meter_events
      WHERE tenant_id = $1 AND meter_id = $2
      ORDER BY event_timestamp DESC
      LIMIT 50
    `, [tenant, meterId]);

    res.json({
      ...meterResult.rows[0],
      last_events: eventsResult.rows
    });

  } catch (err) {
    console.error("meter-detail error:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

// ---------------------------
// GET /meters/risk-map
// Groups Meter Health by a field.
// Supported groupBy:
//   city (default)
//   feeder
//   zone
//   transformer
//
// Optional query:
//   ?groupBy=feeder
//   ?since=ISO_DATE (default last 7 days)
//   ?limit=200 reads per meter
// ---------------------------
app.get("/meters/risk-map", (req, res) => {
  const groupBy = (req.query.groupBy || "city").toLowerCase();
  const { since } = req.query;
  const limit = Number(req.query.limit || 200);

  // Validate groupBy
  const allowed = ["city", "feeder", "zone", "transformer"];
  if (!allowed.includes(groupBy)) {
    return res.status(400).json({
      error: `groupBy must be one of: ${allowed.join(", ")}`,
      example: "/meters/risk-map?groupBy=feeder"
    });
  }

  // Validate limit
  if (isNaN(limit) || limit < 0) {
    return res.status(400).json({
      error: "limit must be a non-negative number"
    });
  }

  // Validate and parse since
  let sinceDate;
  if (since) {
    sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({
        error: "since must be a valid ISO 8601 date",
        example: "?since=2025-11-01T00:00:00Z"
      });
    }
  } else {
    sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }

  // Helper to safely pull grouping key from meter
  function getGroupKey(m) {
    const loc = m.location || {};
    if (groupBy === "city") return loc.city || "unknown";
    if (groupBy === "feeder") return loc.feeder || m.feeder || "unknown";
    if (groupBy === "zone") return loc.zone || m.zone || "unknown";
    if (groupBy === "transformer") return loc.transformer || m.transformer || "unknown";
    return "unknown";
  }

  const buckets = {}; 
  // buckets[key] = {
  //   key,
  //   meters: [],
  //   bandCounts: {excellent, good, fair, poor, critical},
  //   avgScore,
  //   worstMeters:[]
  // }

  meters.forEach(m => {
    const reads = usageReads
      .filter(r => r.meterId === m.id)
      .filter(r => {
        const readDate = new Date(r.ts);
        return !isNaN(readDate.getTime()) && readDate >= sinceDate;
      })
      .slice(-limit);

    const events = amiEvents
      .filter(e => e.meterId === m.id)
      .filter(e => {
        const eventDate = new Date(e.occurredAt);
        return !isNaN(eventDate.getTime()) && eventDate >= sinceDate;
      });

    const health = computeMeterHealthIndex(m, reads, events);

    const key = getGroupKey(m);
    if (!buckets[key]) {
      buckets[key] = {
        key,
        groupBy,
        meterCount: 0,
        bandCounts: {
          excellent: 0,
          good: 0,
          fair: 0,
          poor: 0,
          critical: 0
        },
        _scoreSum: 0,
        meters: []
      };
    }

    const b = buckets[key];
    b.meterCount += 1;
    b.bandCounts[health.band] = (b.bandCounts[health.band] || 0) + 1;
    b._scoreSum += health.score;

    b.meters.push({
      meterId: m.id,
      score: health.score,
      band: health.band,
      issues: health.issues
    });
  });

  // finalize each bucket
  const results = Object.values(buckets).map(b => {
    const avgScore =
      b.meterCount === 0 ? 0 : b._scoreSum / b.meterCount;

    const worstMeters = [...b.meters]
      .sort((a, c) => a.score - c.score)
      .slice(0, 3);

    // remove internal temp field
    delete b._scoreSum;

    return {
      key: b.key,
      groupBy: b.groupBy,
      meterCount: b.meterCount,
      avgScore: Number(avgScore.toFixed(1)),
      bandCounts: b.bandCounts,
      worstMeters
    };
  });

  // Sort buckets by risk (lowest avgScore first)
  results.sort((a, b) => a.avgScore - b.avgScore);

  res.json({
    groupBy,
    since: sinceDate.toISOString(),
    bucketCount: results.length,
    data: results
  });
});

// ---------------------------
// GET /dashboard/overview
// One-call bundle for dashboards.
// Includes:
//  - fleet health summary
//  - at-risk meters
//  - risk map buckets
//  - billing flags overview
//
// Optional query:
//   ?since=ISO_DATE (default last 7 days)
//   ?limit=200 reads per meter
//   ?threshold=60 (at-risk cutoff)
//   ?groupBy=city|feeder|zone|transformer (risk map grouping)
// ---------------------------
app.get("/dashboard/overview", (req, res) => {
  const { since } = req.query;
  const limit = Number(req.query.limit || 200);
  const threshold = Number(req.query.threshold || 60);
  const groupBy = (req.query.groupBy || "city").toLowerCase();

  // Validate limit
  if (isNaN(limit) || limit < 0) {
    return res.status(400).json({
      error: "limit must be a non-negative number"
    });
  }

  // Validate threshold
  if (isNaN(threshold) || threshold < 0 || threshold > 100) {
    return res.status(400).json({
      error: "threshold must be a number between 0 and 100"
    });
  }

  // Validate groupBy
  const allowedGroup = ["city", "feeder", "zone", "transformer"];
  if (!allowedGroup.includes(groupBy)) {
    return res.status(400).json({
      error: `groupBy must be one of: ${allowedGroup.join(", ")}`
    });
  }

  // Validate and parse since
  let sinceDate;
  if (since) {
    sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({
        error: "since must be a valid ISO 8601 date",
        example: "?since=2025-11-01T00:00:00Z"
      });
    }
  } else {
    sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }

  // ---------- HEALTH SUMMARY ----------
  const bandCounts = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
    critical: 0
  };

  const issueTally = {};   // Meter health issues tally
  const scoredMeters = []; // For avg/worst/at-risk

  // ---------- BILLING FLAGS ----------
  const billingTally = {};  // Billing flags tally
  const billingMeters = []; // For worst billing meters

  // ---------- RISK MAP ----------
  const safeGroupBy = groupBy;

  function getGroupKey(m) {
    const loc = m.location || {};
    if (safeGroupBy === "city") return loc.city || "unknown";
    if (safeGroupBy === "feeder") return loc.feeder || m.feeder || "unknown";
    if (safeGroupBy === "zone") return loc.zone || m.zone || "unknown";
    if (safeGroupBy === "transformer") return loc.transformer || m.transformer || "unknown";
    return "unknown";
  }

  const buckets = {}; // risk-map buckets

  // ---------- LOOP THROUGH METERS ----------
  meters.forEach(m => {
    const reads = usageReads
      .filter(r => r.meterId === m.id)
      .filter(r => {
        const readDate = new Date(r.ts);
        return !isNaN(readDate.getTime()) && readDate >= sinceDate;
      })
      .slice(-limit);

    const events = amiEvents
      .filter(e => e.meterId === m.id)
      .filter(e => {
        const eventDate = new Date(e.occurredAt);
        return !isNaN(eventDate.getTime()) && eventDate >= sinceDate;
      });

    // Health score
    const health = computeMeterHealthIndex(m, reads, events);

    bandCounts[health.band] = (bandCounts[health.band] || 0) + 1;

    health.issues.forEach(issue => {
      issueTally[issue.code] = (issueTally[issue.code] || 0) + 1;
    });

    scoredMeters.push({
      meterId: m.id,
      type: m.type,
      status: m.status,
      score: health.score,
      band: health.band,
      issues: health.issues
    });

    // Billing flags - count each flag code once per meter
    const billingFlags = buildBillingFlagsV2(m, reads, events);
    const flagCodes = new Set(billingFlags.map(f => f.code));
    flagCodes.forEach(code => {
      billingTally[code] = (billingTally[code] || 0) + 1;
    });

    billingMeters.push({
      meterId: m.id,
      flagCount: billingFlags.length,
      flags: billingFlags
    });

    // Risk-map bucket
    const key = getGroupKey(m);
    if (!buckets[key]) {
      buckets[key] = {
        key,
        groupBy: safeGroupBy,
        meterCount: 0,
        bandCounts: {
          excellent: 0, good: 0, fair: 0, poor: 0, critical: 0
        },
        _scoreSum: 0,
        meters: []
      };
    }

    const b = buckets[key];
    b.meterCount += 1;
    b.bandCounts[health.band] = (b.bandCounts[health.band] || 0) + 1;
    b._scoreSum += health.score;
    b.meters.push({
      meterId: m.id,
      score: health.score,
      band: health.band,
      issues: health.issues
    });
  });

  // ---------- FINALIZE HEALTH SUMMARY ----------
  const avgScore =
    scoredMeters.length === 0
      ? 0
      : scoredMeters.reduce((s, x) => s + x.score, 0) / scoredMeters.length;

  const topIssues = Object.entries(issueTally)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const worstMeters = [...scoredMeters]
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  const atRisk = [...scoredMeters]
    .filter(m => m.score < threshold)
    .sort((a, b) => a.score - b.score);

  // ---------- FINALIZE BILLING SUMMARY ----------
  const topBillingFlags = Object.entries(billingTally)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const worstBillingMeters = [...billingMeters]
    .sort((a, b) => b.flagCount - a.flagCount)
    .slice(0, 5);

  // ---------- FINALIZE RISK MAP ----------
  const riskMap = Object.values(buckets).map(b => {
    const avg = b.meterCount === 0 ? 0 : b._scoreSum / b.meterCount;
    const worst = [...b.meters].sort((x, y) => x.score - y.score).slice(0, 3);
    delete b._scoreSum;
    delete b.meters;

    return {
      key: b.key,
      groupBy: b.groupBy,
      meterCount: b.meterCount,
      avgScore: Number(avg.toFixed(1)),
      bandCounts: b.bandCounts,
      worstMeters: worst
    };
  }).sort((a, b) => a.avgScore - b.avgScore);

  // ---------- RESPONSE ----------
  res.json({
    since: sinceDate.toISOString(),
    params: { limit, threshold, groupBy: safeGroupBy },

    health: {
      meterCount: scoredMeters.length,
      avgScore: Number(avgScore.toFixed(1)),
      bandCounts,
      topIssues,
      worstMeters
    },

    atRisk: {
      threshold,
      count: atRisk.length,
      meters: atRisk
    },

    riskMap: {
      groupBy: safeGroupBy,
      bucketCount: riskMap.length,
      buckets: riskMap
    },

    billing: {
      topFlags: topBillingFlags,
      worstMeters: worstBillingMeters
    }
  });
});

// -----------------------------
// Helper Functions
// -----------------------------
async function insertRow(sql, params) {
  const { pool } = await import('./db.js');
  return pool.query(sql, params);
}

async function queryDb(sql, params) {
  const { pool } = await import('./db.js');
  return pool.query(sql, params);
}

function safeLog(label, data) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${label}`, JSON.stringify(data, null, 2));
}

// Nodemailer email helper
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "cdean@gridlensenergy.com";

async function sendNotificationEmail(data) {
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.log('SMTP not configured - skipping email notification');
      return false;
    }

    const subject = `New ${data.form_type || "pilot"} signup – ${data.full_name}`;
    const text = `
New ${data.form_type || "pilot"} form submission

Name: ${data.full_name}
Email: ${data.email}
Utility: ${data.utility_name || "-"}
Meters in scope: ${data.meters_in_scope || "-"}
Role / Title: ${data.role_title || "-"}
Phone: ${data.phone || "-"}
City/State: ${data.city_state || "-"}

Notes:
${data.notes || "-"}

-- GridLens Energy website
`;

    await transporter.sendMail({
      from: `"GridLens Website" <${NOTIFY_EMAIL}>`,
      to: NOTIFY_EMAIL,
      subject,
      text
    });

    console.log(`Email sent successfully to ${NOTIFY_EMAIL}`);
    return true;
  } catch (err) {
    console.error('Email error:', err.message);
    return false;
  }
}

// --- CONTACT FORM BACKEND ---------------------------------------
// POST /api/contact
// Handle contact form submissions from Webflow
// Webflow submits as urlencoded by default, so handle both JSON and form
app.post("/api/contact", async (req, res) => {
  try {
    const body = req.body || {};

    const full_name = body.full_name || body.name || body["Full name"] || "";
    const email = body.email || body["Work email"] || "";
    const utility_name = body.utility_name || body["Utility or organization name"] || "";
    const role_title = body.role_title || body["Role / title"] || null;
    const topic = body.topic || body["Topic"] || null;
    const message = body.message || body["Message"] || "";

    if (!full_name || !email || !utility_name || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const sql = `
      SET search_path TO gridlens, public;

      INSERT INTO contact_leads
        (full_name, email, utility_name, role_title, topic, message)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at;
    `;

    const result = await insertRow(sql, [
      full_name,
      email,
      utility_name,
      role_title,
      topic,
      message
    ]);

    const row = result.rows?.[0];

    safeLog("📨 New contact_lead", {
      id: row?.id,
      full_name,
      email,
      utility_name
    });

    // Fire-and-forget email notification
    sendNotificationEmail({
      form_type: "contact",
      full_name,
      email,
      utility_name,
      role_title,
      notes: message
    }).catch(err => {
      console.error("Email send failed:", err.message);
    });

    res.json({
      status: "ok",
      lead_id: row?.id,
      created_at: row?.created_at
    });
  } catch (err) {
    console.error("Error in /api/contact:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- PILOT SIGNUP BACKEND ---------------------------------------
// Handle Contact + Pilot form submissions from Webflow
app.post("/api/pilot-signup", async (req, res) => {
  try {
    // Webflow will send x-www-form-urlencoded by default
    const {
      form_type,         // 'contact' or 'pilot'
      full_name,
      email,
      utility_name,
      meters_in_scope,
      role_title,
      phone,
      city_state,
      notes,
      heard_about_us,
      source_page,
      utm_campaign,
      utm_source,
      utm_medium
    } = req.body || {};

    if (!full_name || !email) {
      return res.status(400).json({ error: "full_name and email are required" });
    }

    const metersParsed =
      meters_in_scope && meters_in_scope !== ""
        ? parseInt(meters_in_scope, 10)
        : null;

    const sql = `
      INSERT INTO pilot_signups (
        form_type,
        full_name,
        email,
        utility_name,
        meters_in_scope,
        role_title,
        phone,
        city_state,
        notes,
        heard_about_us,
        source_page,
        utm_campaign,
        utm_source,
        utm_medium
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id, created_at;
    `;

    const params = [
      form_type || "pilot",
      full_name || "",
      email || "",
      utility_name || null,
      metersParsed,
      role_title || null,
      phone || null,
      city_state || null,
      notes || null,
      heard_about_us || null,
      source_page || null,
      utm_campaign || null,
      utm_source || null,
      utm_medium || null
    ];

    const result = await insertRow(sql, params);
    const row = result.rows?.[0];

    console.log("🚀 New pilot signup:", {
      id: row?.id,
      form_type: form_type || "pilot",
      full_name,
      email,
      utility_name,
      meters_in_scope: metersParsed
    });

    // Fire-and-forget email notification
    sendNotificationEmail({
      form_type: form_type || "pilot",
      full_name,
      email,
      utility_name,
      meters_in_scope: metersParsed,
      role_title,
      phone,
      city_state,
      notes
    }).catch(err => {
      console.error("Email send failed:", err.message);
    });

    // Webflow expects a 200/3xx to count as success
    return res.status(200).json({
      ok: true,
      id: row?.id,
      created_at: row?.created_at
    });
  } catch (err) {
    console.error("Error in /api/pilot-signup:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// -----------------------------
// 404 Handler - Route not found
// -----------------------------
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} does not exist`,
    requestId: req.requestId
  });
});

// -----------------------------
// Global Error Handler
// -----------------------------
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] Error in ${req.method} ${req.path}:`, err.message);
  console.error(err.stack);

  const statusCode = err.statusCode || err.status || 500;
  
  res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
    requestId: req.requestId,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// -----------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`GridLens API + Dashboard running on port ${PORT}`);
  console.log(`CORS enabled for all origins`);
  console.log(`Request logging and timing enabled`);
});

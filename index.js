/**
 * GridLens Smart MeterIQ — Core API (MSE)
 * Express server + endpoints
 */

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ----------------------
// Core Middleware Setup
// ----------------------

// CORS Configuration - Enable cross-origin resource sharing
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);
    // Allow all origins in development, can be restricted in production
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-API-Key',
    'Cache-Control'
  ],
  exposedHeaders: ['X-Request-Id', 'X-Response-Time'],
  credentials: true,
  maxAge: 86400, // Cache preflight requests for 24 hours
  optionsSuccessStatus: 200
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

function safeLog(label, data) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${label}`, JSON.stringify(data, null, 2));
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
app.post("/api/pilot-signup", async (req, res) => {
  const {
    full_name,
    email,
    utility_name,
    meters_in_scope,
    role_title,
    phone,
    city_state,
    notes,
    heard_about_us,
    status,
    source_page,
    utm_campaign,
    utm_source,
    utm_medium
  } = req.body || {};

  // Basic validation
  if (!full_name || !email || !utility_name) {
    return res.status(400).json({
      ok: false,
      error: "Missing required fields: full_name, email, utility_name"
    });
  }

  const sql = `
    INSERT INTO pilot_signups (
      full_name,
      email,
      utility_name,
      meters_in_scope,
      role_title,
      phone,
      city_state,
      notes,
      heard_about_us,
      status,
      source_page,
      utm_campaign,
      utm_source,
      utm_medium
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14
    );
  `;

  const params = [
    full_name,
    email,
    utility_name,
    meters_in_scope ? Number(meters_in_scope) : null,
    role_title || null,
    phone || null,
    city_state || null,
    notes || null,
    heard_about_us || null,
    status || "New",
    source_page || null,
    utm_campaign || null,
    utm_source || null,
    utm_medium || null
  ];

  try {
    await insertRow(sql, params);

    console.log("🚀 New pilot_signup", {
      full_name,
      email,
      utility_name,
      meters_in_scope
    });

    return res.json({
      ok: true,
      message: "Pilot signup saved. GridLens team will follow up."
    });
  } catch (err) {
    console.error("Error saving pilot signup:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Server error saving pilot signup" });
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

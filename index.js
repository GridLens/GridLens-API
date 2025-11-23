/**
 * GridLens Smart MeterIQ — Core API (MSE)
 * Express server + endpoints
 */

import express from "express";

const app = express();
app.use(express.json());

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
    location: { city: "Holly Springs", state: "MS" }
  },
  {
    id: "MTR-1002",
    status: "active",
    type: "water",
    lastReadKwh: null,
    lastReadAt: "2025-11-21T08:22:00Z",
    location: { city: "Byhalia", state: "MS" }
  },
  {
    id: "MTR-1003",
    status: "inactive",
    type: "electric",
    lastReadKwh: 0,
    lastReadAt: "2025-11-01T02:00:00Z",
    location: { city: "Byhalia", state: "MS" }
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
// Simple "engines" (MVP placeholders)
// ----------------------------------
function buildBillingFlags(meter, reads) {
  const flags = [];

  // Missing reads (no usage in 24h)
  if (!reads || reads.length === 0) {
    flags.push({ code: "missing_reads", level: "high", msg: "No reads in window" });
    return flags;
  }

  // Zero-use
  const zeroCount = reads.filter(r => (r.kwh ?? r.gallons) === 0).length;
  if (zeroCount >= Math.ceil(reads.length * 0.8)) {
    flags.push({ code: "zero_use", level: "medium", msg: "Sustained zero usage" });
  }

  // Impossible spike (very naive rule for now)
  const values = reads.map(r => r.kwh ?? r.gallons);
  const max = Math.max(...values);
  const avg = values.reduce((a,b)=>a+b,0) / values.length;
  if (max > avg * 5) {
    flags.push({ code: "impossible_spike", level: "high", msg: "Usage spike exceeds threshold" });
  }

  // Inactive meter but still reading
  if (meter?.status === "inactive" && avg > 0) {
    flags.push({ code: "inactive_billing_risk", level: "high", msg: "Inactive meter producing reads" });
  }

  return flags;
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
    return res.status(404).json({ error: "Meter not found", id });
  }

  res.json(meter);
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
// Body example:
// {
//   "meterId": "MTR-1001",
//   "eventType": "last_gasp",
//   "severity": "high",
//   "occurredAt": "2025-11-23T05:10:00Z",
//   "meta": { "source": "headend" }
// }
// NOTE: id auto-generated if not provided
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
// Optional filters:
//   ?limit=24
//   ?since=2025-11-01T00:00:00Z
//   ?until=2025-11-23T00:00:00Z
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
// Body example (electric):
// { "ts":"2025-11-23T05:10:00Z", "kwh": 14.2 }
//
// Body example (water):
// { "ts":"2025-11-23T05:10:00Z", "gallons": 55 }
//
// If meterId is in body, it must match route.
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
// Body example:
// {
//   "reads":[
//     {"ts":"2025-11-23T00:00:00Z","kwh":12.1},
//     {"ts":"2025-11-23T01:00:00Z","kwh":11.8}
//   ]
// }
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
// Run Billing Integrity Engine for all meters
// Returns flags per meter
// ---------------------------
app.get("/billing/flags", (req, res) => {
  const results = meters.map(m => {
    const reads = usageReads.filter(r => r.meterId === m.id);
    const flags = buildBillingFlags(m, reads);
    return {
      meterId: m.id,
      flags,
      flagCount: flags.length
    };
  });

  res.json({
    count: results.length,
    data: results
  });
});

// -----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 GridLens API running on port ${PORT}`);
});

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

// -----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 GridLens API running on port ${PORT}`);
});

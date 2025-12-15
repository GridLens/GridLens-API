# GridLens Phase 3 Pilot Runbook

## Prerequisites

1. Azure PostgreSQL with base tables: `meters`, `feeders`, `meter_reads_electric`
2. Run migration: `psql $DATABASE_URL -f sql/phase3_ami_events.sql`
3. Run KPI views: `psql $DATABASE_URL -f sql/kpi_views.sql`
4. Set `GRIDLENS_API_KEY` secret
5. Set `REDIS_URL` for BullMQ
6. Set `DATABASE_URL` pointing to Azure PostgreSQL

---

## Publish Once (Single Batch)

```bash
curl -X POST http://localhost:5000/api/ami/publish-once \
  -H "Authorization: Bearer $GRIDLENS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"DEMO_TENANT","intervalMinutes":15,"batchSize":100}'
```

---

## Start Continuous Emulation

```bash
curl -X POST http://localhost:5000/api/ami/start \
  -H "Authorization: Bearer $GRIDLENS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"DEMO_TENANT","intervalMinutes":15}'
```

---

## Stop Emulation

```bash
curl -X POST http://localhost:5000/api/ami/stop \
  -H "Authorization: Bearer $GRIDLENS_API_KEY"
```

---

## Trigger Events

### Theft Event (usage drops, feeder stays normal)
```bash
curl -X POST http://localhost:5000/api/ami/event/theft \
  -H "Authorization: Bearer $GRIDLENS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"DEMO_TENANT","feederId":"FEEDER_7","durationMinutes":60,"severity":0.8}'
```

### Comms Outage (skip reads for feeder meters)
```bash
curl -X POST http://localhost:5000/api/ami/event/comms-outage \
  -H "Authorization: Bearer $GRIDLENS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"DEMO_TENANT","feederId":"FEEDER_3","durationMinutes":30,"severity":1.0}'
```

### Voltage Sag (voltage below normal band)
```bash
curl -X POST http://localhost:5000/api/ami/event/voltage-sag \
  -H "Authorization: Bearer $GRIDLENS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"DEMO_TENANT","feederId":"FEEDER_5","durationMinutes":45,"severity":0.6}'
```

---

## Validation Endpoints

### Check AMI Status (no auth required)
```bash
curl "http://localhost:5000/api/ami/status?tenantId=DEMO_TENANT"
```

### KPI Quickcheck (no auth required)
```bash
curl "http://localhost:5000/api/ami/kpi/quickcheck?tenantId=DEMO_TENANT"
```

---

## SQL Verification Queries

### Check Recent Ingestion
```sql
SELECT COUNT(*), MAX(read_at) as latest, MIN(read_at) as oldest
FROM meter_reads_electric
WHERE tenant_id = 'DEMO_TENANT'
  AND read_at > NOW() - INTERVAL '1 hour';
```

### Check Active Events
```sql
SELECT * FROM ami_events
WHERE is_active = true AND end_at > NOW()
ORDER BY start_at DESC;
```

### Verify KPI Overview Updates
```sql
SELECT day, total_loss_kwh, loss_percent_pct
FROM v_kpi_electric_overview_daily
WHERE tenant_id = 'DEMO_TENANT'
ORDER BY day DESC LIMIT 5;
```

### Verify Feeder Loss
```sql
SELECT feeder, loss_percent
FROM v_kpi_electric_feeder_loss_daily
WHERE tenant_id = 'DEMO_TENANT'
ORDER BY day DESC, loss_percent DESC LIMIT 10;
```

### Verify Suspicious Meters
```sql
SELECT meter_id, issue
FROM v_kpi_suspicious_meters_daily
WHERE tenant_id = 'DEMO_TENANT'
ORDER BY day DESC LIMIT 10;
```

---

## Pilot Demo Flow

### Step 1: Baseline Data
1. Start emulator with 15-minute intervals
2. Let run for 30-60 minutes to establish baseline
3. Check KPI quickcheck endpoint - note baseline loss percent

### Step 2: Trigger Theft Event
1. POST /api/ami/event/theft for a specific feeder
2. Wait 15-30 minutes for next ingestion cycles
3. Check KPI quickcheck - loss percent should increase for affected feeder

### Step 3: Show Detection
1. Query v_kpi_suspicious_meters_daily
2. Show meters flagged with THEFT_SUSPECTED quality_flags
3. Demonstrate how feeder delivered vs meter sum diverges

### Step 4: Recovery
1. Event expires after durationMinutes
2. Show loss percent returning to baseline
3. Compare before/after metrics

### Step 5: Voltage Sag Demo
1. Trigger voltage-sag event
2. Show voltage readings dropping in meter_reads_electric
3. Show v_kpi_suspicious_meters_daily flagging VOLTAGE_ANOMALY

---

## Troubleshooting

### Queue Not Processing
- Check Redis connection: `curl http://localhost:5000/api/ami/status`
- Verify REDIS_URL is correctly set and password has no extra spaces

### No Data in Views
- Confirm meter_reads_electric has recent rows
- Check that KPI views exist in database
- Verify tenant_id matches between tables

### Events Not Affecting Reads
- Check ami_events table for active events
- Verify feeder_id matches meters.feeder_id
- Ensure event end_at is in the future

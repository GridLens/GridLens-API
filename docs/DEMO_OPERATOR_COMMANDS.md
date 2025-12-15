# GridLens Demo Operator Commands

## Quick Reference

### 1. Reset Demo (Clean Slate)
```bash
curl -X POST http://localhost:5000/api/ami/demo/reset \
  -H "Authorization: Bearer $GRIDLENS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"DEMO_TENANT","clearReads":false}'
```

Options:
- `clearReads: false` - Keep historical baseline reads (default)
- `clearReads: true` - Clear all reads for a fresh start

### 2. Enable Demo Mode
```bash
curl -X POST http://localhost:5000/api/ami/demo/mode \
  -H "Authorization: Bearer $GRIDLENS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'
```

When demo mode is enabled:
- Prevents overlapping conflicting events on same feeder
- Logs every injected event clearly
- Prefer deterministic behavior over randomness

### 3. Check Demo Status
```bash
curl "http://localhost:5000/api/ami/demo/status?tenantId=DEMO_TENANT"
```

Returns:
- `demoMode` - Whether demo mode is active
- `lastPublishAt` - Last read publish timestamp
- `lastEventInjected` - Details of last injected event
- `activeEvents` - List of currently active events

### 4. Baseline Publish
```bash
curl -X POST http://localhost:5000/api/ami/publish-once \
  -H "Authorization: Bearer $GRIDLENS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"DEMO_TENANT","intervalMinutes":15,"batchSize":200}'
```

### 5. Trigger Events

#### Theft Event (Revenue Loss)
```bash
curl -X POST http://localhost:5000/api/ami/event/theft \
  -H "Authorization: Bearer $GRIDLENS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"DEMO_TENANT","feederId":"FEEDER_7","durationMinutes":60,"severity":0.8}'
```
- Effect: Reduces kWh readings by severity factor (0.8 = 80% reduction)
- KPIs impacted: Energy loss, feeder ranking, suspicious meters

#### Comms Outage (Missing Reads)
```bash
curl -X POST http://localhost:5000/api/ami/event/comms-outage \
  -H "Authorization: Bearer $GRIDLENS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"DEMO_TENANT","feederId":"FEEDER_3","durationMinutes":60,"severity":1.0}'
```
- Effect: Skips generating reads for affected meters
- KPIs impacted: Suspicious meters, FieldOps tasks, read count drop

#### Voltage Sag (Power Quality)
```bash
curl -X POST http://localhost:5000/api/ami/event/voltage-sag \
  -H "Authorization: Bearer $GRIDLENS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"DEMO_TENANT","feederId":"FEEDER_5","durationMinutes":60,"severity":0.5}'
```
- Effect: Generates voltage values between 105-112V (below normal 120V)
- KPIs impacted: Power quality tasks, suspicious meters, FieldOps

### 6. Validate KPI Movement
```bash
curl "http://localhost:5000/api/ami/demo/validate-kpi?tenantId=DEMO_TENANT"
```

Returns current KPI snapshot and any warnings if no movement detected.

### 7. Quick KPI Check
```bash
curl "http://localhost:5000/api/ami/kpi/quickcheck?tenantId=DEMO_TENANT"
```

## Demo Flow Runbook

### Standard Demo Sequence

1. **Enable Demo Mode**
   ```bash
   curl -X POST http://localhost:5000/api/ami/demo/mode \
     -H "Authorization: Bearer $GRIDLENS_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"enabled":true}'
   ```

2. **Reset Demo Environment**
   ```bash
   curl -X POST http://localhost:5000/api/ami/demo/reset \
     -H "Authorization: Bearer $GRIDLENS_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"tenantId":"DEMO_TENANT","clearReads":true}'
   ```

3. **Publish Baseline Reads**
   ```bash
   curl -X POST http://localhost:5000/api/ami/publish-once \
     -H "Authorization: Bearer $GRIDLENS_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"tenantId":"DEMO_TENANT","intervalMinutes":15,"batchSize":200}'
   ```

4. **Capture Baseline KPIs**
   ```bash
   curl "http://localhost:5000/api/ami/kpi/quickcheck?tenantId=DEMO_TENANT"
   ```

5. **Inject Event (e.g., Theft)**
   ```bash
   curl -X POST http://localhost:5000/api/ami/event/theft \
     -H "Authorization: Bearer $GRIDLENS_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"tenantId":"DEMO_TENANT","feederId":"FEEDER_7","durationMinutes":60,"severity":0.8}'
   ```

6. **Publish Post-Event Reads**
   ```bash
   curl -X POST http://localhost:5000/api/ami/publish-once \
     -H "Authorization: Bearer $GRIDLENS_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"tenantId":"DEMO_TENANT","intervalMinutes":15,"batchSize":200}'
   ```

7. **Compare KPIs**
   ```bash
   curl "http://localhost:5000/api/ami/kpi/quickcheck?tenantId=DEMO_TENANT"
   ```

8. **Validate KPI Movement**
   ```bash
   curl "http://localhost:5000/api/ami/demo/validate-kpi?tenantId=DEMO_TENANT"
   ```

## Feeders Available
- FEEDER_1 through FEEDER_10

## Notes
- Events are time-bound and only affect reads when the read timestamp falls within the event window
- Demo mode automatically deactivates conflicting events on the same feeder before creating new ones
- All events are stored in the `ami_events` table with `is_active` flag
- In demo mode, deterministic values are used (no random noise applied)
- KPI validation runs automatically after each publish in demo mode
- Before/after snapshots are captured for comparison when events are injected

## Automatic KPI Validation

When demo mode is enabled:
1. Injecting an event captures a "before" KPI snapshot
2. Publishing reads triggers automatic validation
3. The system compares before/after snapshots
4. Warnings are logged if no KPI movement is detected

This ensures demos are repeatable and events have visible impact on KPIs.

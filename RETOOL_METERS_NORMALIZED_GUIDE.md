# GridLens metersNormalized Transformer - Field Normalization Guide

## 🎯 PURPOSE

The `metersNormalized` transformer provides a **critical foundation layer** for all V3 components by handling varying field naming conventions across different data sources gracefully.

**Time to implement:** 2 minutes  
**Impact:** Eliminates errors from missing/renamed fields across entire dashboard

---

## ⚠️ WHY THIS MATTERS

### Problem Without Normalization:
```javascript
// Different APIs might return any of these:
meter.meterId          vs  meter.meter_id  vs  meter.id
meter.utilityName      vs  meter.utility    vs  meter.system
meter.score            vs  meter.healthScore vs meter.meterHealthIndex
meter.trend            vs  meter.usageTrend vs  meter.healthTrend
meter.lat              vs  meter.latitude
meter.lng              vs  meter.lon         vs  meter.longitude
```

**Result:** Component failures, undefined errors, broken charts

### Solution: Single Normalized Structure
```javascript
// metersNormalized always returns consistent fields:
{
  meterId: "MTR-1001",      // Always present
  utility: "Mississippi Power",
  score: 85,
  band: "good",
  issues: [...],
  trend: [...],
  lat: 34.76,
  lng: -89.67
}
```

**Result:** All components work reliably regardless of API field names

---

## 🔧 TRANSFORMER CODE

**Name:** `metersNormalized`

**Location:** Create AFTER `v3FilteredMeters`, BEFORE all other V3 transformers

**Code:**
```javascript
const meters =
  v3FilteredMeters.value ||
  filteredMetersByUtility.value ||
  IQOverview.data?.meters ||
  IQOverview.data?.atRiskMeters ||
  [];

return meters.map(m => ({
  // ID fields
  meterId: m.meterId ?? m.meter_id ?? m.id ?? "unknown",
  utility: m.utilityName ?? m.utility ?? m.system ?? "unknown",
  
  // Health fields
  score: m.score ?? m.healthScore ?? m.meterHealthIndex ?? null,
  band: m.band ?? m.healthBand ?? "healthy",
  
  // Issues/Anomalies
  issues: m.issues ?? m.flags ?? m.risks ?? [],
  anomalyScore: m.anomalyScore ?? m.anomaly_score ?? 0,
  
  // Trend data
  trend: m.trend ?? m.usageTrend ?? m.healthTrend ?? m.lastReads ?? m.reads ?? [],
  amiEvents: m.amiEvents ?? m.events ?? m.ami_events ?? [],
  billingFlags: m.billingFlags ?? m.flags ?? m.billing_flags ?? [],
  
  // Location
  lat: m.lat ?? m.latitude ?? null,
  lng: m.lng ?? m.lon ?? m.longitude ?? null,
  
  // Timestamp
  lastReadTs: m.lastReadTs ?? m.last_read_ts ?? m.lastSeen ?? null,
  
  // Preserve original for modal compatibility
  _original: m
}));
```

---

## 📊 FIELD MAPPING REFERENCE

| Normalized Field | Possible Source Fields | Default |
|------------------|------------------------|---------|
| `meterId` | meterId, meter_id, id | "unknown" |
| `utility` | utilityName, utility, system | "unknown" |
| `score` | score, healthScore, meterHealthIndex | null |
| `band` | band, healthBand | "healthy" |
| `issues` | issues, flags, risks | [] |
| `anomalyScore` | anomalyScore, anomaly_score | 0 |
| `trend` | trend, usageTrend, healthTrend, lastReads, reads | [] |
| `amiEvents` | amiEvents, events, ami_events | [] |
| `billingFlags` | billingFlags, flags, billing_flags | [] |
| `lat` | lat, latitude | null |
| `lng` | lng, lon, longitude | null |
| `lastReadTs` | lastReadTs, last_read_ts, lastSeen | null |
| `_original` | (full original object) | (original) |

---

## 🔗 UPDATE V3 TRANSFORMERS

After creating `metersNormalized`, update these transformers to use it:

### 1. Update `utilityTrendSeries`

**CHANGE FROM:**
```javascript
const meters = v3FilteredMeters.value || [];
```

**CHANGE TO:**
```javascript
const meters = metersNormalized.value || [];
```

**Also simplify field access:**
```javascript
// OLD (brittle):
const trendData = m.trend || m.usageTrend || m.healthTrend || m.lastReads || m.reads || [];
meterId: m.meterId ?? m.meter_id

// NEW (reliable):
const trendData = m.trend || [];
meterId: m.meterId
```

---

### 2. Update `v3MapMarkers`

**CHANGE FROM:**
```javascript
const meters = v3FilteredMeters.value || [];
return meters.filter(m => {
  const lat = m.lat ?? m.latitude;
  const lng = m.lng ?? m.lon ?? m.longitude;
  return lat && lng;
})
```

**CHANGE TO:**
```javascript
const meters = metersNormalized.value || [];
return meters.filter(m => m.lat && m.lng)
```

**Also update marker data:**
```javascript
// OLD:
meterData: m

// NEW (preserves original for modal):
meterData: m._original || m
```

---

### 3. Update `v3Anomalies`

**CHANGE FROM:**
```javascript
const meters = v3FilteredMeters.value || [];
const trendData = m.trend || m.usageTrend || m.lastReads || m.reads || [];
const issuesCount = (m.issues || []).length;
const band = (m.band || "").toLowerCase();
```

**CHANGE TO:**
```javascript
const meters = metersNormalized.value || [];
const trendData = m.trend || [];
const issuesCount = m.issues.length;
const band = m.band.toLowerCase();
```

---

### 4. Update Text/Helper Components

**Any component referencing meter count:**

**CHANGE FROM:**
```javascript
{{ v3FilteredMeters.value.length }}
```

**CHANGE TO:**
```javascript
{{ metersNormalized.value.length }}
```

---

## ✅ BENEFITS

### 1. Graceful API Evolution
- API field names can change without breaking dashboard
- Supports multiple API versions simultaneously
- Future-proof against backend updates

### 2. Error Prevention
- No undefined field access errors
- No null/undefined propagation
- Consistent default values

### 3. Simplified Component Code
- Less defensive coding needed
- Cleaner, more readable transformers
- Faster development

### 4. Modal Compatibility
- `_original` field preserves full object
- Modal can access any legacy fields
- Backward compatibility maintained

---

## 🧪 TESTING

After implementing, verify:

```
☐ utilityTrendSeries chart displays data
☐ v3MapMarkers renders markers correctly
☐ v3Anomalies detects issues properly
☐ No console errors about undefined fields
☐ Helper text shows correct meter counts
☐ Map click opens modal with correct data
☐ Table row click opens modal successfully
```

---

## 🔧 TROUBLESHOOTING

**Issue: Empty normalized array**
→ Check that v3FilteredMeters has data
→ Verify fallback chain (v3FilteredMeters → filteredMetersByUtility → IQOverview)

**Issue: Fields still showing "unknown"**
→ Check source data field names
→ Add additional fallback field names to transformer

**Issue: Modal doesn't work after normalization**
→ Ensure map marker uses `meterData: m._original || m`
→ Verify selectedMeter gets the `_original` field

**Issue: Charts/tables show wrong data**
→ Verify all V3 components use `metersNormalized.value`
→ Check that no components still reference `v3FilteredMeters` directly

---

## 📐 DATA FLOW

```
IQOverview (base query)
    ↓
utilitySelect (filter by utility)
    ↓
filteredMetersByUtility
    ↓
v3FilteredMeters (apply V3 filters)
    ↓
⭐ metersNormalized (NORMALIZE FIELDS) ⭐
    ↓
┌───────────────┬──────────────┬────────────┐
│               │              │            │
utilityTrendSeries  v3MapMarkers  v3Anomalies
v3Insights          (all V3 transformers use normalized data)
```

---

## 🎯 IMPLEMENTATION CHECKLIST

```
☐ 1. Create metersNormalized transformer (2 min)
☐ 2. Update utilityTrendSeries to use metersNormalized
☐ 3. Update v3MapMarkers to use metersNormalized
☐ 4. Update v3Anomalies to use metersNormalized
☐ 5. Update helper text components
☐ 6. Test all V3 charts and tables
☐ 7. Test modal click-through from map/tables
☐ 8. Verify no console errors
```

**Total time:** ~5 minutes for implementation + testing

---

## 💡 BEST PRACTICES

**DO:**
- ✅ Use `metersNormalized.value` for all new V3 components
- ✅ Access fields directly (e.g., `m.meterId` not `m.meterId ?? m.meter_id`)
- ✅ Rely on defaults (e.g., `m.issues` is always an array)
- ✅ Use `m._original` for modal compatibility

**DON'T:**
- ❌ Add defensive `??` checks in V3 transformers (already handled)
- ❌ Access raw `v3FilteredMeters` in new V3 components
- ❌ Assume specific field names from API
- ❌ Skip the normalization layer

---

## 🚀 RESULT

**Before normalization:**
```javascript
// Brittle code everywhere:
const id = m.meterId ?? m.meter_id ?? m.id ?? "unknown";
const trend = m.trend || m.usageTrend || m.healthTrend || [];
const lat = m.lat ?? m.latitude;
// Errors when API changes field names ❌
```

**After normalization:**
```javascript
// Clean, reliable code:
const id = m.meterId;
const trend = m.trend || [];
const lat = m.lat;
// Works regardless of API field names ✅
```

---

*Field Normalization Guide for GridLens Smart MeterIQ Dashboard - V3*

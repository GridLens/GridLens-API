# GridLens Utility Analytics - Quick Reference Card

## 🎯 WHAT YOU'RE ADDING

**7 New Transformers + 15+ New Components**

Add fleet-wide analytics WITHOUT touching modal system.

**Time:** ~30 minutes

---

## 🔧 7 TRANSFORMERS (Copy-Paste Ready)

### 1. `utilitiesList`
```javascript
const buckets = IQOverview.data?.riskMap?.buckets || [];
const fromBuckets = buckets.map(b => b.utilityName ?? b.utility ?? b.name).filter(Boolean);
const fromMeters = (IQOverview.data?.meters || []).map(m => m.utilityName ?? m.utility).filter(Boolean);
const list = [...new Set([...fromBuckets, ...fromMeters])];
if (list.length === 0) {
  const cities = buckets.map(b => b.key).filter(Boolean);
  if (cities.length) return ["All", ...cities];
  return ["All"];
}
return ["All", ...list];
```

### 2. `filteredMetersByUtility`
```javascript
const meters = IQOverview.data?.meters || [];
const selected = utilitySelect.value;
if (!selected || selected === "All") return meters;
return meters.filter(m => (m.utilityName ?? m.utility ?? "") === selected);
```

### 3. `utilityHealthScore`
```javascript
const meters = filteredMetersByUtility.value || [];
if (!meters.length) return { avgScore: 0, critical: 0, warning: 0, healthy: 0, total: 0 };
let sum=0, critical=0, warning=0, healthy=0;
meters.forEach(m=>{
  const s = m.score ?? 100;
  sum += s;
  const band = (m.band || "").toLowerCase();
  if (band==="critical" || s<50) critical++;
  else if (band==="poor" || band==="warning" || band==="fair" || (s>=50 && s<80)) warning++;
  else healthy++;
});
return { avgScore: +(sum/meters.length).toFixed(1), critical, warning, healthy, total: meters.length };
```

### 4. `utilityAmiSummary`
```javascript
const meters = filteredMetersByUtility.value || [];
let deadRadios=0, commFails=0, noEvents=0;
meters.forEach(m=>{
  const issues = (m.issues || []).map(i => (i.code || i.msg || i).toLowerCase());
  if (issues.some(i => i.includes("dead") || i.includes("radio"))) deadRadios++;
  if (issues.some(i => i.includes("comm") || i.includes("communication"))) commFails++;
  if (issues.some(i => i.includes("no_event") || i.includes("no event"))) noEvents++;
});
return { deadRadios, commFails, noEvents };
```

### 5. `utilityBillingSummary`
```javascript
const meters = filteredMetersByUtility.value || [];
let spike=0, gaps=0, flatline=0, reverse=0, missing=0;
meters.forEach(m=>{
  const issues = (m.issues || []).map(i => (i.code || i.msg || i).toLowerCase());
  if (issues.some(i => i.includes("spike"))) spike++;
  if (issues.some(i => i.includes("gap") || i.includes("missing"))) gaps++;
  if (issues.some(i => i.includes("flatline") || i.includes("stuck"))) flatline++;
  if (issues.some(i => i.includes("reverse"))) reverse++;
  if (issues.some(i => i.includes("negative"))) missing++;
});
return { spike, gaps, flatline, reverse, missing };
```

### 6. `worst10HealthByUtility`
```javascript
const meters = filteredMetersByUtility.value || [];
return [...meters].sort((a,b)=>(a.score??999)-(b.score??999)).slice(0,10);
```

### 7. `worst10BillingByUtility`
```javascript
const meters = filteredMetersByUtility.value || [];
return [...meters].sort((a,b)=>(b.flagCount??b.flags?.length??0)-(a.flagCount??a.flags?.length??0)).slice(0,10);
```

### 8. `mapMeters` (Bonus)
```javascript
const meters = filteredMetersByUtility.value || [];
return meters.filter(m => (m.lat ?? m.latitude) && (m.lng ?? m.lon ?? m.longitude))
  .map(m => ({
    id: m.meterId ?? m.meter_id,
    lat: m.lat ?? m.latitude,
    lng: m.lng ?? m.lon ?? m.longitude,
    band: m.band ?? "unknown",
    score: m.score ?? null,
    title: `${m.meterId ?? m.meter_id} (${m.band ?? 'N/A'})`,
    color: {"critical": "#ff4444", "poor": "#ff7744", "fair": "#ffaa00", "good": "#00ff88", "excellent": "#00ffff"}[(m.band || "").toLowerCase()] || "#94a3b8"
  }));
```

---

## 📊 COMPONENTS TO ADD

### Utility Selector
- **Component:** Select dropdown
- **Name:** `utilitySelect`
- **Data:** `{{ utilitiesList.value }}`
- **Default:** `{{ utilitiesList.value[0] }}`

### Utility KPI Row (Container with 4 cards)
- **Container:** `utilityKpiRow` (Horizontal layout)
- **Card 1:** `utilityAvgScoreCard` → `{{ utilityHealthScore.value.avgScore }}`
- **Card 2:** `utilityCriticalCard` → `{{ utilityHealthScore.value.critical }}`
- **Card 3:** `utilityWarningCard` → `{{ utilityHealthScore.value.warning }}`
- **Card 4:** `utilityHealthyCard` → `{{ utilityHealthScore.value.healthy }}`

### AMI Communications Panel (Container with 3 cards)
- **Container:** `amiCommsPanel` (Horizontal layout)
- **Card 1:** `deadRadiosCard` → `{{ utilityAmiSummary.value.deadRadios }}`
- **Card 2:** `commFailsCard` → `{{ utilityAmiSummary.value.commFails }}`
- **Card 3:** `noEventsCard` → `{{ utilityAmiSummary.value.noEvents }}`

### Billing Integrity Panel (Container with 5 cards)
- **Container:** `billingIntegrityPanel` (Horizontal layout)
- **Card 1:** `spikeCard` → `{{ utilityBillingSummary.value.spike }}`
- **Card 2:** `gapsCard` → `{{ utilityBillingSummary.value.gaps }}`
- **Card 3:** `flatlineCard` → `{{ utilityBillingSummary.value.flatline }}`
- **Card 4:** `reverseCard` → `{{ utilityBillingSummary.value.reverse }}`
- **Card 5:** `missingCard` → `{{ utilityBillingSummary.value.missing }}`

### Geo Map
- **Component:** Map
- **Name:** `utilityMetersMap`
- **Data:** `{{ mapMeters.value }}`
- **Lat field:** `lat`
- **Lng field:** `lng`
- **Color field:** `color`

---

## 🔗 KEY BINDINGS TO UPDATE

### If Worst-10 Tables Exist:
```javascript
// worst10HealthTable
OLD: {{ worst10Health.value }}
NEW: {{ worst10HealthByUtility.value }}

// worst10BillingTable
OLD: {{ worst10Billing.value }}
NEW: {{ worst10BillingByUtility.value }}
```

### Optional: Update Charts
```javascript
// Create alias transformer
metersForCharts = filteredMetersByUtility.value || [];

// Then update charts from:
{{ IQOverview.data.meters }}
// To:
{{ metersForCharts.value }}
```

---

## 🎨 STYLING (Dark Theme)

```javascript
// Containers
Background: #1e293b
Border: 1px solid #334155
Padding: 15px

// KPI Cards
Critical: #ff4444 on #2d1b1b
Warning: #ffaa00 on #2d2416
Healthy: #00ff88 on #1b2d1b
Neutral: #60a5fa on #1e293b

// Text
Headers: #60a5fa
Body: #e2e8f0
Muted: #94a3b8
```

---

## ✅ QUICK IMPLEMENTATION STEPS

1. **Add utility selector** (5 min) - Dropdown at top
2. **Add KPI row** (7 min) - 4 stat cards
3. **Add AMI panel** (5 min) - 3 stat cards  
4. **Add billing panel** (5 min) - 5 stat cards
5. **Update worst-10** (3 min) - Rebind data
6. **Add map** (5 min) - Map component + empty state
7. **Optional: Update charts** (2 min) - Alias data

**Total:** ~30 minutes

---

## 🎯 WHAT STAYS UNTOUCHED

✅ meterDetailsModal - completely untouched  
✅ All 5 modal tabs - untouched  
✅ Row click handlers - untouched  
✅ Existing component positions - untouched  

**Only additions, no deletions!**

---

## 📐 LAYOUT STRUCTURE

```
Dashboard Layout:
├─ Utility Selector (dropdown)
├─ Utility KPI Row (4 cards)
├─ AMI Communications Panel (3 cards)
├─ Billing Integrity Panel (5 cards)
├─ Geo Map (with empty state)
├─ Worst-10 Health Table (rebind data)
└─ Worst-10 Billing Table (rebind data)
```

---

## 🧪 TESTING CHECKLIST

```
☐ Select utility → all panels update
☐ Select "All" → shows all meters
☐ KPIs show correct totals
☐ AMI panel shows comm issues
☐ Billing panel shows risks
☐ Map shows markers (or empty state)
☐ Worst-10 tables filter correctly
☐ Charts update (if Step 7 done)
```

---

## 🐛 COMMON ISSUES

**Empty dropdown:**
→ Normal if no utility field in data; shows cities instead

**All counts are 0:**
→ Check filteredMetersByUtility has data

**Map is blank:**
→ Expected if no GPS data; empty state should display

**Worst-10 unchanged:**
→ Verify data binding update to new transformers

---

## ⏱️ TIME ESTIMATES

| Component | Time |
|-----------|------|
| Selector + transformers | 5 min |
| KPI row | 7 min |
| AMI panel | 5 min |
| Billing panel | 5 min |
| Worst-10 update | 3 min |
| Map | 5 min |
| Charts (optional) | 2 min |
| **Total** | **~30 min** |

---

## 🎉 FINAL RESULT

**Before:**
- Meter-level dashboard only

**After:**
- Fleet-wide utility analytics
- Selectable utility filtering
- AMI diagnostics
- Billing integrity monitoring
- Geographic visualization
- Executive-ready KPIs

**Value:** Transform from operational tool → executive command center!

---

*Quick Reference for Utility Analytics - GridLens Smart MeterIQ*

# GridLens Utility-Wide Analytics - Visual Implementation Guide

## 🎯 GOAL: Add Fleet-Level Analytics Dashboard

**⚠️ SCOPE:** Add NEW utility-wide analytics components only. **No changes to modal system or existing components.**

**Time Estimate:** 25-30 minutes

---

## 📊 WHAT YOU'RE ADDING

Transform your dashboard from meter-focused → **Utility-wide command center**

### NEW FEATURES:

```
┌──────────────────────────────────────────────────┐
│ [Utility: Mississippi Power ▼]  ← NEW SELECTOR  │
├──────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐             │
│ │Health│ │Critic│ │Warn. │ │Healty│  ← NEW KPIs │
│ │ 76.7 │ │  2   │ │  5   │ │  18  │             │
│ └──────┘ └──────┘ └──────┘ └──────┘             │
├──────────────────────────────────────────────────┤
│ AMI Communications      Billing Integrity        │
│ ┌─────┬─────┬──────┐   ┌─────┬─────┬──────┐    │
│ │Dead │Comm │No    │   │Spike│Gaps │Flat  │    │
│ │  3  │  5  │Events│   │  2  │  4  │  1   │    │
│ └─────┴─────┴──────┘   └─────┴─────┴──────┘    │
├──────────────────────────────────────────────────┤
│ [MAP: Meters by Location]  ← NEW MAP            │
│ ┌────────────────────────────────────────┐      │
│ │  🟢 Holly Springs                      │      │
│ │     🔴 Byhalia                         │      │
│ │        🟡 Southaven                    │      │
│ └────────────────────────────────────────┘      │
└──────────────────────────────────────────────────┘
```

---

## ✅ PRE-FLIGHT CHECK

Verify these exist:
- [ ] `IQOverview` query
- [ ] Existing dashboard with charts/tables
- [ ] `meterDetailsModal` (untouched in this guide)

---

## 🚀 IMPLEMENTATION

### **STEP 1: Create Utility Selector (5 min)**

#### 1.1: Create Utilities List Transformer

**CLICK:** Code → + New → Transformer

**Name:** `utilitiesList`

**Code:**
```javascript
const buckets = IQOverview.data?.riskMap?.buckets || [];
const fromBuckets = buckets.map(b => 
  b.utilityName ?? b.utility ?? b.name
).filter(Boolean);

const fromMeters = (IQOverview.data?.meters || []).map(m => 
  m.utilityName ?? m.utility
).filter(Boolean);

const list = [...new Set([...fromBuckets, ...fromMeters])];

// If no utilities found, infer from city or use "All"
if (list.length === 0) {
  const cities = buckets.map(b => b.key).filter(Boolean);
  if (cities.length) return ["All", ...cities];
  return ["All"];
}

return ["All", ...list];
```

---

#### 1.2: Add Dropdown Component

**CLICK:** Components → Select → Drag to top of dashboard (near header)

**Inspector:**
```
┌─────────────────────────────┐
│ Select                      │
├─────────────────────────────┤
│ Name: [utilitySelect      ] │
│                             │
│ Label: [Utility           ] │
│                             │
│ Values:                     │
│ {{ utilitiesList.value }}   │
│                             │
│ Default value:              │
│ {{ utilitiesList.value[0] }}│
│                             │
│ Style: Dark theme           │
│ Width: 200px                │
└─────────────────────────────┘
```

**Visual placement:**
```
┌────────────────────────────────────┐
│ GridLens Header                    │
│ [Utility: All ▼]  ← Add here       │
├────────────────────────────────────┤
│ Rest of dashboard...               │
```

---

#### 1.3: Create Filtered Meters Transformer

**Name:** `filteredMetersByUtility`

**Code:**
```javascript
const meters = IQOverview.data?.meters || [];
const selected = utilitySelect.value;

// If "All" or no selection, return all meters
if (!selected || selected === "All") {
  return meters;
}

// Filter by utility name
return meters.filter(m => {
  const utility = m.utilityName ?? m.utility ?? "";
  return utility === selected;
});
```

---

### **STEP 2: Utility Health Score KPIs (7 min)**

#### 2.1: Create Health Score Transformer

**Name:** `utilityHealthScore`

**Code:**
```javascript
const meters = filteredMetersByUtility.value || [];

if (!meters.length) {
  return { 
    avgScore: 0, 
    critical: 0, 
    warning: 0, 
    healthy: 0, 
    total: 0 
  };
}

let sum = 0;
let critical = 0;
let warning = 0;
let healthy = 0;

meters.forEach(m => {
  const score = m.score ?? 100;
  sum += score;
  
  const band = (m.band || "").toLowerCase();
  
  if (band === "critical" || score < 50) {
    critical++;
  } else if (band === "poor" || band === "warning" || band === "fair" || (score >= 50 && score < 80)) {
    warning++;
  } else {
    healthy++;
  }
});

return {
  avgScore: +(sum / meters.length).toFixed(1),
  critical,
  warning,
  healthy,
  total: meters.length
};
```

---

#### 2.2: Create KPI Container

**CLICK:** Components → Container → Drag below utility selector

**Inspector:**
```
Name: utilityKpiRow
Layout: Horizontal
Distribution: Space evenly
Padding: 15px
Gap: 10px
Background: #1e293b
```

---

#### 2.3: Add 4 Stat Cards Inside Container

**Inside `utilityKpiRow`, add 4 Statistic components:**

**Card 1: Average Health Score**
```
┌─────────────────────────────┐
│ Statistic                   │
├─────────────────────────────┤
│ Name: [utilityAvgScoreCard] │
│                             │
│ Label: [Utility Health    ] │
│                             │
│ Value:                      │
│ {{ utilityHealthScore.value.│
│    avgScore }}              │
│                             │
│ Suffix: [/ 100            ] │
│                             │
│ Color: [#60a5fa           ] │
│ Background: [#1e293b      ] │
└─────────────────────────────┘
```

**Card 2: Critical Meters**
```
Name: utilityCriticalCard
Label: Critical Meters
Value: {{ utilityHealthScore.value.critical }}
Color: #ff4444
Background: #2d1b1b
```

**Card 3: Warning Meters**
```
Name: utilityWarningCard
Label: Warning Meters
Value: {{ utilityHealthScore.value.warning }}
Color: #ffaa00
Background: #2d2416
```

**Card 4: Healthy Meters**
```
Name: utilityHealthyCard
Label: Healthy Meters
Value: {{ utilityHealthScore.value.healthy }}
Color: #00ff88
Background: #1b2d1b
```

**Visual result:**
```
┌─────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │ Utility  │ │ Critical │ │ Warning  │     │
│ │ Health   │ │ Meters   │ │ Meters   │     │
│ │  76.7    │ │    2     │ │    5     │ ... │
│ └──────────┘ └──────────┘ └──────────┘     │
└─────────────────────────────────────────────┘
```

---

### **STEP 3: AMI Communications Panel (5 min)**

#### 3.1: Create AMI Summary Transformer

**Name:** `utilityAmiSummary`

**Code:**
```javascript
const meters = filteredMetersByUtility.value || [];

let deadRadios = 0;
let commFails = 0;
let noEvents = 0;

meters.forEach(m => {
  const issues = (m.issues || []).map(i => 
    (i.code || i.msg || i).toLowerCase()
  );
  
  // Check for dead radio issues
  if (issues.some(i => i.includes("dead") || i.includes("radio"))) {
    deadRadios++;
  }
  
  // Check for communication failures
  if (issues.some(i => i.includes("comm") || i.includes("communication"))) {
    commFails++;
  }
  
  // Check for no events
  if (issues.some(i => i.includes("no_event") || i.includes("no event"))) {
    noEvents++;
  }
});

return { deadRadios, commFails, noEvents };
```

---

#### 3.2: Create AMI Panel Container

**CLICK:** Components → Container → Drag below KPI row

**Inspector:**
```
Name: amiCommsPanel
Title: AMI Communications
Layout: Horizontal
Padding: 15px
Background: #1e293b
Border: 1px solid #334155
```

---

#### 3.3: Add 3 Stat Cards Inside

**Card 1: Dead Radios**
```
Name: deadRadiosCard
Label: Dead Radios
Value: {{ utilityAmiSummary.value.deadRadios }}
Icon: signal-slash
Color: #ff4444
```

**Card 2: Comm Failures**
```
Name: commFailsCard
Label: Comm Failures
Value: {{ utilityAmiSummary.value.commFails }}
Icon: wifi-slash
Color: #ffaa00
```

**Card 3: No Events**
```
Name: noEventsCard
Label: No Events
Value: {{ utilityAmiSummary.value.noEvents }}
Icon: circle-minus
Color: #94a3b8
```

---

### **STEP 4: Billing Diagnostics Panel (5 min)**

#### 4.1: Create Billing Summary Transformer

**Name:** `utilityBillingSummary`

**Code:**
```javascript
const meters = filteredMetersByUtility.value || [];

let spike = 0;
let gaps = 0;
let flatline = 0;
let reverse = 0;
let missing = 0;

meters.forEach(m => {
  const issues = (m.issues || []).map(i => 
    (i.code || i.msg || i).toLowerCase()
  );
  
  if (issues.some(i => i.includes("spike"))) spike++;
  if (issues.some(i => i.includes("gap") || i.includes("missing"))) gaps++;
  if (issues.some(i => i.includes("flatline") || i.includes("stuck"))) flatline++;
  if (issues.some(i => i.includes("reverse"))) reverse++;
  if (issues.some(i => i.includes("negative"))) missing++;
});

return { spike, gaps, flatline, reverse, missing };
```

---

#### 4.2: Create Billing Panel Container

**CLICK:** Components → Container → Drag below AMI panel

**Inspector:**
```
Name: billingIntegrityPanel
Title: Billing Integrity
Layout: Horizontal
Padding: 15px
Background: #1e293b
Border: 1px solid #334155
```

---

#### 4.3: Add 5 Stat Cards Inside

**Card 1: Usage Spikes**
```
Name: spikeCard
Label: Usage Spikes
Value: {{ utilityBillingSummary.value.spike }}
Color: #ff4444
```

**Card 2: Read Gaps**
```
Name: gapsCard
Label: Read Gaps
Value: {{ utilityBillingSummary.value.gaps }}
Color: #ffaa00
```

**Card 3: Flatline Usage**
```
Name: flatlineCard
Label: Flatline Usage
Value: {{ utilityBillingSummary.value.flatline }}
Color: #ffaa00
```

**Card 4: Reversed Meters**
```
Name: reverseCard
Label: Reversed Meters
Value: {{ utilityBillingSummary.value.reverse }}
Color: #ff4444
```

**Card 5: Negative Reads**
```
Name: missingCard
Label: Negative Reads
Value: {{ utilityBillingSummary.value.missing }}
Color: #ff4444
```

**Visual result:**
```
┌────────────────────────────────────────────┐
│ AMI Communications                         │
│ ┌─────────┐ ┌─────────┐ ┌────────┐        │
│ │Dead: 3  │ │Comm: 5  │ │NoEv: 2 │        │
│ └─────────┘ └─────────┘ └────────┘        │
└────────────────────────────────────────────┘
┌────────────────────────────────────────────┐
│ Billing Integrity                          │
│ ┌─────┐ ┌─────┐ ┌────┐ ┌─────┐ ┌─────┐   │
│ │Spike│ │Gaps │ │Flat│ │Rev. │ │Neg. │   │
│ │  2  │ │  4  │ │ 1  │ │  0  │ │  1  │   │
│ └─────┘ └─────┘ └────┘ └─────┘ └─────┘   │
└────────────────────────────────────────────┘
```

---

### **STEP 5: Update Worst-10 Tables (3 min)**

#### 5.1: Create Utility-Filtered Transformers

**Transformer 1:**

**Name:** `worst10HealthByUtility`

**Code:**
```javascript
const meters = filteredMetersByUtility.value || [];

return [...meters]
  .sort((a, b) => (a.score ?? 999) - (b.score ?? 999))
  .slice(0, 10);
```

**Transformer 2:**

**Name:** `worst10BillingByUtility`

**Code:**
```javascript
const meters = filteredMetersByUtility.value || [];

return [...meters]
  .sort((a, b) => 
    (b.flagCount ?? b.flags?.length ?? 0) - 
    (a.flagCount ?? a.flags?.length ?? 0)
  )
  .slice(0, 10);
```

---

#### 5.2: Update Existing Tables (if they exist)

**FIND:** `worst10HealthTable` in component tree

**IF FOUND:**
```
CLICK: worst10HealthTable
Inspector → Data:
CHANGE FROM: {{ worst10Health.value }}
CHANGE TO:   {{ worst10HealthByUtility.value }}
```

**FIND:** `worst10BillingTable`

**IF FOUND:**
```
CLICK: worst10BillingTable
Inspector → Data:
CHANGE FROM: {{ worst10Billing.value }}
CHANGE TO:   {{ worst10BillingByUtility.value }}
```

**IF NOT FOUND:** Tables will be created by following Feature 5 in main enhancement guide.

---

### **STEP 6: Add Geo Map Placeholder (5 min)**

#### 6.1: Create Map Data Transformer

**Name:** `mapMeters`

**Code:**
```javascript
const meters = filteredMetersByUtility.value || [];

// Filter meters that have location data
const withLocation = meters.filter(m => {
  const lat = m.lat ?? m.latitude;
  const lng = m.lng ?? m.lon ?? m.longitude;
  return lat && lng;
});

// Map to simple format for map component
return withLocation.map(m => ({
  id: m.meterId ?? m.meter_id,
  lat: m.lat ?? m.latitude,
  lng: m.lng ?? m.lon ?? m.longitude,
  band: m.band ?? "unknown",
  score: m.score ?? null,
  title: `${m.meterId ?? m.meter_id} (${m.band ?? 'N/A'})`,
  // Color based on band
  color: {
    "critical": "#ff4444",
    "poor": "#ff7744",
    "fair": "#ffaa00",
    "good": "#00ff88",
    "excellent": "#00ffff"
  }[(m.band || "").toLowerCase()] || "#94a3b8"
}));
```

---

#### 6.2: Add Map Component

**CLICK:** Components → Map → Drag below billing panel

**Inspector:**
```
┌─────────────────────────────┐
│ Map                         │
├─────────────────────────────┤
│ Name: [utilityMetersMap   ] │
│                             │
│ Data:                       │
│ {{ mapMeters.value }}       │
│                             │
│ Latitude field: [lat      ] │
│ Longitude field: [lng     ] │
│                             │
│ Marker color: [color      ] │
│ Marker title: [title      ] │
│                             │
│ Height: [400px            ] │
│ Zoom: [10                 ] │
└─────────────────────────────┘
```

---

#### 6.3: Add Empty State Helper

**Below map, add Text component:**

**Conditional display:**
```javascript
{{ 
  mapMeters.value.length === 0 
  ? "📍 GPS coordinates not available yet — map will auto-populate when lat/long fields are added to meter data." 
  : `Showing ${mapMeters.value.length} meters with GPS data`
}}
```

**Styling:**
```
Color: #94a3b8
Font style: Italic
Font size: 14px
Text align: Center
```

**Visual result (with data):**
```
┌────────────────────────────────────┐
│ Utility Meters Map                 │
│ ┌────────────────────────────────┐ │
│ │                                │ │
│ │  🟢 (Holly Springs)            │ │
│ │     🔴 (Byhalia)               │ │
│ │        🟡 (Southaven)          │ │
│ │                                │ │
│ └────────────────────────────────┘ │
│ Showing 3 meters with GPS data     │
└────────────────────────────────────┘
```

**Visual result (no data):**
```
┌────────────────────────────────────┐
│ Utility Meters Map                 │
│ ┌────────────────────────────────┐ │
│ │ [Empty map view]               │ │
│ └────────────────────────────────┘ │
│ 📍 GPS coordinates not available   │
│ yet — map will auto-populate       │
└────────────────────────────────────┘
```

---

### **STEP 7: Optional Chart Filtering (2 min)**

**ONLY if your existing charts use IQOverview.data.meters directly:**

#### Create Chart Data Alias

**Name:** `metersForCharts`

**Code:**
```javascript
// Simple alias to filteredMetersByUtility
return filteredMetersByUtility.value || [];
```

---

#### Update Chart Data Sources

**For each chart that shows meter data:**

**FIND:** Charts using `{{ IQOverview.data.meters }}`

**UPDATE to:** `{{ metersForCharts.value }}`

**Examples:**
- Health band chart
- Issue distribution chart
- Timeline charts

**⚠️ CAUTION:** Only change the data source, not the chart configuration!

---

## 📐 FINAL LAYOUT

Your dashboard should now have this structure:

```
┌──────────────────────────────────────────────────┐
│ GridLens Smart MeterIQ™ Dashboard                │
│ [Utility: Mississippi Power ▼]                   │
├──────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ Utility  │ │ Critical │ │ Warning  │ ...      │
│ │ Health   │ │ Meters   │ │ Meters   │          │
│ │  76.7    │ │    2     │ │    5     │          │
│ └──────────┘ └──────────┘ └──────────┘         │
├──────────────────────────────────────────────────┤
│ AMI Communications      Billing Integrity        │
│ ┌─────┬─────┬──────┐   ┌─────┬─────┬──────┐    │
│ │Dead │Comm │NoEvt │   │Spike│Gaps │Flat  │    │
│ │  3  │  5  │  2   │   │  2  │  4  │  1   │    │
│ └─────┴─────┴──────┘   └─────┴─────┴──────┘    │
├──────────────────────────────────────────────────┤
│ Utility Meters Map                               │
│ ┌────────────────────────────────────────┐      │
│ │  🟢 Holly Springs                      │      │
│ │     🔴 Byhalia                         │      │
│ └────────────────────────────────────────┘      │
├──────────────────────────────────────────────────┤
│ Worst 10 Health (filtered by utility)           │
│ (existing table - just rebind data)             │
├──────────────────────────────────────────────────┤
│ Worst 10 Billing (filtered by utility)          │
│ (existing table - just rebind data)             │
└──────────────────────────────────────────────────┘
```

---

## ✅ TESTING CHECKLIST

Test the new utility analytics:

```
☐ Utility dropdown shows list of utilities
☐ Select utility → KPIs update
☐ Select "All" → Shows all meters
☐ Health score card shows correct average
☐ Critical/Warning/Healthy counts match
☐ AMI panel shows communication issues
☐ Billing panel shows integrity issues
☐ Map shows meters (if GPS data available)
☐ Map shows empty state message (if no GPS)
☐ Worst-10 tables filter by selected utility
☐ Charts update when utility changes (if Step 7 done)
```

---

## 🎨 STYLING CONSISTENCY

All new components use dark theme:

```javascript
// Container backgrounds
Panel backgrounds: #1e293b
Card backgrounds: #1e293b

// Borders
Panel borders: 1px solid #334155

// Colors
Critical: #ff4444
Warning: #ffaa00
Healthy: #00ff88
Neutral: #60a5fa
Muted: #94a3b8

// Text
Headings: #60a5fa
Body: #e2e8f0
```

---

## 🔧 TROUBLESHOOTING

**Issue: Dropdown is empty**
→ Check utilitiesList transformer, may return ["All"] if no utilities found

**Issue: KPIs show 0**
→ Verify filteredMetersByUtility has data, check console

**Issue: Map is blank**
→ Expected if no GPS data; empty state should show

**Issue: Panels show wrong counts**
→ Check issue field names match your data (code vs msg vs issues array)

**Issue: Worst-10 tables unchanged**
→ Make sure you updated data binding to new transformers

---

## ⏱️ TIME BREAKDOWN

| Step | Feature | Time |
|------|---------|------|
| 1 | Utility Selector | 5 min |
| 2 | Health KPIs | 7 min |
| 3 | AMI Panel | 5 min |
| 4 | Billing Panel | 5 min |
| 5 | Update Worst-10 | 3 min |
| 6 | Geo Map | 5 min |
| 7 | Chart Filtering (optional) | 2 min |
| **Total** | | **~30 min** |

---

## ✅ WHAT YOU DIDN'T TOUCH

**Preserved components:**
- ✅ meterDetailsModal (untouched)
- ✅ All 5 modal tabs (untouched)
- ✅ Existing charts (only data source updated if Step 7)
- ✅ Existing tables (only data source updated)
- ✅ All row click handlers (untouched)

**Only additions made:**
- ✅ Utility selector dropdown
- ✅ 4 utility KPI cards
- ✅ AMI communications panel (3 cards)
- ✅ Billing integrity panel (5 cards)
- ✅ Geo map component
- ✅ 7 new transformers

---

## 🎉 YOU'RE DONE!

**What you added:**
- 🎯 Utility-level filtering across entire dashboard
- 📊 Fleet health scoring and breakdown
- 📡 AMI communications diagnostics
- 💰 Billing integrity monitoring
- 🗺️ Geographic visualization (when GPS available)

**Value delivered:**
- Executives can now see fleet-wide health at-a-glance
- Operations can identify systemic AMI issues
- Billing team can spot revenue protection risks
- Future-ready for GPS mapping

**Your dashboard is now a complete utility command center!** 🚀

---

*Utility Analytics Guide for GridLens Smart MeterIQ Dashboard*

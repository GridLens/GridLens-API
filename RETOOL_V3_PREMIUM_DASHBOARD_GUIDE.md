# GridLens V3 Premium Dashboard - Implementation Guide

## 🚀 GOAL: Upgrade to Enterprise-Grade Analytics Platform

**⚠️ CRITICAL RULES:**
- **DO NOT** delete or break existing components
- **DO NOT** modify existing transformers/bindings
- **ONLY ADD** V3 features safely
- Gracefully handle missing data fields

**Time Estimate:** 60-75 minutes

---

## 🎯 V3 FEATURES OVERVIEW

Transform your dashboard into a **premium analytics platform:**

```
V1/V2 Features (Preserved):
✅ Premium 5-tab modal
✅ Utility selector
✅ Health KPIs
✅ AMI/Billing panels
✅ Worst-10 tables
✅ Geo map

V3 NEW Features (Adding):
⭐ Advanced filter bar (date, band, issue, anomalies)
⭐ Interactive timeline analytics
⭐ Clustering map with band colors
⭐ AI anomaly detection engine
⭐ Work order management system
⭐ Executive PDF export
⭐ Auto-narrative insights pane
⭐ Universal click-to-investigate
```

---

## ✅ PRE-FLIGHT CHECK

Verify these exist before starting:

```
☐ IQOverview query
☐ utilitySelect dropdown
☐ filteredMetersByUtility transformer
☐ selectedMeterDetails transformer
☐ meterDetailsModal component
☐ Existing tables/charts from V1/V2
```

---

## 🚀 V3-1: GLOBAL FILTER BAR (15 min)

### STEP 1.1: Create Filter Bar Container

**CLICK:** Components → Container → Drag below utility selector

**Inspector:**
```
┌─────────────────────────────┐
│ Container                   │
├─────────────────────────────┤
│ Name: [v3FilterBar        ] │
│                             │
│ Layout: Horizontal          │
│ Wrap: Wrap                  │
│ Gap: 12px                   │
│ Padding: 15px               │
│                             │
│ Background: #1e293b         │
│ Border: 1px solid #334155   │
│ Border radius: 8px          │
│                             │
│ Margin: 16px 0              │
└─────────────────────────────┘
```

---

### STEP 1.2: Add Date Range Picker

**Inside v3FilterBar:**

**CLICK:** + → Date Range Picker

**Inspector:**
```
┌─────────────────────────────┐
│ Date Range Picker           │
├─────────────────────────────┤
│ Name: [v3DateRange        ] │
│                             │
│ Label: [Date Range        ] │
│                             │
│ Default value:              │
│ Start: {{ new Date(         │
│   Date.now() - 30*24*60*    │
│   60*1000).toISOString() }} │
│                             │
│ End: {{ new Date().         │
│   toISOString() }}          │
│                             │
│ Format: YYYY-MM-DD          │
└─────────────────────────────┘
```

---

### STEP 1.3: Add Band Multi-Select

**CLICK:** + → Multi-select

**Inspector:**
```
┌─────────────────────────────┐
│ Multi-select                │
├─────────────────────────────┤
│ Name: [v3BandFilter       ] │
│                             │
│ Label: [Health Band       ] │
│                             │
│ Values:                     │
│ ["Critical", "Warning",     │
│  "Fair", "Good",            │
│  "Excellent", "Healthy"]    │
│                             │
│ Default value:              │
│ ["Critical", "Warning",     │
│  "Fair", "Good",            │
│  "Excellent", "Healthy"]    │
│                             │
│ Allow select all: true      │
└─────────────────────────────┘
```

---

### STEP 1.4: Create Issue List Transformer

**CLICK:** Code → + New → Transformer

**Name:** `v3IssueList`

**Code:**
```javascript
const meters = filteredMetersByUtility.value || IQOverview.data?.meters || [];

// Extract all unique issues
const allIssues = meters.flatMap(m => {
  const issues = m.issues || [];
  return issues.map(i => {
    // Handle both object and string issues
    if (typeof i === 'string') return i;
    return i.code || i.msg || i.type || String(i);
  });
});

// Return unique, non-empty issues
return [...new Set(allIssues)].filter(Boolean).sort();
```

---

### STEP 1.5: Add Issue Multi-Select

**CLICK:** + → Multi-select

**Inspector:**
```
┌─────────────────────────────┐
│ Multi-select                │
├─────────────────────────────┤
│ Name: [v3IssueFilter      ] │
│                             │
│ Label: [Issues            ] │
│                             │
│ Values:                     │
│ {{ v3IssueList.value }}     │
│                             │
│ Default value: []           │
│ (empty = all)               │
│                             │
│ Allow select all: true      │
│ Placeholder: All issues     │
└─────────────────────────────┘
```

---

### STEP 1.6: Add Anomalies Toggle

**CLICK:** + → Toggle (or Checkbox)

**Inspector:**
```
┌─────────────────────────────┐
│ Toggle                      │
├─────────────────────────────┤
│ Name: [v3ShowOnlyAnomalies] │
│                             │
│ Label: [Anomalies Only    ] │
│                             │
│ Default value: false        │
└─────────────────────────────┘
```

---

### STEP 1.7: Create V3 Filtered Meters Transformer

**Name:** `v3FilteredMeters`

**Code:**
```javascript
const meters = filteredMetersByUtility.value || IQOverview.data?.meters || [];
const bandsSelected = (v3BandFilter.value || []).map(b => b.toLowerCase());
const issuesSelected = v3IssueFilter.value || [];
const showAnomaliesOnly = v3ShowOnlyAnomalies.value;

// Apply filters
let filtered = meters.filter(m => {
  // Band filter
  const band = (m.band || "healthy").toLowerCase();
  const bandMatch = !bandsSelected.length || bandsSelected.includes(band);
  
  // Issue filter
  const meterIssues = (m.issues || []).map(i => {
    if (typeof i === 'string') return i;
    return i.code || i.msg || i.type || String(i);
  });
  const issueMatch = !issuesSelected.length || 
    meterIssues.some(issue => issuesSelected.includes(issue));
  
  return bandMatch && issueMatch;
});

// Apply anomaly filter if enabled
if (showAnomaliesOnly) {
  filtered = filtered.filter(m => (m.anomalyScore ?? 0) > 0);
}

return filtered;
```

---

### STEP 1.8: Add Clear Filters Button

**Inside v3FilterBar:**

**CLICK:** + → Button

**Inspector:**
```
Text: Clear Filters
Style: Secondary
Size: Small

Event: Click
Actions:
1. Set temp state → v3BandFilter = ["Critical", "Warning", "Fair", "Good", "Excellent", "Healthy"]
2. Set temp state → v3IssueFilter = []
3. Set temp state → v3ShowOnlyAnomalies = false
```

---

## 📈 V3-2: UTILITY TIMELINE ANALYTICS (12 min)

### STEP 2.1: Create Timeline Data Transformer

**Name:** `utilityTrendSeries`

**Code:**
```javascript
const meters = v3FilteredMeters.value || [];

// Aggregate all trend points from all meters
const allPoints = meters.flatMap(m => {
  const trendData = 
    m.trend || 
    m.usageTrend || 
    m.healthTrend || 
    m.lastReads || 
    m.reads || 
    [];
  
  return trendData.map(point => ({
    ts: point.ts || point.timestamp || point.date,
    value: point.value ?? point.usage ?? point.score ?? point.kwh ?? point.gallons,
    type: point.type || m.type || "usage",
    meterId: m.meterId ?? m.meter_id
  }));
});

// Filter valid points and sort by timestamp
return allPoints
  .filter(p => p.ts && p.value !== null && p.value !== undefined)
  .sort((a, b) => new Date(a.ts) - new Date(b.ts));
```

---

### STEP 2.2: Add Timeline Chart

**CLICK:** Components → Chart → Line Chart

**Inspector:**
```
┌─────────────────────────────┐
│ Line Chart                  │
├─────────────────────────────┤
│ Name: [utilityTrendChart  ] │
│                             │
│ Data:                       │
│ {{ utilityTrendSeries.value }}│
│                             │
│ X-axis: ts                  │
│ Y-axis: value               │
│                             │
│ Group by: type              │
│ (creates separate lines)    │
│                             │
│ Enable zoom: true           │
│ Show tooltip: true          │
│ Smooth line: true           │
│                             │
│ Height: 300px               │
│                             │
│ Title: Utility Timeline     │
│ Subtitle: Health + Usage    │
└─────────────────────────────┘
```

---

### STEP 2.3: Add Chart Helper Text

**Below chart:**

**CLICK:** + → Text

**Value:**
```html
<p style="color: #94a3b8; font-size: 12px; font-style: italic; text-align: center;">
  Trend reflects selected utility + active filters. 
  Showing {{ utilityTrendSeries.value.length }} data points from {{ v3FilteredMeters.value.length }} meters.
</p>
```

---

## 🗺️ V3-3: PREMIUM MAP WITH CLUSTERING (10 min)

### STEP 3.1: Create V3 Map Markers Transformer

**Name:** `v3MapMarkers`

**Code:**
```javascript
const meters = v3FilteredMeters.value || [];

return meters
  .filter(m => {
    const lat = m.lat ?? m.latitude;
    const lng = m.lng ?? m.lon ?? m.longitude;
    return lat && lng;
  })
  .map(m => {
    const band = (m.band || "healthy").toLowerCase();
    
    // Color mapping
    const colorMap = {
      "critical": "#ff4444",
      "poor": "#ff7744",
      "fair": "#ffaa00",
      "warning": "#ffaa00",
      "good": "#00ff88",
      "excellent": "#00ffff",
      "healthy": "#00ff88"
    };
    
    return {
      id: m.meterId ?? m.meter_id,
      lat: m.lat ?? m.latitude,
      lng: m.lng ?? m.lon ?? m.longitude,
      band: band,
      score: m.score ?? null,
      issues: m.issues || [],
      color: colorMap[band] || "#94a3b8",
      title: `${m.meterId ?? m.meter_id} - ${band} (${m.score ?? "N/A"})`,
      // Store full meter data for click handler
      meterData: m
    };
  });
```

---

### STEP 3.2: Update Map Component

**FIND:** `utilityMetersMap` (or create new if doesn't exist)

**Inspector:**
```
┌─────────────────────────────┐
│ Map                         │
├─────────────────────────────┤
│ Name: [utilityMetersMap   ] │
│                             │
│ Data:                       │
│ {{ v3MapMarkers.value }}    │
│                             │
│ Latitude: lat               │
│ Longitude: lng              │
│                             │
│ Marker color: color         │
│ Marker title: title         │
│                             │
│ Enable clustering: true     │
│ Cluster max zoom: 15        │
│                             │
│ Height: 450px               │
│ Default zoom: 10            │
└─────────────────────────────┘
```

---

### STEP 3.3: Add Map Click Handler

**CLICK:** Map → Event Handlers

**Event:** Marker click

**Actions:**
```
Action 1: Set temp state
  Variable: selectedMeter
  Value: {{ utilityMetersMap.selectedMarker.meterData }}

Action 2: Control component
  Component: meterDetailsModal
  Method: open()
```

---

## 🤖 V3-4: AI ANOMALY DETECTION (15 min)

### STEP 4.1: Create Anomaly Detection Transformer

**Name:** `v3Anomalies`

**Code:**
```javascript
const meters = v3FilteredMeters.value || [];

// Helper: Calculate standard deviation
function stdev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

return meters.map(m => {
  // Extract numeric series from trend data
  const trendData = m.trend || m.usageTrend || m.lastReads || m.reads || [];
  const series = trendData
    .map(x => x.value ?? x.usage ?? x.score ?? x.kwh ?? x.gallons)
    .filter(n => typeof n === 'number' && !isNaN(n));
  
  let anomalyScore = 0;
  let reasons = [];
  
  // Analyze if we have enough data
  if (series.length >= 6) {
    const sd = stdev(series);
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const last = series[series.length - 1];
    
    // High volatility detection
    if (sd > mean * 0.6 && mean > 0) {
      anomalyScore += 2;
      reasons.push("High volatility");
    }
    
    // Extreme spike detection
    if (last > mean * 2 && mean > 0) {
      anomalyScore += 2;
      reasons.push("Extreme spike");
    }
    
    // Sudden drop/flatline detection
    if (last < mean * 0.2 && mean > 0) {
      anomalyScore += 2;
      reasons.push("Sudden drop/flatline");
    }
  }
  
  // Multiple issues penalty
  const issuesCount = (m.issues || []).length;
  if (issuesCount >= 2) {
    anomalyScore += 1;
    reasons.push(`${issuesCount} issues detected`);
  }
  
  // Critical health band penalty
  const band = (m.band || "").toLowerCase();
  if (band === "critical") {
    anomalyScore += 1;
    reasons.push("Critical health band");
  }
  
  // Determine severity
  let severity = "Normal";
  if (anomalyScore >= 4) severity = "Critical";
  else if (anomalyScore >= 2) severity = "Warning";
  
  return {
    meterId: m.meterId ?? m.meter_id,
    anomalyScore,
    severity,
    reason: reasons.join("; ") || "No anomalies",
    healthScore: m.score ?? null,
    band: m.band ?? "Unknown",
    issues: m.issues || [],
    utility: m.utilityName ?? m.utility ?? "N/A"
  };
}).filter(a => a.anomalyScore > 0) // Only return meters with anomalies
  .sort((a, b) => b.anomalyScore - a.anomalyScore); // Sort by severity
```

---

### STEP 4.2: Add Anomalies Table

**CLICK:** Components → Table

**Inspector:**
```
┌─────────────────────────────┐
│ Table                       │
├─────────────────────────────┤
│ Name: [v3AnomaliesTable   ] │
│                             │
│ Data:                       │
│ {{ v3Anomalies.value }}     │
│                             │
│ Columns:                    │
│ - meterId                   │
│ - anomalyScore              │
│ - severity                  │
│ - reason                    │
│ - healthScore               │
│ - band                      │
│                             │
│ Empty state:                │
│ "No anomalies detected"     │
│                             │
│ Page size: 10               │
└─────────────────────────────┘
```

---

### STEP 4.3: Add Table Click Handler

**CLICK:** v3AnomaliesTable → Event Handlers

**Event:** Row click

**Actions:**
```
Action 1: Set temp state
  Variable: selectedMeter
  Value: {{ currentRow }}

Action 2: Control component
  Component: meterDetailsModal
  Method: open()
```

---

### STEP 4.4: Add Anomalies KPI Card

**CLICK:** Components → Statistic

**Inspector:**
```
┌─────────────────────────────┐
│ Statistic                   │
├─────────────────────────────┤
│ Name: [anomaliesCountCard ] │
│                             │
│ Label: AI Anomalies         │
│                             │
│ Value:                      │
│ {{ v3Anomalies.value.length }}│
│                             │
│ Icon: alert-triangle        │
│ Color: #ff4444              │
│                             │
│ Tooltip: Meters with AI-    │
│ detected anomalies          │
└─────────────────────────────┘
```

---

## 📋 V3-5: WORKFLOW ENGINE (WORK ORDERS) (15 min)

### STEP 5.1: Create Work Orders State

**CLICK:** State → + New → Temporary state

**Inspector:**
```
┌─────────────────────────────┐
│ Temporary State             │
├─────────────────────────────┤
│ Name: [workOrders         ] │
│                             │
│ Initial value: []           │
│                             │
│ Type: Array                 │
└─────────────────────────────┘
```

---

### STEP 5.2: Add Create Work Order Button

**Multiple locations - add to:**
- Anomalies table (action column)
- Inside meterDetailsModal (Recommended Action tab)

**Button config:**
```
┌─────────────────────────────┐
│ Button                      │
├─────────────────────────────┤
│ Text: Create Work Order     │
│ Icon: clipboard             │
│ Style: Primary              │
│ Size: Small                 │
└─────────────────────────────┘
```

**Click event:**
```javascript
// Generate unique ID
const newId = `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Get meter details
const meter = selectedMeterDetails.value || currentRow;
const meterId = meter?.meterId ?? meter?.meter_id ?? "Unknown";

// Get priority from recommendation or severity
const priority = 
  recommendedAction.value?.priority ?? 
  (meter?.band === "critical" ? "Critical" : "Normal");

// Create work order object
const newWorkOrder = {
  id: newId,
  meterId: meterId,
  utility: utilitySelect.value,
  priority: priority,
  issues: meter?.issues || [],
  status: "Open",
  createdTs: new Date().toISOString(),
  createdBy: "Dashboard User",
  notes: ""
};

// Add to work orders array
workOrders.setValue([...(workOrders.value || []), newWorkOrder]);

// Show success notification
utils.showNotification({
  title: "Work Order Created",
  description: `Work order ${newId} created for ${meterId}`,
  type: "success",
  duration: 3
});
```

---

### STEP 5.3: Create Work Orders Table

**CLICK:** Components → Table

**Inspector:**
```
┌─────────────────────────────┐
│ Table                       │
├─────────────────────────────┤
│ Name: [workOrdersTable    ] │
│                             │
│ Data: {{ workOrders.value }}│
│                             │
│ Columns:                    │
│ - id                        │
│ - meterId                   │
│ - utility                   │
│ - priority                  │
│ - status (editable)         │
│ - issues                    │
│ - createdTs                 │
│ - createdBy                 │
└─────────────────────────────┘
```

---

### STEP 5.4: Make Status Column Editable

**CLICK:** workOrdersTable → Column: status

**Make editable:** Yes

**Cell type:** Select

**Options:**
```
["Open", "In Progress", "Resolved", "Deferred", "Cancelled"]
```

**On change event:**
```javascript
// Update the work order in the array
const updated = workOrders.value.map(wo => {
  if (wo.id === currentRow.id) {
    return { ...wo, status: newValue };
  }
  return wo;
});

workOrders.setValue(updated);
```

---

### STEP 5.5: Add Work Orders Section Header

**Before table:**

**Text component:**
```html
<h2 style="color: #60a5fa; font-size: 18px; font-weight: 600; margin: 20px 0 10px 0;">
  📋 Work Orders
</h2>
<p style="color: #94a3b8; font-size: 14px;">
  {{ workOrders.value.length }} active work orders
</p>
```

---

## 📄 V3-6: EXECUTIVE PDF EXPORT (8 min)

### STEP 6.1: Create Executive Report Builder

**CLICK:** Code → + New → JavaScript Query

**Name:** `buildExecutiveReport`

**Code:**
```javascript
const utility = utilitySelect.value || "All";
const kpi = utilityHealthScore.value || {};
const ami = utilityAmiSummary.value || {};
const billing = utilityBillingSummary.value || {};
const anomalies = v3Anomalies.value.slice(0, 10);
const workOrdersSummary = workOrders.value || [];

// Build comprehensive report
const report = {
  title: "GridLens Smart MeterIQ™ Executive Summary",
  utility: utility,
  generatedTimestamp: new Date().toISOString(),
  generatedBy: "GridLens Dashboard",
  
  executiveSummary: {
    utilityHealthScore: kpi.avgScore || 0,
    totalMeters: kpi.total || 0,
    criticalMeters: kpi.critical || 0,
    warningMeters: kpi.warning || 0,
    healthyMeters: kpi.healthy || 0
  },
  
  amiCommunications: {
    deadRadios: ami.deadRadios || 0,
    communicationFailures: ami.commFails || 0,
    noEvents: ami.noEvents || 0
  },
  
  billingIntegrity: {
    usageSpikes: billing.spike || 0,
    readGaps: billing.gaps || 0,
    flatlineMeters: billing.flatline || 0,
    reversedMeters: billing.reverse || 0,
    negativeReads: billing.missing || 0
  },
  
  topAnomalies: anomalies.map(a => ({
    meterId: a.meterId,
    severity: a.severity,
    anomalyScore: a.anomalyScore,
    reason: a.reason
  })),
  
  workOrders: {
    total: workOrdersSummary.length,
    open: workOrdersSummary.filter(wo => wo.status === "Open").length,
    inProgress: workOrdersSummary.filter(wo => wo.status === "In Progress").length,
    resolved: workOrdersSummary.filter(wo => wo.status === "Resolved").length
  }
};

// Download as JSON (PDF export requires premium Retool features)
utils.downloadFile({
  data: JSON.stringify(report, null, 2),
  fileName: `GridLens_${utility}_Executive_Report_${new Date().toISOString().split('T')[0]}.json`,
  fileType: "application/json"
});

utils.showNotification({
  title: "Report Generated",
  description: "Executive report downloaded successfully",
  type: "success"
});
```

---

### STEP 6.2: Add Export Button

**In navigation bar or top of dashboard:**

**CLICK:** + → Button

**Inspector:**
```
┌─────────────────────────────┐
│ Button                      │
├─────────────────────────────┤
│ Text: 📥 Export Executive   │
│       Report                │
│                             │
│ Style: Secondary            │
│ Icon: download              │
└─────────────────────────────┘
```

**Click event:**
```
Action: Run query
Query: buildExecutiveReport
```

---

## 💡 V3-7: INSIGHTS PANE (10 min)

### STEP 7.1: Create Auto-Narrative Transformer

**Name:** `v3Insights`

**Code:**
```javascript
const kpi = utilityHealthScore.value || {};
const ami = utilityAmiSummary.value || {};
const billing = utilityBillingSummary.value || {};
const anomalies = v3Anomalies.value || [];
const utility = utilitySelect.value || "All";

let insights = [];

// Header
insights.push(`**${utility} Utility Overview**`);
insights.push("");

// Health summary
const avgScore = kpi.avgScore || 0;
const scoreEmoji = avgScore >= 80 ? "🟢" : avgScore >= 60 ? "🟡" : "🔴";
insights.push(`${scoreEmoji} **Health Score:** ${avgScore.toFixed(1)}/100 across ${kpi.total || 0} meters`);
insights.push(`   • Critical: ${kpi.critical || 0} | Warning: ${kpi.warning || 0} | Healthy: ${kpi.healthy || 0}`);
insights.push("");

// AMI Communications
if (ami.deadRadios || ami.commFails) {
  insights.push(`📡 **AMI Communications:**`);
  if (ami.deadRadios > 0) insights.push(`   • ⚠️ ${ami.deadRadios} dead radios detected`);
  if (ami.commFails > 0) insights.push(`   • ⚠️ ${ami.commFails} communication failures`);
  if (ami.noEvents > 0) insights.push(`   • ${ami.noEvents} meters with no events`);
  insights.push("");
}

// Billing Integrity
const billingRisks = (billing.spike || 0) + (billing.gaps || 0) + (billing.flatline || 0);
if (billingRisks > 0) {
  insights.push(`💰 **Billing Integrity Risks:** ${billingRisks} total`);
  if (billing.spike > 0) insights.push(`   • ${billing.spike} usage spikes`);
  if (billing.gaps > 0) insights.push(`   • ${billing.gaps} read gaps`);
  if (billing.flatline > 0) insights.push(`   • ${billing.flatline} flatline meters`);
  if (billing.reverse > 0) insights.push(`   • ${billing.reverse} reversed meters`);
  insights.push("");
}

// AI Anomalies
if (anomalies.length > 0) {
  const criticalAnomalies = anomalies.filter(a => a.severity === "Critical").length;
  insights.push(`🤖 **AI Anomaly Detection:** ${anomalies.length} anomalies`);
  if (criticalAnomalies > 0) {
    insights.push(`   • 🚨 ${criticalAnomalies} critical anomalies require immediate attention`);
  }
  insights.push(`   • Top issue: ${anomalies[0].reason}`);
  insights.push("");
} else {
  insights.push(`✅ **No significant anomalies** detected under current filters`);
  insights.push("");
}

// Recommendations
if (kpi.critical > 0) {
  insights.push(`**Recommended Actions:**`);
  insights.push(`   1. Investigate ${kpi.critical} critical meters immediately`);
  if (ami.deadRadios > 0) insights.push(`   2. Dispatch field crews to repair ${ami.deadRadios} dead radios`);
  if (anomalies.length > 0) insights.push(`   3. Review top ${Math.min(5, anomalies.length)} AI-detected anomalies`);
}

return insights.join("\n");
```

---

### STEP 7.2: Add Insights Card

**CLICK:** Components → Container

**Inspector:**
```
┌─────────────────────────────┐
│ Container                   │
├─────────────────────────────┤
│ Name: [v3InsightsCard     ] │
│                             │
│ Position: Sticky (optional) │
│ Right: 20px                 │
│ Top: 100px                  │
│                             │
│ Width: 350px                │
│ Max-height: 80vh            │
│ Overflow: Auto              │
│                             │
│ Background: #1e293b         │
│ Border: 2px solid #60a5fa   │
│ Border radius: 12px         │
│ Padding: 20px               │
│                             │
│ Box shadow:                 │
│   0 4px 20px rgba(0,0,0,0.4)│
└─────────────────────────────┘
```

---

### STEP 7.3: Add Insights Content

**Inside v3InsightsCard:**

**Component 1: Header**
```html
<h3 style="color: #60a5fa; font-size: 16px; font-weight: 600; margin: 0 0 15px 0;">
  💡 AI Insights
</h3>
```

**Component 2: Insights Text**
```
┌─────────────────────────────┐
│ Markdown/Text               │
├─────────────────────────────┤
│ Value: {{ v3Insights.value }}│
│                             │
│ Color: #e2e8f0              │
│ Font size: 13px             │
│ Line height: 1.6            │
└─────────────────────────────┘
```

**Component 3: Timestamp**
```html
<p style="color: #64748b; font-size: 11px; margin-top: 15px; padding-top: 10px; border-top: 1px solid #334155;">
  Updated: {{ new Date().toLocaleString() }}
</p>
```

---

## 🔍 V3-8: UNIVERSAL CLICK-TO-INVESTIGATE (5 min)

Apply to ALL V3 components that weren't already configured:

### Tables to Update:
- ✅ v3AnomaliesTable (already done in Step 4.3)
- ✅ Map markers (already done in Step 3.3)
- ☐ utilityTrendChart
- ☐ Any new tables

---

### STEP 8.1: Add Chart Click Handler

**CLICK:** utilityTrendChart → Event Handlers

**Event:** Data point click

**Actions:**
```
Action 1: Set temp state
  Variable: selectedMeter
  Value: {{ utilityTrendChart.selectedDataPoint }}

Action 2: Control component
  Component: meterDetailsModal
  Method: open()
```

---

### STEP 8.2: Verify All Tables Have Click Handlers

**Checklist:**
```
☐ atRiskMetersTable → opens modal
☐ worst10HealthTable → opens modal
☐ worst10BillingTable → opens modal
☐ v3AnomaliesTable → opens modal
☐ workOrdersTable → optional (opens meter or WO details)
```

---

## ✅ FINAL VALIDATION (5 min)

### STEP 9.1: Test V3 Filter Bar

```
☐ Date range picker shows default 30 days
☐ Band filter shows all options
☐ Issue filter populates from data
☐ Anomalies toggle works
☐ Clear filters button resets all
☐ v3FilteredMeters updates correctly
```

---

### STEP 9.2: Test Timeline Analytics

```
☐ Chart shows data from filtered meters
☐ Zoom functionality works
☐ Tooltip displays correctly
☐ Helper text shows correct counts
```

---

### STEP 9.3: Test Premium Map

```
☐ Markers appear with correct colors
☐ Clustering works (markers group at low zoom)
☐ Click opens modal with correct meter
☐ Empty state shows if no GPS data
```

---

### STEP 9.4: Test AI Anomalies

```
☐ Anomalies table populates
☐ Anomaly scores calculated correctly
☐ Severity colors display properly
☐ Click opens modal
☐ KPI card shows count
```

---

### STEP 9.5: Test Work Orders

```
☐ Create work order button works
☐ Work order appears in table
☐ Status dropdown is editable
☐ Status updates persist
☐ Work order count is accurate
```

---

### STEP 9.6: Test Executive Export

```
☐ Export button downloads JSON
☐ Report contains all sections
☐ Data is accurate
☐ Filename includes utility and date
```

---

### STEP 9.7: Test Insights Pane

```
☐ Insights card displays
☐ Content updates with filters
☐ Markdown formatting works
☐ Timestamp shows current time
```

---

### STEP 9.8: Test Universal Click

```
☐ All tables open modal on row click
☐ Map markers open modal on click
☐ Chart points open modal on click
☐ Modal shows correct meter data
```

---

## 🎉 FINAL DASHBOARD STRUCTURE

```
┌──────────────────────────────────────────────────┐
│ Navigation Bar (V2)                              │
├──────────────────────────────────────────────────┤
│ Brand Header (V2)                                │
├──────────────────────────────────────────────────┤
│ [Utility Selector (V1)] ┌──────────────────────┐│
│                         │ 💡 AI Insights       ││
│ ━━━ V3 Filter Bar ━━━━━ │ (sticky sidebar)     ││
│ [Date] [Band] [Issues]  │                      ││
│ [Anomalies ☑] [Clear]   │ Auto-narrative with  ││
│                         │ recommendations      ││
│ ━━━ Utility Health ━━━━ │                      ││
│ KPIs + Anomaly Count    │ Updates in real-time ││
│                         └──────────────────────┘│
│ ━━━ Timeline Analytics ━━━━━━━━━━━━━━━━━━━━━━ │
│ [Interactive chart with zoom]                    │
│                                                  │
│ ━━━ Premium Map ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ [Clustering + color-coded markers]               │
│                                                  │
│ ━━━ AI Anomalies ━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ [Anomalies table with severity scoring]          │
│                                                  │
│ ━━━ Work Orders ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ [Work orders table with status tracking]         │
│                                                  │
│ ━━━ Worst 10 Tables (V1/V2) ━━━━━━━━━━━━━━━━ │
│ [Health + Billing tables]                        │
│                                                  │
│ [📥 Export Executive Report]                     │
└──────────────────────────────────────────────────┘
```

---

## ⏱️ TIME BREAKDOWN

| Feature | Time |
|---------|------|
| V3-1: Filter Bar | 15 min |
| V3-2: Timeline Analytics | 12 min |
| V3-3: Premium Map | 10 min |
| V3-4: AI Anomalies | 15 min |
| V3-5: Work Orders | 15 min |
| V3-6: PDF Export | 8 min |
| V3-7: Insights Pane | 10 min |
| V3-8: Universal Click | 5 min |
| Validation | 5 min |
| **Total** | **~75 min** |

---

## ✅ WHAT YOU PRESERVED

**Untouched V1/V2 Features:**
- ✅ Premium 5-tab modal (all tabs intact)
- ✅ Utility selector dropdown
- ✅ Health KPI cards
- ✅ AMI/Billing panels
- ✅ Worst-10 tables
- ✅ Basic geo map (upgraded, not replaced)
- ✅ All existing transformers
- ✅ All existing data bindings
- ✅ Navigation bar
- ✅ Brand header
- ✅ Footer

**Only additions made - zero deletions!**

---

*V3 Premium Dashboard Guide for GridLens Smart MeterIQ*

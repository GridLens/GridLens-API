# GridLens V3 Premium Dashboard - Quick Reference Card

## 🚀 V3 FEATURES AT A GLANCE

**11 Premium Features** that transform your dashboard into an enterprise analytics platform.

**Time:** ~75 minutes total

**Rule:** ONLY ADD features - preserve all V1/V2 components!

---

## 🔧 10 NEW TRANSFORMERS (Copy-Paste Ready)

### 1. `metersNormalized` ⭐ CRITICAL FOUNDATION
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
  
  // Preserve original for modal
  _original: m
}));
```

### 2. `v3IssueList`
```javascript
const meters = filteredMetersByUtility.value || IQOverview.data?.meters || [];
const allIssues = meters.flatMap(m => {
  const issues = m.issues || [];
  return issues.map(i => {
    if (typeof i === 'string') return i;
    return i.code || i.msg || i.type || String(i);
  });
});
return [...new Set(allIssues)].filter(Boolean).sort();
```

### 3. `v3FilteredMeters`
```javascript
const meters = filteredMetersByUtility.value || IQOverview.data?.meters || [];
const bandsSelected = (v3BandFilter.value || []).map(b => b.toLowerCase());
const issuesSelected = v3IssueFilter.value || [];
const showAnomaliesOnly = v3ShowOnlyAnomalies.value;

let filtered = meters.filter(m => {
  const band = (m.band || "healthy").toLowerCase();
  const bandMatch = !bandsSelected.length || bandsSelected.includes(band);
  
  const meterIssues = (m.issues || []).map(i => {
    if (typeof i === 'string') return i;
    return i.code || i.msg || i.type || String(i);
  });
  const issueMatch = !issuesSelected.length || 
    meterIssues.some(issue => issuesSelected.includes(issue));
  
  return bandMatch && issueMatch;
});

if (showAnomaliesOnly) {
  filtered = filtered.filter(m => (m.anomalyScore ?? 0) > 0);
}

return filtered;
```

### 4. `utilityTrendSeries`
```javascript
const meters = metersNormalized.value || [];
const allPoints = meters.flatMap(m => {
  const trendData = m.trend || [];
  return trendData.map(point => ({
    ts: point.ts || point.timestamp || point.date,
    value: point.value ?? point.usage ?? point.score ?? point.kwh ?? point.gallons,
    type: point.type || m.type || "usage",
    meterId: m.meterId
  }));
});
return allPoints.filter(p => p.ts && p.value !== null && p.value !== undefined)
  .sort((a, b) => new Date(a.ts) - new Date(b.ts));
```

### 5. `v3MapMarkers`
```javascript
const meters = metersNormalized.value || [];
return meters.filter(m => m.lat && m.lng).map(m => {
  const band = m.band.toLowerCase();
  const colorMap = {
    "critical": "#ff4444", "poor": "#ff7744", "fair": "#ffaa00",
    "warning": "#ffaa00", "good": "#00ff88", "excellent": "#00ffff",
    "healthy": "#00ff88"
  };
  return {
    id: m.meterId,
    lat: m.lat,
    lng: m.lng,
    band: band,
    score: m.score,
    issues: m.issues,
    color: colorMap[band] || "#94a3b8",
    title: `${m.meterId} - ${band} (${m.score ?? "N/A"})`,
    meterData: m._original || m
  };
});
```

### 6. `v3Anomalies`
```javascript
const meters = metersNormalized.value || [];

function stdev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

return meters.map(m => {
  const trendData = m.trend || [];
  const series = trendData.map(x => x.value ?? x.usage ?? x.score ?? x.kwh ?? x.gallons)
    .filter(n => typeof n === 'number' && !isNaN(n));
  
  let anomalyScore = 0;
  let reasons = [];
  
  if (series.length >= 6) {
    const sd = stdev(series);
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const last = series[series.length - 1];
    
    if (sd > mean * 0.6 && mean > 0) {
      anomalyScore += 2;
      reasons.push("High volatility");
    }
    if (last > mean * 2 && mean > 0) {
      anomalyScore += 2;
      reasons.push("Extreme spike");
    }
    if (last < mean * 0.2 && mean > 0) {
      anomalyScore += 2;
      reasons.push("Sudden drop/flatline");
    }
  }
  
  const issuesCount = m.issues.length;
  if (issuesCount >= 2) {
    anomalyScore += 1;
    reasons.push(`${issuesCount} issues detected`);
  }
  
  const band = m.band.toLowerCase();
  if (band === "critical") {
    anomalyScore += 1;
    reasons.push("Critical health band");
  }
  
  let severity = "Normal";
  if (anomalyScore >= 4) severity = "Critical";
  else if (anomalyScore >= 2) severity = "Warning";
  
  return {
    meterId: m.meterId,
    anomalyScore,
    severity,
    reason: reasons.join("; ") || "No anomalies",
    healthScore: m.score,
    band: m.band,
    issues: m.issues,
    utility: m.utility
  };
}).filter(a => a.anomalyScore > 0).sort((a, b) => b.anomalyScore - a.anomalyScore);
```

### 7. `v3AnomaliesExplainable` ⭐ EXPLAINABLE AI
```javascript
const anoms = v3Anomalies.value || [];
const meters = metersNormalized.value || [];

return anoms.map(a => {
  const m = meters.find(x => x.meterId === a.meterId) || {};
  const reasons = [];
  
  // Diagnostic context gathering
  if ((m.trend || []).length < 6) reasons.push("Limited history");
  if ((m.issues || []).length >= 2) reasons.push("Multiple risk signals");
  if ((m.billingFlags || []).length > 0) reasons.push("Billing flags present");
  if ((m.amiEvents || []).length > 0) reasons.push("AMI events present");
  
  // Confidence based on data availability
  const confidence =
    (m.trend || []).length >= 12 ? "High" :
    (m.trend || []).length >= 6 ? "Medium" : "Low";
  
  return {
    ...a,
    confidence,
    explainableReasons: reasons.join("; ") || "Trend-based variance"
  };
});
```

### 8. `v3Insights`
```javascript
const kpi = utilityHealthScore.value || {};
const ami = utilityAmiSummary.value || {};
const billing = utilityBillingSummary.value || {};
const anomalies = v3Anomalies.value || [];
const utility = utilitySelect.value || "All";

let insights = [];
insights.push(`**${utility} Utility Overview**`);
insights.push("");

const avgScore = kpi.avgScore || 0;
const scoreEmoji = avgScore >= 80 ? "🟢" : avgScore >= 60 ? "🟡" : "🔴";
insights.push(`${scoreEmoji} **Health Score:** ${avgScore.toFixed(1)}/100 across ${kpi.total || 0} meters`);
insights.push(`   • Critical: ${kpi.critical || 0} | Warning: ${kpi.warning || 0} | Healthy: ${kpi.healthy || 0}`);
insights.push("");

if (ami.deadRadios || ami.commFails) {
  insights.push(`📡 **AMI Communications:**`);
  if (ami.deadRadios > 0) insights.push(`   • ⚠️ ${ami.deadRadios} dead radios detected`);
  if (ami.commFails > 0) insights.push(`   • ⚠️ ${ami.commFails} communication failures`);
  if (ami.noEvents > 0) insights.push(`   • ${ami.noEvents} meters with no events`);
  insights.push("");
}

const billingRisks = (billing.spike || 0) + (billing.gaps || 0) + (billing.flatline || 0);
if (billingRisks > 0) {
  insights.push(`💰 **Billing Integrity Risks:** ${billingRisks} total`);
  if (billing.spike > 0) insights.push(`   • ${billing.spike} usage spikes`);
  if (billing.gaps > 0) insights.push(`   • ${billing.gaps} read gaps`);
  if (billing.flatline > 0) insights.push(`   • ${billing.flatline} flatline meters`);
  if (billing.reverse > 0) insights.push(`   • ${billing.reverse} reversed meters`);
  insights.push("");
}

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

if (kpi.critical > 0) {
  insights.push(`**Recommended Actions:**`);
  insights.push(`   1. Investigate ${kpi.critical} critical meters immediately`);
  if (ami.deadRadios > 0) insights.push(`   2. Dispatch field crews to repair ${ami.deadRadios} dead radios`);
  if (anomalies.length > 0) insights.push(`   3. Review top ${Math.min(5, anomalies.length)} AI-detected anomalies`);
}

return insights.join("\n");
```

### 9. `dispatchPack` 📦 FIELD-READY EXPORT
```javascript
const orders = workOrders.value || [];
return orders.map(o => ({
  ticketId: o.id,
  utility: o.utility,
  meterId: o.meterId,
  priority: o.priority,
  issues: (o.issues || []).join(", "),
  recommendedAction:
    (o.recommendedAction || recommendedAction.value?.action?.join(" ")) ?? "",
  createdTs: o.createdTs,
  status: o.status
}));
```

### 10. `portfolioSummary` 📊 EXECUTIVE MULTI-UTILITY VIEW
```javascript
const buckets = IQOverview.data?.riskMap?.buckets || [];
return buckets.map(b => ({
  utility: b.utilityName ?? b.utility ?? b.name ?? "unknown",
  avgScore: b.avgScore ?? b.score ?? null,
  critical: b.critical ?? b.criticalCount ?? 0,
  warning: b.warning ?? b.warningCount ?? 0,
  healthy: b.healthy ?? b.healthyCount ?? 0,
  totalMeters: b.totalMeters ?? b.count ?? 0
}));
```

---

## 📋 COMPONENTS TO ADD

### V3-1: Filter Bar Components
```
Container: v3FilterBar (horizontal layout)
├─ Date Range Picker: v3DateRange
├─ Multi-select: v3BandFilter
├─ Multi-select: v3IssueFilter  
├─ Toggle: v3ShowOnlyAnomalies
└─ Button: Clear Filters
```

### V3-2: Timeline Analytics
```
Line Chart: utilityTrendChart
├─ Data: {{ utilityTrendSeries.value }}
├─ X-axis: ts
├─ Y-axis: value
└─ Group by: type
```

### V3-3: Premium Map
```
Map: utilityMetersMap (update existing)
├─ Data: {{ v3MapMarkers.value }}
├─ Clustering: enabled
├─ Marker color: color field
└─ Click: Open modal
```

### V3-4: AI Anomalies (Explainable)
```
Table: v3AnomaliesTable
├─ Data: {{ v3AnomaliesExplainable.value }}
└─ Columns: 
   - meterId
   - anomalyScore
   - severity
   - confidence (NEW - color coded)
   - reason
   - explainableReasons (NEW - context)
   - healthScore
   - band

Statistic: anomaliesCountCard
└─ Value: {{ v3Anomalies.value.length }}
```

### V3-5: Work Orders
```
Temp State: workOrders (array, default [])

Button: Create Work Order
└─ Creates new work order object

Table: workOrdersTable
├─ Data: {{ workOrders.value }}
└─ Status column: editable dropdown
```

### V3-6: Executive Export
```
JS Query: buildExecutiveReport
└─ Downloads comprehensive JSON report

Button: Export Executive Report
└─ Runs buildExecutiveReport query
```

### V3-7: Insights Pane
```
Container: v3InsightsCard (sticky sidebar)
└─ Text/Markdown: {{ v3Insights.value }}
```

### V3-8: Dispatch Pack 📦
```
Transformer: dispatchPack

Table: dispatchPackTable
├─ Data: {{ dispatchPack.value }}
└─ Columns: ticketId, utility, meterId, priority, issues, recommendedAction, createdTs, status

Button: exportDispatchCsvBtn
└─ Downloads CSV: {{ dispatchPackTable.data }}
```

### V3-9: Portfolio Mode 📊
```
Toggle: portfolioModeToggle (default: false)

Transformer: portfolioSummary

Table: portfolioSummaryTable
├─ Data: {{ portfolioSummary.value }}
├─ Visible when: {{ portfolioModeToggle.value === true }}
└─ Columns: utility, avgScore, critical, warning, healthy, totalMeters

Visibility rules:
- utilitySelect: visible when portfolioModeToggle === false
- AMI/Billing/KPI panels: visible when portfolioModeToggle === false
```

### V3-10: Demo Mode 🎬
```
Toggle: demoModeToggle (default: false)

JS Query: demoModeController
└─ Runs on toggle change

Demo ON:
  v3BandFilter → ["Critical","Warning"]
  v3ShowOnlyAnomalies → true
  refreshIntervalSelect → "5m"
  autoRefreshToggle → true

Demo OFF:
  v3BandFilter → ["Critical","Warning","Healthy"]
  v3ShowOnlyAnomalies → false
  autoRefreshToggle → false
```

---

## 🔗 KEY BINDINGS

### Filter Bar
```javascript
v3BandFilter values: ["Critical", "Warning", "Fair", "Good", "Excellent", "Healthy"]
v3IssueFilter values: {{ v3IssueList.value }}
v3DateRange default: Last 30 days
```

### Timeline Chart
```javascript
Data: {{ utilityTrendSeries.value }}
X: ts
Y: value
Group: type
```

### Map Markers
```javascript
Data: {{ v3MapMarkers.value }}
Color: color field
Click → selectedMeter = marker.meterData → open modal
```

### Anomalies Table
```javascript
Data: {{ v3AnomaliesExplainable.value }}
Sort: anomalyScore descending
Click → open modal

confidence column color:
{{ currentRow.confidence === "High" ? "#00ff88" : 
   currentRow.confidence === "Medium" ? "#ffaa00" : 
   "#ff4444" }}
```

### Work Orders
```javascript
Create WO button → push to workOrders array
Status dropdown: ["Open", "In Progress", "Resolved", "Deferred", "Cancelled"]
```

---

## 🎯 DATA FLOW

```
IQOverview (base query)
    ↓
utilitySelect (filter by utility)
    ↓
filteredMetersByUtility
    ↓
v3FilteredMeters (apply V3 filters)
    ↓
┌───────────────┬──────────────┬────────────┐
│               │              │            │
v3Anomalies  v3MapMarkers  utilityTrendSeries
v3Insights   workOrders    buildExecutiveReport
```

---

## ⚡ QUICK IMPLEMENTATION ORDER

**High-impact features first:**

1. **Filter Bar** (15 min) - Immediate filtering power
2. **AI Anomalies** (15 min) - Wow factor
3. **Insights Pane** (10 min) - Auto-narrative
4. **Work Orders** (15 min) - Action tracking
5. **Premium Map** (10 min) - Visual upgrade
6. **Timeline Chart** (12 min) - Trend analysis
7. **PDF Export** (8 min) - Executive reporting
8. **Universal Click** (5 min) - Polish

**Total: ~75 min**

---

## 🎨 V3 STYLING

### Filter Bar
```
Background: #1e293b
Border: 1px solid #334155
Border radius: 8px
Padding: 15px
Gap: 12px
```

### Anomalies Table
```
Critical severity → Red row highlight
Warning severity → Orange row highlight
Normal severity → Default
```

### Insights Card
```
Position: Sticky
Right: 20px
Top: 100px
Width: 350px
Background: #1e293b
Border: 2px solid #60a5fa
Box shadow: 0 4px 20px rgba(0,0,0,0.4)
```

### Map Markers
```
Critical: #ff4444 (red)
Warning/Fair: #ffaa00 (orange)
Good/Healthy: #00ff88 (green)
Excellent: #00ffff (cyan)
```

---

## ✅ TESTING CHECKLIST

```
☐ V3-1: Filter bar updates v3FilteredMeters
☐ V3-2: Timeline chart shows filtered data
☐ V3-3: Map clustering works, colors correct
☐ V3-4: Anomalies detect and score correctly
☐ V3-5: Work orders create and update status
☐ V3-6: Executive report downloads JSON
☐ V3-7: Insights pane updates with filters
☐ V3-8: Dispatch Pack exports CSV correctly
☐ V3-9: Portfolio Mode shows/hides correct panels
☐ V3-10: Demo Mode toggles filters and refresh
☐ V3-11: All tables/charts open modal on click
☐ All V1/V2 features still work
☐ No component name changes
☐ No broken bindings
```

---

## 🔧 WORK ORDER CREATION CODE

```javascript
// Button click event
const newId = `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const meter = selectedMeterDetails.value || currentRow;
const meterId = meter?.meterId ?? meter?.meter_id ?? "Unknown";
const priority = recommendedAction.value?.priority ?? 
  (meter?.band === "critical" ? "Critical" : "Normal");

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

workOrders.setValue([...(workOrders.value || []), newWorkOrder]);

utils.showNotification({
  title: "Work Order Created",
  description: `Work order ${newId} created for ${meterId}`,
  type: "success",
  duration: 3
});
```

---

## 📄 EXECUTIVE REPORT CODE

```javascript
// buildExecutiveReport JS Query
const utility = utilitySelect.value || "All";
const kpi = utilityHealthScore.value || {};
const ami = utilityAmiSummary.value || {};
const billing = utilityBillingSummary.value || {};
const anomalies = v3Anomalies.value.slice(0, 10);
const workOrdersSummary = workOrders.value || [];

const report = {
  title: "GridLens Smart MeterIQ™ Executive Summary",
  utility: utility,
  generatedTimestamp: new Date().toISOString(),
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
  topAnomalies: anomalies,
  workOrders: {
    total: workOrdersSummary.length,
    open: workOrdersSummary.filter(wo => wo.status === "Open").length,
    inProgress: workOrdersSummary.filter(wo => wo.status === "In Progress").length,
    resolved: workOrdersSummary.filter(wo => wo.status === "Resolved").length
  }
};

utils.downloadFile({
  data: JSON.stringify(report, null, 2),
  fileName: `GridLens_${utility}_Executive_Report_${new Date().toISOString().split('T')[0]}.json`,
  fileType: "application/json"
});
```

---

## 🎬 DEMO MODE CONTROLLER CODE

```javascript
// demoModeController JS Query
const on = demoModeToggle.value;

if (on) {
  // Demo ON: Show critical issues
  v3BandFilter.setValue(["Critical","Warning"]);
  v3ShowOnlyAnomalies.setValue(true);
  
  // Enable auto-refresh for live demos
  refreshIntervalSelect.setValue("5m");
  autoRefreshToggle.setValue(true);

} else {
  // Demo OFF: Reset to normal view
  v3BandFilter.setValue(["Critical","Warning","Healthy"]);
  v3ShowOnlyAnomalies.setValue(false);
  
  // Disable auto-refresh
  autoRefreshToggle.setValue(false);
}
```

---

## 🎯 UNIVERSAL CLICK HANDLER PATTERN

```javascript
// For ALL tables
Event: Row click
Action 1: Set temp state → selectedMeter = {{ currentRow }}
Action 2: Control component → meterDetailsModal.open()

// For map markers
Event: Marker click
Action 1: Set temp state → selectedMeter = {{ selectedMarker.meterData }}
Action 2: Control component → meterDetailsModal.open()

// For charts
Event: Data point click
Action 1: Set temp state → selectedMeter = {{ selectedDataPoint }}
Action 2: Control component → meterDetailsModal.open()
```

---

## ⏱️ TIME ESTIMATES

| Feature | Components | Time |
|---------|-----------|------|
| Filter Bar | 5 components | 15 min |
| Timeline | 1 chart | 12 min |
| Map Upgrade | 1 map | 10 min |
| Anomalies | 1 table + 1 KPI | 15 min |
| Work Orders | 1 state + 1 table + buttons | 15 min |
| PDF Export | 1 query + 1 button | 8 min |
| Insights | 1 card | 10 min |
| Click handlers | Multiple | 5 min |
| **Total** | | **~75 min** |

---

## 🚫 WHAT NOT TO TOUCH

❌ meterDetailsModal (all 5 tabs)  
❌ utilitySelect dropdown  
❌ filteredMetersByUtility transformer  
❌ selectedMeterDetails transformer  
❌ Health KPI cards (V2)  
❌ AMI/Billing panels (V2)  
❌ Worst-10 tables (V1/V2)  
❌ Navigation bar  
❌ Brand header  

✅ **ONLY ADD V3 features alongside existing!**

---

## 🎉 FINAL V3 DASHBOARD

**Complete feature set:**

**V1 Features (Preserved):**
- Premium 5-tab modal
- Utility selector
- Basic tables/charts

**V2 Features (Preserved):**
- Utility health KPIs
- AMI/Billing panels
- Geo map
- Navigation/branding

**V3 Features (NEW):**
- Advanced filter bar
- Interactive timeline
- AI anomaly detection
- Work order management
- Executive reporting
- Auto-narrative insights
- Universal drill-down

**Result:** Enterprise-grade analytics platform! 🚀

---

*Quick Reference for V3 Premium Dashboard - GridLens Smart MeterIQ*

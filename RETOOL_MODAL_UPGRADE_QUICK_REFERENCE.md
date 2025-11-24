# GridLens Modal Upgrade - Quick Reference Card

## 🎯 WHAT YOU'RE BUILDING

**Transform:** Simple modal → Premium 5-tab investigation center

**Time:** 20-25 minutes

**Scope:** ONLY the `meterDetailsModal` - nothing else changes!

---

## 📊 5 TABS TO CREATE

| Tab # | Name | Purpose | Key Component |
|-------|------|---------|---------------|
| 1 | Overview | Summary + raw JSON | Text fields + JSON viewer |
| 2 | Health Trend | Timeline chart | Line chart showing score over time |
| 3 | AMI Events | Event log table | Table of meter events |
| 4 | Billing Investigation | Flags + analysis | Billing flags table + summary |
| 5 | Recommended Action | AI recommendations | Priority badge + action list |

---

## 🔧 TRANSFORMERS TO CREATE

### 1. `selectedMeterDetails` (if not exists)
```javascript
const row = selectedMeter.value;
const meters = IQOverview.data?.meters || IQOverview.data?.atRiskMeters || [];
if (!row) return null;
const id = row.meterId ?? row.meter_id;
const found = meters.find(m => (m.meterId ?? m.meter_id) === id);
return found || row;
```

### 2. `selectedMeterTrend`
```javascript
const m = selectedMeterDetails.value || {};
const trendData = m.trend || m.usageTrend || m.healthTrend || [];
if (trendData.length === 0) {
  // Generate synthetic 7-day trend
  const score = m.score || 0;
  return Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6-i)*86400000).toISOString().split('T')[0],
    score: Math.max(0, Math.round(100 - ((100-score)/7*i)))
  }));
}
return trendData;
```

### 3. `selectedMeterAMIEvents`
```javascript
const m = selectedMeterDetails.value || {};
return m.amiEvents || m.events || m.ami_events || [];
```

### 4. `selectedMeterBillingFlags`
```javascript
const m = selectedMeterDetails.value || {};
return m.billingFlags || m.flags || m.billing_flags || [];
```

### 5. `recommendedAction`
```javascript
const m = selectedMeterDetails.value || {};
const score = m.score ?? 100;
const band = (m.band || "").toLowerCase();
const issues = (m.issues || []).map(i => i.code || i.msg || i);
const flags = m.billingFlags || m.flags || [];

let action = [];
let priority = "Normal";

if (band === "critical" || score < 50) {
  priority = "Critical";
  action.push("🚨 Dispatch field crew to inspect meter immediately.");
}
if (issues.some(i => String(i).includes("comm"))) {
  action.push("📡 Check AMI radio, antenna, and network path.");
}
if (issues.some(i => String(i).includes("flatline"))) {
  action.push("🔧 Verify meter is registering; likely replacement needed.");
}
if (flags.length > 0) {
  action.push("💰 Review recent bills vs reads; billing risk detected.");
}
if (action.length === 0) {
  action.push("✅ No immediate action needed. Continue monitoring.");
}

return { priority, action };
```

---

## 🎨 COMPONENT STRUCTURE

```
meterDetailsModal (Modal)
 └─ meterDetailsTabs (Tabs)
     ├─ Tab 1: Overview
     │   ├─ meterSummaryContainer (Container)
     │   │   ├─ Text: Meter ID
     │   │   ├─ Text: Health Score
     │   │   ├─ Text: Band
     │   │   ├─ Text: Issues
     │   │   └─ Text: Last Read
     │   └─ selectedMeterJson (JSON Explorer)
     │
     ├─ Tab 2: Health Trend
     │   ├─ meterTrendChart (Line Chart)
     │   └─ Text: Helper text
     │
     ├─ Tab 3: AMI Events
     │   └─ meterAmiEventsTable (Table)
     │
     ├─ Tab 4: Billing Investigation
     │   ├─ meterBillingFlagsTable (Table)
     │   └─ Text: Billing summary
     │
     └─ Tab 5: Recommended Action
         ├─ Badge: Priority level
         └─ Text: Action list (HTML formatted)
```

---

## 🔗 KEY BINDINGS

### Tab 1 - Overview
```javascript
Meter ID: {{ selectedMeterDetails.value?.meterId ?? "—" }}
Score: {{ selectedMeterDetails.value?.score ?? "—" }}
Band: {{ selectedMeterDetails.value?.band ?? "—" }}
Issues: {{ (selectedMeterDetails.value?.issues || []).join(", ") || "None" }}
JSON: {{ selectedMeterDetails.value }}
```

### Tab 2 - Health Trend
```javascript
Chart Data: {{ selectedMeterTrend.value }}
X-axis: ts or date
Y-axis: score or value
```

### Tab 3 - AMI Events
```javascript
Table Data: {{ selectedMeterAMIEvents.value }}
Columns: eventType, ts, severity, description
```

### Tab 4 - Billing
```javascript
Table Data: {{ selectedMeterBillingFlags.value }}
Columns: code, level, msg, stats
Summary: {{ selectedMeterDetails.value?.billingSummary || "N/A" }}
```

### Tab 5 - Recommended Action
```javascript
Priority: {{ recommendedAction.value.priority }}
Actions: {{ recommendedAction.value.action.join(' ') }}
```

---

## ⚡ QUICK IMPLEMENTATION STEPS

1. **Clear modal** - Delete old content
2. **Add Tabs** - Create 5-tab component
3. **Tab 1** - Add summary text + JSON
4. **Tab 2** - Add chart with `selectedMeterTrend`
5. **Tab 3** - Add events table
6. **Tab 4** - Add billing table + summary
7. **Tab 5** - Add priority badge + actions list
8. **Test** - Click meter rows, switch tabs

---

## 🎨 STYLING COLORS (Dark Theme)

```javascript
// Backgrounds
Modal: #1e293b
Containers: #1e293b
Cards: #0f172a

// Text
Headers: #60a5fa
Body: #e2e8f0
Muted: #94a3b8

// Priority Colors
Critical: #ff4444
High: #ffaa00
Normal: #60a5fa
Low: #00ff88

// Health Band Colors
Critical: #ff4444
Poor/Fair: #ffaa00
Good: #00ff88
Excellent: #00ffff
```

---

## ✅ TESTING CHECKLIST

Quick validation:

```
☐ Overview tab: Shows meter summary
☐ Health Trend tab: Shows chart (even if synthetic)
☐ AMI Events tab: Shows table or "No events"
☐ Billing tab: Shows flags or "No risks"
☐ Recommended Action: Shows priority + actions
☐ Can switch between tabs smoothly
☐ Modal opens from all tables
☐ Dark theme consistent
```

---

## 🐛 COMMON ISSUES

**Chart doesn't show:**
- Check transformer has data
- Verify X/Y field names match data

**Tabs don't appear:**
- Ensure Tabs component is inside modal body
- Check tab names are configured

**Empty tables:**
- Normal if data doesn't include events/flags
- Empty state message should show

**Actions don't make sense:**
- Review logic in `recommendedAction`
- Add more conditions as needed

---

## 📏 TIME ESTIMATES

| Task | Time |
|------|------|
| Clear old modal content | 2 min |
| Add tabs component | 2 min |
| Build Overview tab | 5 min |
| Build Health Trend tab | 5 min |
| Build AMI Events tab | 4 min |
| Build Billing tab | 4 min |
| Build Recommended Action tab | 5 min |
| Verify row click handlers | 2 min |
| **Total** | **~25 min** |

---

## 🎯 WHAT STAYS THE SAME

✅ All dashboard charts - untouched  
✅ All dashboard tables - untouched  
✅ All other components - untouched  
✅ IQOverview query - untouched  
✅ Row click handlers - just verified  

**Only the modal content changes!**

---

## 🚀 FINAL RESULT

**Before:**
- Simple modal with basic text + JSON

**After:**
- 5-tab investigation center
- Health timeline visualization
- Event log viewer
- Billing risk analysis
- AI-powered recommendations

**Value:** Operators can now fully investigate any meter without leaving the dashboard!

---

*Quick Reference for Modal Upgrade - GridLens Smart MeterIQ*

# GridLens Retool - Drill-Down Modal Implementation

## Feature: Click Any Meter → View Detailed Information

This guide shows you how to add interactive drill-down functionality to your GridLens dashboard, allowing users to click on any meter row and see complete details in a modal popup.

---

## 📋 WHAT YOU'LL BUILD

**User Experience:**
1. User clicks on any meter row in a table
2. Modal opens showing complete meter details
3. Displays: Meter ID, Health Score, Band, Issues, Full JSON data
4. Close modal to return to dashboard

**Components Created:**
- 1 Modal component
- 1 Temporary state variable
- 1 Transformer for enhanced data
- Row click handlers on tables

**Time to Implement:** ~10 minutes

---

## 🔨 STEP-BY-STEP IMPLEMENTATION

### **Step 1: Create Temporary State Variable**

This stores which meter the user clicked on.

1. Go to **State** tab (left sidebar in Retool)
2. Click **+ New** → **Temporary State**
3. Settings:
   - **Name:** `selectedMeter`
   - **Initial Value:** `null`
   - **Scope:** Session (default)

---

### **Step 2: Create the Modal Component**

1. Add **Modal** component to your canvas
2. Component settings:
   - **Name:** `meterDetailsModal`
   - **Title:** `Meter Details`
   - **Initially Hidden:** `true` (checkbox enabled)
   - **Width:** `600px` (medium)
   - **Height:** `auto`

**Modal Styling (Dark Theme):**
- Background: `#1e293b`
- Header background: `#0f172a`
- Border: `1px solid #334155`

---

### **Step 3: Create Transformer for Enhanced Details**

This transformer fetches complete meter data from IQOverview based on the selected row.

**Name:** `selectedMeterDetails`

**Code:**
```javascript
// Get the selected meter from temporary state
const selectedRow = selectedMeter.value;

// Handle null case
if (!selectedRow) {
  return null;
}

// Extract meter ID (handle different field name variations)
const meterId = selectedRow.meterId || selectedRow.meter_id;

// Try to find complete meter data from IQOverview
const allSources = [
  ...(IQOverview.data?.health?.worstMeters || []),
  ...(IQOverview.data?.atRisk?.meters || []),
  ...(IQOverview.data?.riskMap?.buckets?.flatMap(b => b.worstMeters || []) || [])
];

// Find the meter by ID
const fullMeterData = allSources.find(m => 
  (m.meterId || m.meter_id) === meterId
);

// Return full data if found, otherwise return selected row
return fullMeterData || selectedRow;
```

---

### **Step 4: Build Modal Content**

Inside the `meterDetailsModal` component, add these components:

#### **4.1: Header Section (Container)**

Add a **Container** inside modal, name it `modalHeader`

Inside this container, add **Text** component:

**Component 1: Meter ID Display**
- Type: **Text** (or Heading)
- Content:
```html
<h2 style="color: #60a5fa; margin: 0; font-size: 24px;">
  {{ selectedMeterDetails.value?.meterId || selectedMeterDetails.value?.meter_id || "Unknown Meter" }}
</h2>
<p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">
  {{ selectedMeterDetails.value?.type || "N/A" }} meter • 
  {{ selectedMeterDetails.value?.status || "N/A" }} • 
  {{ selectedMeterDetails.value?.location?.city || "Unknown" }}, {{ selectedMeterDetails.value?.location?.state || "?" }}
</p>
```

---

#### **4.2: Health Score Section (Container)**

Add another **Container**, name it `healthScoreSection`

**Component 2: Health Score Card**
- Type: **Statistic** (or Text with custom formatting)
- Label: `Health Score`
- Value: `{{ selectedMeterDetails.value?.score || "—" }}`
- Suffix: `/100`
- Color based on band:
```javascript
{{
  const band = (selectedMeterDetails.value?.band || "").toLowerCase();
  if (band === "critical") return "#ff4444";
  if (band === "poor" || band === "fair") return "#ffaa00";
  if (band === "good") return "#00ff88";
  if (band === "excellent") return "#00ffff";
  return "#94a3b8";
}}
```

**Component 3: Health Band Badge**
- Type: **Badge** or **Text**
- Text: `{{ selectedMeterDetails.value?.band || "Unknown" }}`
- Color: Use same logic as health score

---

#### **4.3: Issues Section**

**Component 4: Issues List**
- Type: **Table** or **List**
- Label: `Issues & Diagnostics`

If using **Text** component:
```javascript
{{
  const issues = selectedMeterDetails.value?.issues || [];
  if (issues.length === 0) return "✅ No issues detected";
  
  return issues.map(issue => {
    const severity = issue.severity || "unknown";
    const icon = severity === "high" ? "🔴" : severity === "medium" ? "🟡" : "🟢";
    const msg = issue.msg || issue.code || "Unknown issue";
    return `${icon} ${msg}`;
  }).join("\n");
}}
```

**Styling:**
- Font: Monospace
- White-space: Pre-wrap
- Background: `#0f172a`
- Padding: 15px
- Border radius: 8px

---

#### **4.4: Raw Data Explorer (Advanced)**

**Component 5: JSON Tree Viewer**
- Type: **JSON Explorer** (or **Text** with JSON.stringify)
- Label: `Complete Data (Advanced)`
- Data: `{{ selectedMeterDetails.value }}`
- Collapsed by default: `true`

If JSON Explorer unavailable, use **Text** component:
```javascript
{{ JSON.stringify(selectedMeterDetails.value, null, 2) }}
```

**Styling:**
- Font: `Courier New, monospace`
- Font size: `12px`
- Background: `#0f172a`
- Color: `#94a3b8`
- Max height: `300px`
- Overflow: `scroll`

---

#### **4.5: Action Buttons**

At bottom of modal, add **Container** with horizontal layout:

**Button 1: Close**
- Type: **Button**
- Label: `Close`
- Variant: Secondary
- On Click: `Close modal` → `meterDetailsModal`

**Button 2: View Meter History (Optional)**
- Type: **Button**
- Label: `View Full History`
- Variant: Primary
- On Click: Navigate to meter detail page (if you have one)

---

### **Step 5: Add Row Click Handlers to Tables**

Now connect your tables to open the modal when users click.

#### **5.1: At-Risk Meters Table**

1. Select your At-Risk Meters table (find correct name)
2. Go to **Event Handlers** tab
3. Add **Row Click** event:

**Handler Configuration:**
- Event: `Row click`
- **Action 1:**
  - Type: `Set temporary state`
  - State: `selectedMeter`
  - Value: `{{ currentRow }}`
  
- **Action 2:**
  - Type: `Control component`
  - Component: `meterDetailsModal`
  - Method: `Open`

#### **5.2: Worst 10 Health Table**

Repeat same configuration:
1. Select `worst10HealthTable`
2. Event Handlers → Row Click
3. Action 1: Set `selectedMeter` = `{{ currentRow }}`
4. Action 2: Open `meterDetailsModal`

#### **5.3: Worst 10 Billing Table**

Repeat same configuration:
1. Select `worst10BillingTable`
2. Event Handlers → Row Click
3. Action 1: Set `selectedMeter` = `{{ currentRow }}`
4. Action 2: Open `meterDetailsModal`

#### **5.4: Risk Map Table (if applicable)**

Repeat for any other meter tables in your dashboard.

---

## 🎨 ENHANCED MODAL LAYOUT (Optional)

For a more polished look, organize the modal in sections:

```
┌─────────────────────────────────────┐
│  METER DETAILS              [X]     │
├─────────────────────────────────────┤
│                                     │
│  🔷 MTR-1001                       │
│     Electric meter • Active         │
│     Holly Springs, MS               │
│                                     │
│  ┌────────────┐  ┌────────────┐   │
│  │ Score: 85  │  │ Band: Good │   │
│  └────────────┘  └────────────┘   │
│                                     │
│  Issues & Diagnostics:              │
│  ┌─────────────────────────────┐  │
│  │ 🔴 AMI comm trouble          │  │
│  │ 🟡 Read gap (48h since last) │  │
│  └─────────────────────────────┘  │
│                                     │
│  📊 Complete Data (Advanced) ▼     │
│  ┌─────────────────────────────┐  │
│  │ {                            │  │
│  │   "meterId": "MTR-1001",    │  │
│  │   "score": 85,              │  │
│  │   ...                        │  │
│  │ }                            │  │
│  └─────────────────────────────┘  │
│                                     │
│         [Close]  [View History]    │
└─────────────────────────────────────┘
```

---

## ✅ TESTING YOUR DRILL-DOWN

After implementation:

```bash
# Test 1: Click At-Risk meter
- Click any row in At-Risk Meters table
- Modal should open
- Verify meter ID displays correctly
- Verify health score shows
- Verify issues list appears

# Test 2: Click Worst 10 meter
- Click row in Worst 10 Health table
- Modal should open with correct data
- Click Close, modal should close

# Test 3: Field name variations
- Test with meters that have different field names
- Should gracefully handle meterId vs meter_id
- Should show "—" or default values if data missing

# Test 4: Close and reopen
- Close modal
- Click different meter
- Verify new data loads correctly
- No stale data from previous selection
```

---

## 🐛 TROUBLESHOOTING

### Issue: Modal doesn't open

**Fix:** Check event handler configuration
- Ensure both actions are present (set state + open modal)
- Verify modal name matches exactly: `meterDetailsModal`
- Check modal's "Initially Hidden" is set to `true`

### Issue: Shows previous meter's data

**Fix:** Clear state on modal close
- Add event handler to modal's "Close" event
- Action: Set `selectedMeter` = `null`

### Issue: "Cannot read property of undefined"

**Fix:** Add null checks to all bindings
```javascript
{{ selectedMeterDetails.value?.meterId || "—" }}
```

### Issue: No data shows in modal

**Fix:** Check transformer
- Verify `selectedMeterDetails` transformer is running
- Check dependencies: should depend on `selectedMeter` and `IQOverview`
- Add console.log to transformer to debug

---

## 🚀 ADVANCED ENHANCEMENTS (Optional)

### Enhancement 1: Add Meter Actions

Add action buttons inside modal:
- **Refresh Meter Data** - Re-query just this meter
- **Add Note** - Open form to add annotation
- **Flag for Review** - Mark meter for manual inspection

### Enhancement 2: Show Historical Trend Chart

If you add API endpoint for meter history:
```javascript
// Inside modal, add Line Chart component
// Data from: GET /meter/{{selectedMeterDetails.value.meterId}}/trend
```

### Enhancement 3: Related Meters

Show other meters in same area:
```javascript
const city = selectedMeterDetails.value?.location?.city;
const relatedMeters = IQOverview.data?.riskMap?.buckets
  ?.find(b => b.key === city)?.worstMeters || [];
```

### Enhancement 4: Export Single Meter Report

Add button to download PDF/CSV report for just this meter.

---

## 📊 COMPLETE COMPONENT SUMMARY

| Component | Type | Purpose |
|-----------|------|---------|
| `selectedMeter` | Temp State | Stores clicked row |
| `selectedMeterDetails` | Transformer | Enriches with full data |
| `meterDetailsModal` | Modal | Container for details |
| `modalHeader` | Container | Meter ID & location |
| `healthScoreCard` | Statistic | Score display |
| `issuesList` | Text/Table | Issues diagnostic |
| `jsonExplorer` | JSON Tree | Raw data view |
| Row Click Handlers | Events | Open modal on click |

---

## 🔗 INTEGRATION WITH OTHER FEATURES

This drill-down modal works seamlessly with:
- ✅ **Search Bar** - Click filtered results to see details
- ✅ **Worst 10 Tables** - Click to investigate worst performers
- ✅ **Alert Cards** - See why meters are in critical/warning state
- ✅ **Auto-Refresh** - Modal stays open, data updates on refresh

---

**Complete Implementation Time:** ~10 minutes

**Difficulty:** Intermediate

**Next Steps:** See `RETOOL_ENHANCEMENT_GUIDE.md` for features 2-8

---

*Drill-Down Modal Guide for GridLens Smart MeterIQ v2.0*

# GridLens Modal Upgrade - Visual Walkthrough

## 🎯 GOAL: Transform Simple Modal → Premium 5-Tab Investigation Center

**⚠️ SCOPE:** This guide ONLY modifies the `meterDetailsModal` component and related transformers. **No other dashboard components will be touched.**

**Time Estimate:** 20-25 minutes

---

## 📊 BEFORE vs AFTER

### BEFORE (Current Modal):
```
┌────────────────────────────────┐
│ Meter Details           [X]    │
├────────────────────────────────┤
│ Meter ID: MTR-1001             │
│ Health Score: 85               │
│ Band: Good                     │
│ Issues: ami_comm_trouble       │
│                                │
│ { raw JSON data }              │
└────────────────────────────────┘
```

### AFTER (Upgraded Tabbed Modal):
```
┌────────────────────────────────────────────────┐
│ Meter Details                           [X]    │
├────────────────────────────────────────────────┤
│ [Overview] [Health Trend] [AMI Events]         │
│ [Billing Investigation] [Recommended Action]   │
├────────────────────────────────────────────────┤
│                                                │
│  Tab Content (varies by selection)             │
│  - Overview: Summary + JSON                    │
│  - Health Trend: Timeline chart                │
│  - AMI Events: Events table                    │
│  - Billing: Flags + investigation              │
│  - Action: AI-powered recommendations          │
│                                                │
└────────────────────────────────────────────────┘
```

---

## ✅ PRE-FLIGHT CHECK

Before starting, verify these exist in your app:

**Required Components (Check Component Tree):**
- [ ] `meterDetailsModal` (modal component)
- [ ] `selectedMeter` (temporary state)
- [ ] `IQOverview` (query)

**If Missing:**
- Missing modal? You'll create it in Step 1
- Missing state? Created in Step 1
- Missing query? Verify query name (might be `iqOverview` or similar)

---

## 🚀 STEP-BY-STEP UPGRADE

### **STEP 1: Verify/Create Foundation (5 min)**

#### 1.1: Check Temporary State

**CLICK:** State tab → Look for `selectedMeter`

**If NOT found:**
```
CLICK: + New → Temporary state
┌───────────────────────────────┐
│ Name: [selectedMeter        ] │
│ Initial value: [null        ] │
│ Scope: ○ Session              │
└───────────────────────────────┘
```

---

#### 1.2: Create/Update Enhancement Transformer

**CLICK:** Code → Search for `selectedMeterDetails`

**If NOT found, create new:**

**Name:** `selectedMeterDetails`

**Code:**
```javascript
const row = selectedMeter.value;
const meters = IQOverview.data?.meters || IQOverview.data?.atRiskMeters || [];
if (!row) return null;
const id = row.meterId ?? row.meter_id;
const found = meters.find(m => (m.meterId ?? m.meter_id) === id);
return found || row;
```

---

### **STEP 2: Clear Out Old Modal Content (2 min)**

**CLICK:** Your `meterDetailsModal` in component tree

**What you'll see:** Modal with existing text/JSON components

**ACTION:** 
1. Select all components INSIDE the modal body
2. **Delete them all** (we're rebuilding with tabs)

**Result:** Empty modal body
```
┌────────────────────────────────┐
│ Meter Details           [X]    │
├────────────────────────────────┤
│                                │
│  (Empty - ready for tabs)      │
│                                │
└────────────────────────────────┘
```

---

### **STEP 3: Add Tabs Component (2 min)**

**INSIDE the modal body:**

**CLICK:** + (plus icon) → Search "Tabs" → Add **Tabs** component

**Inspector:**
```
┌─────────────────────────────┐
│ Tabs                        │
├─────────────────────────────┤
│ Name: [meterDetailsTabs   ] │
│                             │
│ Tabs:                       │
│ Tab 1: [Overview         ]  │
│ Tab 2: [Health Trend     ]  │
│ Tab 3: [AMI Events       ]  │
│ Tab 4: [Billing Invest.  ]  │
│ Tab 5: [Recommended Action] │
│                             │
│ Default: Overview           │
└─────────────────────────────┘
```

**Visual result:**
```
┌────────────────────────────────────────┐
│ Meter Details                   [X]    │
├────────────────────────────────────────┤
│ [Overview]━━━━━━┓                      │
│ [Health Trend]  ┃                      │
│ [AMI Events]    ┃  ← Tab buttons       │
│ [Billing Inv.]  ┃                      │
│ [Recommended]   ┃                      │
│ ━━━━━━━━━━━━━━━━┛                      │
│                                        │
│  (Tab content area)                    │
│                                        │
└────────────────────────────────────────┘
```

---

## 📑 TAB 1: OVERVIEW (Summary + JSON)

### STEP 4: Build Overview Tab (5 min)

**CLICK:** "Overview" tab in the tabs component

**Inside Overview tab, add:**

#### Component 1: Meter Summary Container

**CLICK:** + → Container (name it `meterSummaryContainer`)

**Layout:** Vertical, Padding: 15px

**Inside container, add Text components:**

**Component A: Meter ID**
```
┌─────────────────────────────┐
│ Text                        │
├─────────────────────────────┤
│ Value:                      │
│ <b>Meter ID:</b>            │
│ {{ selectedMeterDetails.    │
│    value?.meterId ??        │
│    selectedMeterDetails.    │
│    value?.meter_id ?? "—" }}│
└─────────────────────────────┘
```

**Component B: Health Score**
```
Value:
<b>Health Score:</b> {{ selectedMeterDetails.value?.score ?? "—" }} / 100
```

**Component C: Health Band (with color)**
```
Value:
<b>Band:</b> 
<span style="color: {{ 
  const band = (selectedMeterDetails.value?.band || "").toLowerCase();
  if (band === "critical") return "#ff4444";
  if (band === "poor" || band === "fair") return "#ffaa00";
  if (band === "good") return "#00ff88";
  return "#94a3b8";
}}">
  {{ selectedMeterDetails.value?.band ?? "Unknown" }}
</span>
```

**Component D: Issues List**
```
Value:
<b>Issues:</b> {{ 
  (selectedMeterDetails.value?.issues || [])
    .map(i => i.code || i.msg || i)
    .join(", ") || "None"
}}
```

**Component E: Last Read Time**
```
Value:
<b>Last Read:</b> {{ 
  selectedMeterDetails.value?.lastReadTs ?? 
  selectedMeterDetails.value?.last_read_ts ?? 
  selectedMeterDetails.value?.lastReadAt ?? "—" 
}}
```

---

#### Component 2: JSON Explorer

**Below the summary container:**

**CLICK:** + → JSON Editor (or JSON Explorer)

**Inspector:**
```
Name: selectedMeterJson
Label: Complete Meter Data (Advanced)
Data: {{ selectedMeterDetails.value }}
Mode: View only
Collapsed by default: true
```

**Visual result of Overview tab:**
```
┌────────────────────────────────────┐
│ Meter ID: MTR-1001                 │
│ Health Score: 85 / 100             │
│ Band: Good (in green)              │
│ Issues: ami_comm_trouble, read_gap │
│ Last Read: 2025-11-20T14:10:00Z    │
│                                    │
│ ▶ Complete Meter Data (Advanced)   │
│   (collapsed JSON)                 │
└────────────────────────────────────┘
```

---

## 📈 TAB 2: HEALTH TREND (Timeline Chart)

### STEP 5: Build Health Trend Tab (5 min)

#### 5.1: Create Trend Data Transformer

**CLICK:** Code → + New → Transformer

**Name:** `selectedMeterTrend`

**Code:**
```javascript
const m = selectedMeterDetails.value || {};

// Try to find trend data from various possible fields
const trendData = 
  m.trend ||
  m.usageTrend ||
  m.healthTrend ||
  m.lastReads ||
  m.reads ||
  [];

// If no real trend data, generate synthetic 7-day trend
if (trendData.length === 0) {
  const score = m.score || 0;
  const degradation = (100 - score) / 7;
  
  return Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    score: Math.max(0, Math.round(100 - (degradation * i))),
    ts: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString()
  }));
}

return trendData;
```

---

#### 5.2: Add Chart Component

**CLICK:** "Health Trend" tab

**CLICK:** + → Chart → Line Chart

**Inspector:**
```
┌─────────────────────────────┐
│ Chart                       │
├─────────────────────────────┤
│ Name: [meterTrendChart    ] │
│                             │
│ Data:                       │
│ {{ selectedMeterTrend.value }}│
│                             │
│ X-axis field:               │
│ [ts] or [date] or [timestamp]│
│                             │
│ Y-axis field:               │
│ [score] or [value] or [usage]│
│                             │
│ Chart type: Line            │
│ Show points: true           │
│ Smooth: true                │
│                             │
│ Colors: [#60a5fa]           │
└─────────────────────────────┘
```

---

#### 5.3: Add Helper Text

**Below chart:**

**CLICK:** + → Text

**Value:**
```
<i style="color: #94a3b8; font-size: 12px;">
Trend derived from meter history data. Synthetic data shown if no historical data available.
</i>
```

**Visual result:**
```
┌────────────────────────────────────┐
│     Health Score Over Time         │
│  100┤         ╭─╮                   │
│   80┤       ╭─╯ ╰─╮                 │
│   60┤     ╭─╯     ╰─╮               │
│   40┤   ╭─╯         ╰─╮             │
│   20┤ ╭─╯             ╰─            │
│    0└─────────────────────          │
│      D1  D2  D3  D4  D5  D6  D7    │
│                                    │
│ Trend derived from meter history   │
└────────────────────────────────────┘
```

---

## 📡 TAB 3: AMI EVENTS VIEWER

### STEP 6: Build AMI Events Tab (4 min)

#### 6.1: Create Events Transformer

**Name:** `selectedMeterAMIEvents`

**Code:**
```javascript
const m = selectedMeterDetails.value || {};

return (
  m.amiEvents ||
  m.events ||
  m.ami_events ||
  []
);
```

---

#### 6.2: Add Events Table

**CLICK:** "AMI Events" tab

**CLICK:** + → Table

**Inspector:**
```
┌─────────────────────────────┐
│ Table                       │
├─────────────────────────────┤
│ Name: [meterAmiEventsTable] │
│                             │
│ Data:                       │
│ {{ selectedMeterAMIEvents.  │
│    value }}                 │
│                             │
│ Columns:                    │
│ - eventType or code         │
│ - ts or timestamp           │
│ - severity                  │
│ - description or msg        │
│                             │
│ Empty state message:        │
│ "No AMI events found"       │
└─────────────────────────────┘
```

**Visual result:**
```
┌────────────────────────────────────────┐
│ Event Type    │ Time       │ Severity  │
├───────────────┼────────────┼───────────┤
│ last_gasp     │ 11/21 9:00 │ High      │
│ comm_fail     │ 11/22 3:12 │ Medium    │
│ power_restore │ 11/21 9:45 │ Info      │
└────────────────────────────────────────┘
```

---

## 💰 TAB 4: BILLING INVESTIGATION

### STEP 7: Build Billing Tab (4 min)

#### 7.1: Create Billing Flags Transformer

**Name:** `selectedMeterBillingFlags`

**Code:**
```javascript
const m = selectedMeterDetails.value || {};

return (
  m.billingFlags ||
  m.flags ||
  m.billing_flags ||
  []
);
```

---

#### 7.2: Add Billing Flags Table

**CLICK:** "Billing Investigation" tab

**CLICK:** + → Table

**Inspector:**
```
Name: meterBillingFlagsTable
Data: {{ selectedMeterBillingFlags.value }}

Columns:
- code or flagType
- level or severity
- msg or description
- stats (JSON column)

Empty state: "No billing risks detected"
```

---

#### 7.3: Add Billing Summary Text

**Below table:**

**CLICK:** + → Text

**Value:**
```javascript
{{ 
  selectedMeterDetails.value?.billingSummary ||
  selectedMeterDetails.value?.billing_summary ||
  "No billing summary available for this meter."
}}
```

**Visual result:**
```
┌────────────────────────────────────────┐
│ Billing Flags                          │
├──────────────┬──────────┬──────────────┤
│ Flag Type    │ Severity │ Description  │
├──────────────┼──────────┼──────────────┤
│ read_gap     │ Medium   │ No reads in  │
│              │          │ last 24h     │
│ flatline     │ Low      │ Usage too    │
│              │          │ consistent   │
└──────────────┴──────────┴──────────────┘
│                                        │
│ Summary: 2 flags detected. Review      │
│ recent bills vs actual reads.          │
└────────────────────────────────────────┘
```

---

## 🤖 TAB 5: RECOMMENDED ACTION (AI Logic)

### STEP 8: Build Recommendations Tab (5 min)

#### 8.1: Create AI Recommendation Transformer

**Name:** `recommendedAction`

**Code:**
```javascript
const m = selectedMeterDetails.value || {};
const score = m.score ?? 100;
const band = (m.band || "").toLowerCase();
const issues = (m.issues || []).map(i => i.code || i.msg || i);
const flags = m.billingFlags || m.flags || [];

let action = [];
let priority = "Normal";

// Critical priority logic
if (band === "critical" || score < 50) {
  priority = "Critical";
  action.push("🚨 Dispatch field crew to inspect meter immediately.");
}

// Issue-specific actions
if (issues.some(i => String(i).includes("dead") || String(i).includes("comm"))) {
  action.push("📡 Check AMI radio, antenna, and network path; attempt re-commission.");
}

if (issues.some(i => String(i).includes("stuck") || String(i).includes("flatline"))) {
  action.push("🔧 Verify meter is registering; likely replacement required.");
}

if (issues.some(i => String(i).includes("reverse"))) {
  action.push("⚡ Inspect service wiring and meter polarity; correct reverse install.");
}

if (issues.some(i => String(i).includes("tamper"))) {
  action.push("🔒 Investigate potential meter tampering; dispatch security team.");
}

// Billing-specific actions
if (flags.length > 0) {
  action.push("💰 Review recent bills vs reads; correct estimation/back-billing risk.");
}

// Default action
if (action.length === 0) {
  action.push("✅ No immediate action needed. Continue monitoring.");
  priority = "Low";
} else if (action.length >= 3 && priority !== "Critical") {
  priority = "High";
}

return { priority, action };
```

---

#### 8.2: Add Priority Badge

**CLICK:** "Recommended Action" tab

**CLICK:** + → Badge (or Statistic)

**Inspector:**
```
┌─────────────────────────────┐
│ Badge                       │
├─────────────────────────────┤
│ Label: Priority Level       │
│                             │
│ Text:                       │
│ {{ recommendedAction.value. │
│    priority }}              │
│                             │
│ Color:                      │
│ {{ {                        │
│   "Critical": "#ff4444",    │
│   "High": "#ffaa00",        │
│   "Normal": "#60a5fa",      │
│   "Low": "#00ff88"          │
│ }[recommendedAction.value.  │
│   priority] }}              │
└─────────────────────────────┘
```

---

#### 8.3: Add Actions List

**Below badge:**

**CLICK:** + → Text

**Value:**
```javascript
{{
  const actions = recommendedAction.value?.action || [];
  return `
    <div style="padding: 15px; background: #1e293b; border-radius: 8px;">
      <h3 style="color: #60a5fa; margin-top: 0;">Recommended Actions:</h3>
      <ul style="color: #e2e8f0; line-height: 1.8;">
        ${actions.map(a => `<li>${a}</li>`).join('')}
      </ul>
    </div>
  `;
}}
```

**Visual result:**
```
┌────────────────────────────────────────┐
│ Priority Level: [Critical]             │
│                  (red badge)           │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ Recommended Actions:               │ │
│ │                                    │ │
│ │ • 🚨 Dispatch field crew to        │ │
│ │   inspect meter immediately.       │ │
│ │                                    │ │
│ │ • 📡 Check AMI radio, antenna,     │ │
│ │   and network path.                │ │
│ │                                    │ │
│ │ • 💰 Review recent bills vs reads. │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

---

## ✅ STEP 9: VERIFY ROW CLICK HANDLERS (2 min)

**Ensure tables still open the modal:**

### Check At-Risk Table

**CLICK:** Your at-risk meters table → Event Handlers tab

**Verify:**
```
Event: Row click
Action 1: Set temp state → selectedMeter = {{ currentRow }}
Action 2: Control component → meterDetailsModal.open()
```

---

### Add to Worst 10 Tables (if they exist)

**Find:** `worst10HealthTable` and `worst10BillingTable`

**For EACH table, add Event Handler:**
```
Event: Row click
Action 1: Set temp state → selectedMeter = {{ currentRow }}
Action 2: Control component → meterDetailsModal.open()
```

---

## 🎉 FINAL RESULT

Your upgraded modal now has:

```
┌──────────────────────────────────────────────────┐
│ Meter Details                             [X]    │
├──────────────────────────────────────────────────┤
│ [Overview] [Health Trend] [AMI Events]           │
│ [Billing Investigation] [Recommended Action]     │
├──────────────────────────────────────────────────┤
│                                                  │
│  Current Tab: Recommended Action                 │
│                                                  │
│  Priority Level: [Critical]                      │
│                                                  │
│  Recommended Actions:                            │
│  • 🚨 Dispatch field crew immediately            │
│  • 📡 Check AMI radio and network                │
│  • 💰 Review billing discrepancies               │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 🧪 TESTING CHECKLIST

Test each tab:

```
☐ Click meter row → modal opens
☐ Overview tab shows summary + JSON
☐ Health Trend tab shows chart
☐ AMI Events tab shows events (or empty state)
☐ Billing tab shows flags (or empty state)
☐ Recommended Action shows priority + actions
☐ Switch between tabs → data updates
☐ Close modal → can reopen with different meter
☐ All 3 tables (At-Risk, Worst10Health, Worst10Billing) open modal
```

---

## 🎨 STYLING TIPS

**Make tabs look professional:**

In Tabs component inspector:
```
Tab style: Pills or Underline
Active color: #60a5fa
Inactive color: #64748b
Background: #1e293b
```

**Dark theme consistency:**
- Container backgrounds: `#1e293b`
- Text color: `#e2e8f0`
- Headings: `#60a5fa`
- Borders: `#334155`

---

## 🔧 TROUBLESHOOTING

**Issue: Tabs don't show**
→ Make sure Tabs component is directly inside modal body

**Issue: Chart is empty**
→ Check `selectedMeterTrend` transformer, verify field names match

**Issue: No events/flags showing**
→ Expected if data doesn't include them; empty state should display

**Issue: Recommended actions don't make sense**
→ Review `recommendedAction` transformer logic, adjust conditions

---

## ⏱️ TIME BREAKDOWN

- Step 1-2: Foundation (7 min)
- Step 3: Add tabs (2 min)
- Step 4: Overview tab (5 min)
- Step 5: Health trend tab (5 min)
- Step 6: AMI events tab (4 min)
- Step 7: Billing tab (4 min)
- Step 8: Recommended action tab (5 min)
- Step 9: Verify handlers (2 min)

**Total: ~25 minutes**

---

## ✅ DONE!

**What you upgraded:**
- ✅ Simple modal → 5-tab investigation center
- ✅ Added health timeline chart
- ✅ Added AMI events viewer
- ✅ Added billing investigation
- ✅ Added AI-powered recommendations

**What you DIDN'T touch:**
- ✅ All other dashboard components unchanged
- ✅ Existing charts/tables intact
- ✅ Original data bindings preserved

**Your modal is now production-ready!** 🚀

---

*Modal Upgrade Guide for GridLens Smart MeterIQ Dashboard*

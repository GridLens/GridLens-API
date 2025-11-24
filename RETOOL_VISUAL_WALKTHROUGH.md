# GridLens Retool - Visual Step-by-Step Walkthrough

## 🎥 Complete Visual Implementation Guide

This guide walks you through EXACTLY what to click, where to find things, and what your screen should look like at each step.

---

## 🚀 BEFORE YOU START

### What Your Screen Should Look Like:

```
┌─────────────────────────────────────────────────────────┐
│ Retool Header (Your App Name)                          │
├─────────────────────────────────────────────────────────┤
│ [Components] [State] [Queries] [Settings]              │
│                                                         │
│  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │                  │  │                            │ │
│  │  Component Tree  │  │     Canvas                 │ │
│  │  (Left Panel)    │  │  (Your Dashboard Here)     │ │
│  │                  │  │                            │ │
│  │  - IQOverview    │  │                            │ │
│  │  - table1        │  │                            │ │
│  │  - container1    │  │                            │ │
│  └──────────────────┘  └────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Find these tabs at the top:**
- **Components** - Where you add buttons, tables, etc.
- **State** - Where you create `selectedMeter`
- **Queries** - Where you create transformers
- **Settings** - App-level settings

---

## 📊 FEATURE 1: DRILL-DOWN MODAL (10 minutes)

### Step 1: Create Temporary State

**CLICK PATH:** State tab → + New → Temporary state

**What you'll see:**
```
┌───────────────────────────────┐
│ Create temporary state        │
├───────────────────────────────┤
│ Name: [selectedMeter        ] │
│                               │
│ Initial value:                │
│ [null                       ] │
│                               │
│ Scope: ○ Session ○ Page       │
│                               │
│     [Cancel]  [Create]        │
└───────────────────────────────┘
```

**Type exactly:**
- Name: `selectedMeter`
- Initial value: `null`
- Scope: Session (default)

**Click:** `Create` button

---

### Step 2: Create the Modal

**CLICK PATH:** Components tab → Search "Modal" → Drag to canvas

**What you'll see:**
```
Modal appears on canvas with gray overlay
┌────────────────────────────────┐
│ Modal title             [X]    │
├────────────────────────────────┤
│                                │
│  (Empty modal body)            │
│                                │
│                                │
└────────────────────────────────┘
```

**Configure in right panel (Inspector):**

```
┌─────────────────────────────┐
│ INSPECTOR                   │
├─────────────────────────────┤
│ Component                   │
│ Name: [meterDetailsModal  ] │
│                             │
│ Title: [Meter Details     ] │
│                             │
│ ☑ Hidden by default         │
│                             │
│ Width: [600px            ]  │
└─────────────────────────────┘
```

**Type:**
- Name: `meterDetailsModal`
- Title: `Meter Details`
- Check: ☑ Hidden by default

---

### Step 3: Add Components Inside Modal

**Inside the modal body, add these components:**

#### Component A: Meter ID Header

**CLICK:** Inside modal → + (plus icon) → Text

**Inspector settings:**
```
┌─────────────────────────────┐
│ Text                        │
├─────────────────────────────┤
│ Value:                      │
│ ┌─────────────────────────┐ │
│ │ Meter ID: {{          │ │
│ │ selectedMeter.value?. │ │
│ │ meterId ?? "—"        │ │
│ │ }}                    │ │
│ └─────────────────────────┘ │
│                             │
│ Font size: [18px         ]  │
│ Font weight: [Bold       ]  │
│ Color: [#60a5fa          ]  │
└─────────────────────────────┘
```

**Copy this into Value:**
```javascript
{{ selectedMeter.value?.meterId ?? selectedMeter.value?.meter_id ?? "—" }}
```

---

#### Component B: Health Score

**CLICK:** + → Statistic (or Text)

**Inspector:**
```
Label: Health Score
Value: {{ selectedMeter.value?.score ?? "—" }}
```

---

#### Component C: Health Band

**CLICK:** + → Badge (or Text)

**Inspector:**
```
Text: {{ selectedMeter.value?.band ?? "—" }}
```

---

#### Component D: Issues List

**CLICK:** + → Text

**Inspector - Value field:**
```javascript
{{ 
  selectedMeter.value?.issues?.map(i => 
    (i.code || i.msg)
  ).join(", ") ?? "No issues"
}}
```

---

#### Component E: JSON Viewer

**CLICK:** + → JSON Editor (or Code Editor)

**Inspector:**
```
Data: {{ selectedMeter.value }}
Mode: View only
```

---

### Step 4: Create Enhancement Transformer

**CLICK PATH:** Code (bottom tab) → + (New) → Transformer

**What you'll see:**
```
┌─────────────────────────────────────┐
│ New JavaScript Transformer          │
├─────────────────────────────────────┤
│ Name: [selectedMeterDetails      ]  │
│                                     │
│ Code:                               │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │ // Your code here               │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Cancel]            [Save & Run]    │
└─────────────────────────────────────┘
```

**Name:** `selectedMeterDetails`

**Paste this code:**
```javascript
const row = selectedMeter.value;
const meters = IQOverview.data?.meters || IQOverview.data?.atRiskMeters || [];
if (!row) return null;
const id = row.meterId ?? row.meter_id;
const found = meters.find(m => (m.meterId ?? m.meter_id) === id);
return found || row;
```

**Click:** `Save & Run`

---

### Step 5: Add Row Click Handler to Table

**FIND YOUR TABLE:**

Look in left panel Component Tree for:
- `atRiskTable` or
- `table1` or
- `metersTable` or similar

**CLICK:** The table component

**In Inspector, scroll to Event Handlers section:**

```
┌──────────────────────────────────┐
│ Event handlers                   │
├──────────────────────────────────┤
│ + Add event handler              │
│                                  │
│ No event handlers yet            │
└──────────────────────────────────┘
```

**CLICK:** `+ Add event handler`

**Configure:**
```
┌──────────────────────────────────┐
│ Event: [Row click            ▼]  │
│                                  │
│ Action 1:                        │
│ [Set temporary state         ▼]  │
│ State: selectedMeter             │
│ Value: {{ currentRow }}          │
│                                  │
│ + Add action                     │
└──────────────────────────────────┘
```

**CLICK:** `+ Add action`

```
┌──────────────────────────────────┐
│ Action 2:                        │
│ [Control component           ▼]  │
│ Component: meterDetailsModal     │
│ Method: [Open                ▼]  │
└──────────────────────────────────┘
```

**CLICK:** `Save` or click away

---

### ✅ TEST FEATURE 1

**CLICK:** Any row in your table

**Expected result:**
```
Modal opens showing:
┌────────────────────────────────┐
│ Meter Details           [X]    │
├────────────────────────────────┤
│ Meter ID: MTR-1001             │
│                                │
│ Health Score: 85               │
│ Band: Good                     │
│                                │
│ Issues: ami_comm_trouble,      │
│         read_gap               │
│                                │
│ { "meterId": "MTR-1001", ... } │
└────────────────────────────────┘
```

✅ **Feature 1 Complete!**

---

## 📈 FEATURE 2: ALERT CARDS (5 minutes)

### Step 1: Create Transformer

**CLICK:** Code → + New → Transformer

**Name:** `alertCounts`

**Code:**
```javascript
const m = IQOverview.data?.meters || [];
let critical=0, warning=0, healthy=0;
m.forEach(x=>{
  const b=(x.band||"").toLowerCase();
  if(b==="critical") critical++;
  else if(b==="poor"||b==="warning"||b==="fair") warning++;
  else healthy++;
});
return { critical, warning, healthy };
```

---

### Step 2: Add Statistic Components

**VISUAL LAYOUT:** You want this at the top:

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│ 🔴 CRITICAL│  │ 🟡 WARNING │  │ 🟢 HEALTHY │
│     2      │  │     5      │  │     18     │
└────────────┘  └────────────┘  └────────────┘
```

**CLICK:** Components → Search "Statistic" → Drag 3 to canvas

**Card 1 Inspector:**
```
┌─────────────────────────────┐
│ Statistic                   │
├─────────────────────────────┤
│ Name: [criticalCard       ] │
│                             │
│ Label: [Critical Meters   ] │
│                             │
│ Value:                      │
│ {{ alertCounts.value.     │
│    critical }}              │
│                             │
│ Primary color: [#ff4444   ] │
│ Background: [#2d1b1b      ] │
└─────────────────────────────┘
```

**Card 2 Inspector:**
```
Name: warningCard
Label: Warning Meters
Value: {{ alertCounts.value.warning }}
Primary color: #ffaa00
Background: #2d2416
```

**Card 3 Inspector:**
```
Name: goodCard
Label: Healthy Meters
Value: {{ alertCounts.value.healthy }}
Primary color: #00ff88
Background: #1b2d1b
```

---

### Step 3: Arrange in Container

**CLICK:** Drag a Container to top of canvas

**DRAG:** All 3 stat cards into the container

**Container Inspector:**
```
Layout direction: Horizontal
Distribution: Space evenly
Padding: 20px
Gap: 15px
```

✅ **Feature 2 Complete!**

---

## 🔍 FEATURE 3: SEARCH BAR (10 minutes)

### Step 1: Add Search Input

**CLICK:** Components → Text Input → Drag to top

**Inspector:**
```
┌─────────────────────────────┐
│ Text Input                  │
├─────────────────────────────┤
│ Name: [meterSearchInput   ] │
│                             │
│ Label: [Search Meters     ] │
│                             │
│ Placeholder:                │
│ [Enter meter ID...        ] │
│                             │
│ Icon left: [🔍 search     ] │
│                             │
│ Default value: [""]         │
└─────────────────────────────┘
```

---

### Step 2: Create Filter Transformers

**Create 3 transformers:**

#### Transformer 1:

**Name:** `filteredAtRiskMeters`

**Code:**
```javascript
const rows = IQOverview.data?.atRiskMeters || [];
const q = (meterSearchInput.value || "").toLowerCase();
return !q ? rows : rows.filter(r => 
  String(r.meterId ?? r.meter_id).toLowerCase().includes(q)
);
```

#### Transformer 2:

**Name:** `filteredWorst10Health`

**Code:**
```javascript
const rows = worst10Health.value || [];
const q = (meterSearchInput.value || "").toLowerCase();
return !q ? rows : rows.filter(r => 
  String(r.meterId ?? r.meter_id).toLowerCase().includes(q)
);
```

#### Transformer 3:

**Name:** `filteredWorst10Billing`

**Code:**
```javascript
const rows = worst10Billing.value || [];
const q = (meterSearchInput.value || "").toLowerCase();
return !q ? rows : rows.filter(r => 
  String(r.meterId ?? r.meter_id).toLowerCase().includes(q)
);
```

---

### Step 3: Rebind Tables

**CLICK:** Your At-Risk table

**Inspector → Data source field:**

```
BEFORE: {{ IQOverview.data.atRiskMeters }}
AFTER:  {{ filteredAtRiskMeters.value }}
```

**Repeat for other tables:**
- Worst10Health table → `{{ filteredWorst10Health.value }}`
- Worst10Billing table → `{{ filteredWorst10Billing.value }}`

✅ **Feature 3 Complete!**

**TEST:** Type "MTR-1001" in search box → tables filter instantly

---

## ⏱️ FEATURE 4: AUTO-REFRESH (5 minutes)

### Step 1: Add Toggle

**CLICK:** Components → Switch → Drag to toolbar area

**Inspector:**
```
Name: autoRefreshToggle
Label: Auto-Refresh
Default value: false
```

---

### Step 2: Add Dropdown

**CLICK:** Components → Select → Drag next to toggle

**Inspector:**
```
┌─────────────────────────────┐
│ Select                      │
├─────────────────────────────┤
│ Name: [refreshIntervalSelect]│
│                             │
│ Label: [Interval          ] │
│                             │
│ Options:                    │
│ Manual                      │
│                             │
│ Option 1:                   │
│ Label: [30 seconds        ] │
│ Value: [30s               ] │
│                             │
│ Option 2:                   │
│ Label: [1 minute          ] │
│ Value: [1m                ] │
│                             │
│ Option 3:                   │
│ Label: [5 minutes         ] │
│ Value: [5m                ] │
│                             │
│ Option 4:                   │
│ Label: [15 minutes        ] │
│ Value: [15m               ] │
│                             │
│ Default: [5m              ] │
└─────────────────────────────┘
```

---

### Step 3: Create Controller Query

**CLICK:** Code → + New → JavaScript Query

**Name:** `autoRefreshController`

**Code:**
```javascript
const enabled = autoRefreshToggle.value;
const map = {"30s":30000,"1m":60000,"5m":300000,"15m":900000};
const ms = map[refreshIntervalSelect.value] || 300000;

if (enabled) {
  utils.setInterval(() => IQOverview.trigger(), ms, "iq_auto");
  return `Auto-refresh enabled: every ${refreshIntervalSelect.value}`;
} else {
  utils.clearInterval("iq_auto");
  return "Auto-refresh disabled";
}
```

---

### Step 4: Add Event Handlers

**CLICK:** `autoRefreshToggle` component

**Inspector → Event Handlers:**
```
Event: Change
Action: Run query
Query: autoRefreshController
```

**CLICK:** `refreshIntervalSelect` component

**Inspector → Event Handlers:**
```
Event: Change
Action: Run query
Query: autoRefreshController
```

✅ **Feature 4 Complete!**

**TEST:** Toggle ON → wait 30s → see data refresh

---

## 📊 FEATURE 5: WORST 10 TABLES (15 minutes)

### Step 1: Create Transformers

**Transformer 1:**

**Name:** `worst10Health`

**Code:**
```javascript
const m = IQOverview.data?.meters || [];
return [...m]
  .sort((a,b) => (a.score ?? 999) - (b.score ?? 999))
  .slice(0, 10);
```

**Transformer 2:**

**Name:** `worst10Billing`

**Code:**
```javascript
const m = IQOverview.data?.meters || [];
return [...m]
  .sort((a,b) => 
    (b.flagCount ?? b.flags?.length ?? 0) - 
    (a.flagCount ?? a.flags?.length ?? 0)
  )
  .slice(0, 10);
```

---

### Step 2: Add Table Components

**VISUAL LAYOUT:**

```
┌────────────────────────────────────────┐
│ Worst 10 Health Meters                 │
├────────────┬──────┬──────┬─────────────┤
│ Meter ID   │Score │ Band │ Issues      │
├────────────┼──────┼──────┼─────────────┤
│ MTR-1003   │  60  │ Fair │ missing_... │
│ MTR-1001   │  85  │ Good │ ami_comm... │
└────────────┴──────┴──────┴─────────────┘

┌────────────────────────────────────────┐
│ Worst 10 Billing Risk Meters           │
├────────────┬──────────┬────────────────┤
│ Meter ID   │Flag Count│ Flags          │
├────────────┼──────────┼────────────────┤
│ MTR-1001   │    2     │ ami_event_...  │
│ MTR-1002   │    2     │ ami_event_...  │
└────────────┴──────────┴────────────────┘
```

**CLICK:** Components → Table → Drag to canvas

**Table 1 Inspector:**
```
Name: worst10HealthTable
Data: {{ worst10Health.value }}

Columns:
- meterId (Meter ID)
- score (Health Score) - Number format
- band (Band) - Colored badge
- issues (Issues) - Display as list
```

**Table 2 Inspector:**
```
Name: worst10BillingTable
Data: {{ worst10Billing.value }}

Columns:
- meterId (Meter ID)
- flagCount (Flags)
- flags (Details)
```

---

### Step 3: Add Row Click Handlers

**For BOTH new tables:**

**Event Handlers:**
```
Event: Row click
Action 1: Set temp state → selectedMeter = {{ currentRow }}
Action 2: Control component → meterDetailsModal.open()
```

✅ **Feature 5 Complete!**

---

## 📥 FEATURE 6: CSV EXPORT (10 minutes)

### Visual: Where to Add Buttons

```
┌─────────────────────────────────────────┐
│ At-Risk Meters        [📥 Download CSV] │
├─────────────────────────────────────────┤
│ Table content...                        │
└─────────────────────────────────────────┘
```

**For EACH table, add export button:**

---

### Add Button Above Table

**CLICK:** Components → Button → Drag above table

**Inspector:**
```
┌─────────────────────────────┐
│ Button                      │
├─────────────────────────────┤
│ Text: [📥 Download CSV    ] │
│                             │
│ Style: Secondary            │
│                             │
│ Event handlers:             │
│ Click → Download data       │
│                             │
│ Data: {{ table1.data }}     │
│ Filename: at-risk-meters.csv│
│ Type: CSV                   │
└─────────────────────────────┘
```

**Create 5 buttons total:**

1. **At-Risk Table:**
   - Data: `{{ atRiskTable.data }}`
   - Filename: `at-risk-meters.csv`

2. **Risk Map Table:**
   - Data: `{{ riskMapTable.data }}`
   - Filename: `risk-map.csv`

3. **Worst 10 Health:**
   - Data: `{{ worst10HealthTable.data }}`
   - Filename: `worst-10-health.csv`

4. **Worst 10 Billing:**
   - Data: `{{ worst10BillingTable.data }}`
   - Filename: `worst-10-billing.csv`

5. **Billing Flags Table:**
   - Data: `{{ billingFlagsTable.data }}`
   - Filename: `billing-flags.csv`

✅ **Feature 6 Complete!**

---

## 🎨 FEATURE 7: BRAND HEADER (5 minutes)

### Visual Layout:

```
┌──────────────────────────────────────────────┐
│  [Logo]  GridLens Smart MeterIQ™ Dashboard   │
│          Modernizing the Grid Through Data   │
└──────────────────────────────────────────────┘
```

---

### Step 1: Add Container

**CLICK:** Components → Container → Drag to very top

**Inspector:**
```
Name: brandHeader
Layout: Horizontal
Align items: Center
Padding: 20px
Background: #0f172a
Border bottom: 2px solid #60a5fa
```

---

### Step 2: Add Logo

**Inside container, CLICK:** + → Image

**Inspector:**
```
Name: gridlensLogo
Source: https://via.placeholder.com/60x60/60a5fa/ffffff?text=GL
Width: 60px
Height: 60px
```

---

### Step 3: Add Title Text

**Inside container, CLICK:** + → Text

**Inspector - Value (enable HTML):**
```html
<div style="padding-left: 15px;">
  <h1 style="color: #60a5fa; font-size: 28px; font-weight: 700; margin: 0;">
    ⚡ GridLens Smart MeterIQ™
  </h1>
  <p style="color: #94a3b8; font-size: 14px; margin: 5px 0 0 0;">
    Modernizing the Grid Through Data
  </p>
</div>
```

✅ **Feature 7 Complete!**

---

## ✅ FINAL LAYOUT

Your dashboard should now look like:

```
┌──────────────────────────────────────────────────┐
│ ⚡ GridLens Smart MeterIQ™                       │
│ Modernizing the Grid Through Data                │
├──────────────────────────────────────────────────┤
│ 🔴 Critical: 0  🟡 Warning: 1  🟢 Healthy: 2    │
├──────────────────────────────────────────────────┤
│ [Search: ___________] [Auto-Refresh ◻] [5m ▼]   │
├──────────────────────────────────────────────────┤
│ At-Risk Meters                 [📥 Download CSV] │
│ ┌──────────────────────────────────────────────┐ │
│ │ MTR-1003 │ 60  │ Fair │ missing_reads       │ │
│ └──────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│ Worst 10 Health                [📥 Download CSV] │
│ ┌──────────────────────────────────────────────┐ │
│ │ MTR-1003 │ 60  │ Fair │                      │ │
│ └──────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│ Worst 10 Billing Risk          [📥 Download CSV] │
│ ┌──────────────────────────────────────────────┐ │
│ │ MTR-1001 │  2  │ ami_event_risk, read_gap    │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## 🧪 FINAL TESTING CHECKLIST

Test each feature:

```
☐ Click meter row → modal opens with details
☐ Close modal → works
☐ Type in search → tables filter
☐ Clear search → tables reset
☐ Toggle auto-refresh ON → data refreshes
☐ Change interval → refresh rate changes
☐ Click export CSV → file downloads
☐ Open CSV in Excel → data looks correct
☐ Alert cards show correct numbers
☐ Worst 10 tables show correct data
☐ Brand header displays properly
```

---

## 🎯 YOU'RE DONE!

All 8 features implemented! 🎉

**Total Time:** ~60 minutes

**Components Added:** 25+

**Your dashboard is now production-ready!**

---

## 🆘 QUICK TROUBLESHOOTING

**Can't find component in tree?**
→ Use search box at top of component panel

**Transformer not running?**
→ Check dependencies tab, make sure it's set to auto-run

**Table not updating?**
→ Make sure data binding uses correct syntax: `{{ transformerName.value }}`

**Modal won't open?**
→ Check event handler has 2 actions (set state + open modal)

**Export button doesn't work?**
→ Use `.data` not `.value` for tables

---

*Visual Walkthrough for GridLens Smart MeterIQ Dashboard*

# GridLens Smart MeterIQ - Retool Enhancement Guide
## Complete Implementation for 7 New Features

**API Endpoint:** `GET https://your-replit-url.replit.dev/dashboard/overview`
**Existing Query Name:** `IQOverview`

This guide provides copy-paste ready code for all transformers, components, and bindings.

---

## 📋 IMPLEMENTATION CHECKLIST

- [ ] Section 1: Sparkline Trends
- [ ] Section 2: Worst 10 Tables
- [ ] Section 3: Alert Cards
- [ ] Section 4: Meter Search Bar
- [ ] Section 5: Auto-Refresh Settings
- [ ] Section 6: Export CSV Buttons
- [ ] Section 7: Brand Header

---

## 1️⃣ SPARKLINE TRENDS (Per Meter)

Since your API doesn't include historical trend data, we'll create synthetic sparklines based on current meter health scores and issues.

### Step 1.1: Create Transformer `meterTrendSeries`

**Location:** Transformers → New JavaScript Transformer

**Name:** `meterTrendSeries`

**Code:**
```javascript
// Generate synthetic sparkline data based on meter health and issues
const worstMeters = IQOverview.data?.health?.worstMeters || [];
const atRiskMeters = IQOverview.data?.atRisk?.meters || [];
const allMeters = [...worstMeters, ...atRiskMeters];

return allMeters.map(m => {
  const meterId = m.meterId || m.meter_id || 'UNKNOWN';
  const score = m.score || 0;
  const issueCount = (m.issues || []).length;
  
  // Generate synthetic trend (simulating last 7 data points)
  // Trend shows degradation from healthy to current state
  const series = [];
  const degradationRate = (100 - score) / 7;
  
  for (let i = 0; i < 7; i++) {
    const point = Math.max(0, Math.min(100, 100 - (degradationRate * i) + (Math.random() * 5 - 2.5)));
    series.push(Math.round(point));
  }
  
  return { 
    meterId, 
    series: series.reverse() // Show chronological order
  };
});
```

### Step 1.2: Add Sparkline to Existing Tables

**For "At-Risk Meters" Table:**

1. Click the table component
2. Add new column: Click "+" or "Columns" tab
3. Column settings:
   - **Column Name:** `Trend`
   - **Column Type:** `Custom` or `Text` (we'll use an inline chart)
   - **Cell Value:**
   ```javascript
   {{ 
     const meterId = currentRow.meterId || currentRow.meter_id;
     const trendData = meterTrendSeries.value.find(t => t.meterId === meterId);
     return trendData ? trendData.series.join(',') : '—';
   }}
   ```
4. Position: After "Issues" column
5. Width: 100px

**Alternative: Use Mini Line Chart (if available)**
- Column Type: `Chart` or `Sparkline`
- Data: `{{ meterTrendSeries.value.find(t => t.meterId === (currentRow.meterId || currentRow.meter_id))?.series || [] }}`

---

## 2️⃣ WORST 10 TABLES

### Step 2.1: Create Transformer `worst10Health`

**Name:** `worst10Health`

**Code:**
```javascript
const worstMeters = IQOverview.data?.health?.worstMeters || [];
const atRiskMeters = IQOverview.data?.atRisk?.meters || [];
const allMeters = [...worstMeters, ...atRiskMeters];

// Remove duplicates by meterId
const uniqueMeters = Array.from(
  new Map(allMeters.map(m => [m.meterId || m.meter_id, m])).values()
);

// Sort by score (lowest first) and take top 10
return uniqueMeters
  .sort((a, b) => (a.score || 999) - (b.score || 999))
  .slice(0, 10)
  .map(m => ({
    meterId: m.meterId || m.meter_id,
    score: m.score || 0,
    band: m.band || 'unknown',
    type: m.type || 'N/A',
    status: m.status || 'unknown',
    issueCount: (m.issues || []).length,
    issues: (m.issues || []).map(i => i.code || i.msg).join(', ')
  }));
```

### Step 2.2: Create Transformer `worst10Billing`

**Name:** `worst10Billing`

**Code:**
```javascript
const billingWorst = IQOverview.data?.billing?.worstMeters || [];

return billingWorst
  .slice(0, 10)
  .map(m => ({
    meterId: m.meterId || m.meter_id,
    flagCount: m.flagCount || (m.flags || []).length,
    flags: (m.flags || []).map(f => f.code || f.msg).join(', '),
    severity: (m.flags || []).some(f => (f.level || f.severity) === 'high') ? 'high' : 'medium'
  }));
```

### Step 2.3: Create Table Components

**Table 1: Worst 10 Health Meters**

1. Add new **Table** component
2. Component settings:
   - **Name:** `worst10HealthTable`
   - **Data Source:** `{{ worst10Health.value }}`
   - **Columns:**
     - `meterId` (Meter ID)
     - `score` (Health Score) - Number format, 0 decimals
     - `band` (Band) - Add conditional colors:
       - critical: red
       - poor: orange
       - fair: yellow
       - good: green
     - `issueCount` (Issues)
     - `issues` (Details) - Wrap text
     - `Trend` (see Section 1.2 for sparkline)

3. **Styling:**
   - Background: Dark (`#1a1a2e`)
   - Header: White text
   - Row hover: Subtle highlight

**Table 2: Worst 10 Billing Risk Meters**

1. Add new **Table** component
2. Component settings:
   - **Name:** `worst10BillingTable`
   - **Data Source:** `{{ worst10Billing.value }}`
   - **Columns:**
     - `meterId` (Meter ID)
     - `flagCount` (Flag Count) - Number format
     - `flags` (Flags) - Wrap text
     - `severity` (Severity) - Conditional colors (high=red, medium=orange)

3. **Layout:** Place below `worst10HealthTable`

---

## 3️⃣ ALERT CARDS (Critical / Warning / Good)

### Step 3.1: Create Transformer `alertCounts`

**Name:** `alertCounts`

**Code:**
```javascript
const worstMeters = IQOverview.data?.health?.worstMeters || [];
const bandCounts = IQOverview.data?.health?.bandCounts || {};

// Use existing band counts if available
const critical = bandCounts.critical || 0;
const poor = bandCounts.poor || 0;
const fair = bandCounts.fair || 0;
const good = bandCounts.good || 0;
const excellent = bandCounts.excellent || 0;

return {
  critical: critical,
  warning: poor + fair,
  good: good + excellent
};
```

### Step 3.2: Add Stat Card Components

**Position:** Top of dashboard, in a horizontal container

**Card 1: Critical**

1. Add **Statistic** component
2. Settings:
   - **Name:** `criticalCard`
   - **Label:** `Critical Meters`
   - **Value:** `{{ alertCounts.value.critical }}`
   - **Icon:** `exclamation-triangle` (or warning icon)
   - **Color/Style:**
     - Background: `#2d1b1b` (dark red tint)
     - Text color: `#ff4444` (bright red)
     - Border: `2px solid #ff4444`
   - **Size:** Large

**Card 2: Warning**

1. Add **Statistic** component
2. Settings:
   - **Name:** `warningCard`
   - **Label:** `Warning Meters`
   - **Value:** `{{ alertCounts.value.warning }}`
   - **Icon:** `exclamation-circle`
   - **Color/Style:**
     - Background: `#2d2416` (dark orange tint)
     - Text color: `#ffaa00` (orange)
     - Border: `2px solid #ffaa00`

**Card 3: Healthy**

1. Add **Statistic** component
2. Settings:
   - **Name:** `goodCard`
   - **Label:** `Healthy Meters`
   - **Value:** `{{ alertCounts.value.good }}`
   - **Icon:** `check-circle`
   - **Color/Style:**
     - Background: `#1b2d1b` (dark green tint)
     - Text color: `#00ff88` (bright green)
     - Border: `2px solid #00ff88`

**Layout:** Use a **Container** with horizontal layout, distribute cards evenly.

---

## 4️⃣ METER SEARCH BAR

### Step 4.1: Add Search Input

1. Add **Text Input** component at top of dashboard
2. Settings:
   - **Name:** `meterSearchInput`
   - **Label:** `Search Meters`
   - **Placeholder:** `Enter meter ID to filter...`
   - **Icon:** `search`
   - **Initial Value:** `""` (empty)
   - **Style:** Dark theme, prominent placement

### Step 4.2: Create Filtered Transformers

**Transformer 1: `filteredAtRiskMeters`**

```javascript
const rows = IQOverview.data?.atRisk?.meters || [];
const query = (meterSearchInput.value || "").toLowerCase().trim();

if (!query) return rows;

return rows.filter(r => {
  const meterId = String(r.meterId || r.meter_id || "").toLowerCase();
  return meterId.includes(query);
});
```

**Transformer 2: `filteredWorst10Health`**

```javascript
const rows = worst10Health.value || [];
const query = (meterSearchInput.value || "").toLowerCase().trim();

if (!query) return rows;

return rows.filter(r => {
  const meterId = String(r.meterId || "").toLowerCase();
  return meterId.includes(query);
});
```

**Transformer 3: `filteredWorst10Billing`**

```javascript
const rows = worst10Billing.value || [];
const query = (meterSearchInput.value || "").toLowerCase().trim();

if (!query) return rows;

return rows.filter(r => {
  const meterId = String(r.meterId || "").toLowerCase();
  return meterId.includes(query);
});
```

### Step 4.3: Rebind Table Data Sources

**Update these tables:**

1. **At-Risk Meters Table**
   - Data: Change from `{{ IQOverview.data.atRisk.meters }}` to `{{ filteredAtRiskMeters.value }}`

2. **worst10HealthTable**
   - Data: Change to `{{ filteredWorst10Health.value }}`

3. **worst10BillingTable**
   - Data: Change to `{{ filteredWorst10Billing.value }}`

---

## 5️⃣ AUTO-REFRESH SETTINGS

### Step 5.1: Add Toggle Switch

1. Add **Switch** component
2. Settings:
   - **Name:** `autoRefreshToggle`
   - **Label:** `Auto-Refresh`
   - **Default Value:** `false`
   - **Placement:** Top toolbar area

### Step 5.2: Add Interval Selector

1. Add **Select** component
2. Settings:
   - **Name:** `refreshIntervalSelect`
   - **Label:** `Interval`
   - **Options:** Manual input
     ```json
     [
       { "label": "30 seconds", "value": "30s" },
       { "label": "1 minute", "value": "1m" },
       { "label": "5 minutes", "value": "5m" },
       { "label": "15 minutes", "value": "15m" }
     ]
     ```
   - **Default Value:** `5m`
   - **Placement:** Next to toggle switch

### Step 5.3: Create Auto-Refresh Controller

**Add JS Query:**

1. Create new **JavaScript Query**
2. Settings:
   - **Name:** `autoRefreshController`
   - **Code:**
   ```javascript
   const enabled = autoRefreshToggle.value;
   const intervalMap = { 
     "30s": 30000, 
     "1m": 60000, 
     "5m": 300000, 
     "15m": 900000 
   };
   const intervalLabel = refreshIntervalSelect.value || "5m";
   const intervalMs = intervalMap[intervalLabel];

   if (enabled) {
     utils.setInterval(
       () => { IQOverview.trigger(); }, 
       intervalMs, 
       "iq_auto_refresh"
     );
     return `Auto-refresh enabled: ${intervalLabel}`;
   } else {
     utils.clearInterval("iq_auto_refresh");
     return "Auto-refresh disabled";
   }
   ```

### Step 5.4: Add Event Handlers

**On `autoRefreshToggle`:**
- Event: `Change`
- Action: `Trigger query` → `autoRefreshController`

**On `refreshIntervalSelect`:**
- Event: `Change`
- Action: `Trigger query` → `autoRefreshController`

---

## 6️⃣ EXPORT TO CSV BUTTONS

Add export buttons for each major table. Retool makes this easy with built-in functionality.

### Export Buttons to Add:

**For each table, add a Button in the table's toolbar:**

**Button 1: Export At-Risk Meters**
- Component: **Button**
- Name: `exportAtRiskBtn`
- Label: `📥 Export CSV`
- Position: At-Risk Meters table toolbar
- On Click:
  ```javascript
  utils.downloadFile({
    data: filteredAtRiskMeters.value,
    type: 'csv',
    filename: 'gridlens-at-risk-meters.csv'
  });
  ```

**Button 2: Export Risk Map**
- Name: `exportRiskMapBtn`
- Label: `📥 Export CSV`
- Position: Risk Map table toolbar
- On Click:
  ```javascript
  const data = IQOverview.data?.riskMap?.buckets || [];
  utils.downloadFile({
    data: data,
    type: 'csv',
    filename: 'gridlens-risk-map.csv'
  });
  ```

**Button 3: Export Billing Flags**
- Name: `exportBillingFlagsBtn`
- Label: `📥 Export CSV`
- Position: Billing flags table toolbar
- On Click:
  ```javascript
  const data = IQOverview.data?.billing?.topFlags || [];
  utils.downloadFile({
    data: data,
    type: 'csv',
    filename: 'gridlens-billing-flags.csv'
  });
  ```

**Button 4: Export Worst 10 Health**
- Name: `exportWorst10HealthBtn`
- Label: `📥 Export CSV`
- Position: worst10HealthTable toolbar
- On Click:
  ```javascript
  utils.downloadFile({
    data: filteredWorst10Health.value,
    type: 'csv',
    filename: 'gridlens-worst-10-health.csv'
  });
  ```

**Button 5: Export Worst 10 Billing**
- Name: `exportWorst10BillingBtn`
- Label: `📥 Export CSV`
- Position: worst10BillingTable toolbar
- On Click:
  ```javascript
  utils.downloadFile({
    data: filteredWorst10Billing.value,
    type: 'csv',
    filename: 'gridlens-worst-10-billing.csv'
  });
  ```

---

## 7️⃣ GRIDLENS BRAND HEADER / LOGO

### Step 7.1: Create Header Container

1. Add **Container** component at very top
2. Settings:
   - **Name:** `brandHeader`
   - **Layout:** Horizontal
   - **Background:** `#0f172a` (dark blue-gray)
   - **Padding:** 20px
   - **Border Bottom:** `2px solid #60a5fa` (blue accent)

### Step 7.2: Add Logo Component

**Inside `brandHeader` container:**

1. Add **Image** component
2. Settings:
   - **Name:** `gridlensLogo`
   - **Source:** Use placeholder or upload your logo
   - **Placeholder URL (if no logo):**
     ```
     https://via.placeholder.com/60x60/60a5fa/ffffff?text=GL
     ```
   - **Width:** 60px
   - **Height:** 60px
   - **Alignment:** Left

### Step 7.3: Add Title Text

**Inside `brandHeader` container, next to logo:**

1. Add **Text** component
2. Settings:
   - **Name:** `gridlensTitle`
   - **Content:**
   ```html
   <div style="padding-left: 15px;">
     <h1 style="color: #60a5fa; font-size: 28px; font-weight: 700; margin: 0; letter-spacing: -0.5px;">
       ⚡ GridLens Smart MeterIQ™
     </h1>
     <p style="color: #94a3b8; font-size: 14px; margin: 5px 0 0 0; font-weight: 400;">
       Modernizing the Grid Through Data
     </p>
   </div>
   ```
   - **Allow HTML:** Enable (if available)
   - **Alignment:** Left

### Step 7.4: Add Status Badge (Optional)

**Inside `brandHeader` container, right side:**

1. Add **Badge** or **Text** component
2. Settings:
   - **Name:** `systemStatus`
   - **Content:** `🟢 System Online`
   - **Color:** Green
   - **Alignment:** Right

---

## 🎨 DARK THEME COLOR PALETTE

Use these colors for consistency:

```javascript
const gridlensTheme = {
  background: {
    primary: '#0f172a',
    secondary: '#1e293b',
    card: '#1a1a2e'
  },
  text: {
    primary: '#e2e8f0',
    secondary: '#94a3b8',
    muted: '#64748b'
  },
  accent: {
    blue: '#60a5fa',
    green: '#00ff88',
    yellow: '#ffaa00',
    red: '#ff4444',
    orange: '#ff7744'
  },
  borders: {
    subtle: '#334155',
    accent: '#60a5fa'
  }
};
```

Apply to:
- Container backgrounds
- Table headers
- Card borders
- Button colors

---

## ✅ FINAL VALIDATION CHECKLIST

After implementing all sections:

- [ ] **IQOverview query** still runs without errors
- [ ] **Alert cards** show correct counts (critical/warning/good)
- [ ] **Search bar** filters all 3 tables correctly
- [ ] **Worst 10 tables** display and sort correctly
- [ ] **Auto-refresh** toggle works (check console for interval logs)
- [ ] **Export buttons** download valid CSV files
- [ ] **Brand header** displays with logo and title
- [ ] **Sparklines** appear in tables (even if synthetic)
- [ ] **Dark theme** is consistent across all components
- [ ] **No console errors** in browser dev tools
- [ ] **Responsive layout** works on different screen sizes

---

## 🔧 TROUBLESHOOTING

### Issue: "Cannot read property 'meters' of undefined"

**Fix:** Add null checks in all transformers:
```javascript
const data = IQOverview.data?.health?.worstMeters || [];
```

### Issue: Auto-refresh not stopping

**Fix:** Manually clear interval:
```javascript
utils.clearInterval("iq_auto_refresh");
```

### Issue: Search not filtering

**Fix:** Ensure transformer dependencies are set correctly. Transformers should auto-run when `meterSearchInput` changes.

### Issue: Export button not working

**Fix:** Check data binding. Use:
```javascript
{{ tableName.data }}
```
Not:
```javascript
{{ tableName.value }}
```

---

## 📞 SUPPORT

If you encounter field name mismatches:
- Check actual API response in Retool's query inspector
- Update transformer code to match field names (e.g., `meter_id` vs `meterId`)
- All transformers include fallbacks: `m.meterId || m.meter_id`

**API Documentation:** See `RETOOL_DASHBOARD_SPEC.txt` for complete API reference

**GridLens API:** `https://your-url.replit.dev/dashboard/overview`

---

*Guide created for GridLens Smart MeterIQ MVP Dashboard v2.0*

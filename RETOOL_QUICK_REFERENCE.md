# GridLens Retool Enhancement - Quick Reference Card

## 🚀 IMPLEMENTATION ORDER (Recommended)

1. **Start Simple** → Alert Cards (Section 3) - 5 min
2. **Add Search** → Search Bar (Section 4) - 10 min  
3. **Create Tables** → Worst 10 Tables (Section 2) - 15 min
4. **Add Visuals** → Sparklines (Section 1) - 10 min
5. **Add Controls** → Auto-Refresh (Section 5) - 5 min
6. **Add Exports** → CSV Buttons (Section 6) - 10 min
7. **Finish Pretty** → Brand Header (Section 7) - 5 min

**Total Time:** ~60 minutes

---

## 📊 TRANSFORMERS TO CREATE (Copy-Paste Ready)

| Name | Purpose | Depends On |
|------|---------|------------|
| `alertCounts` | Critical/Warning/Good counts | IQOverview |
| `worst10Health` | Lowest 10 health scores | IQOverview |
| `worst10Billing` | Highest 10 billing flags | IQOverview |
| `meterTrendSeries` | Synthetic sparkline data | IQOverview |
| `filteredAtRiskMeters` | Search-filtered at-risk | IQOverview, meterSearchInput |
| `filteredWorst10Health` | Search-filtered health | worst10Health, meterSearchInput |
| `filteredWorst10Billing` | Search-filtered billing | worst10Billing, meterSearchInput |
| `autoRefreshController` | Auto-refresh logic | autoRefreshToggle, refreshIntervalSelect |

---

## 🎨 NEW COMPONENTS TO ADD

### Input Controls
- `meterSearchInput` - Text Input (search bar)
- `autoRefreshToggle` - Switch (enable auto-refresh)
- `refreshIntervalSelect` - Dropdown (30s, 1m, 5m, 15m)

### Display Components
- `criticalCard` - Statistic (red, critical count)
- `warningCard` - Statistic (orange, warning count)
- `goodCard` - Statistic (green, healthy count)
- `brandHeader` - Container (logo + title)
- `gridlensLogo` - Image (brand logo)
- `gridlensTitle` - Text (brand title)

### Tables
- `worst10HealthTable` - Table (lowest health scores)
- `worst10BillingTable` - Table (highest billing flags)

### Buttons (Export)
- `exportAtRiskBtn`
- `exportRiskMapBtn`
- `exportBillingFlagsBtn`
- `exportWorst10HealthBtn`
- `exportWorst10BillingBtn`

---

## 🔗 CRITICAL DATA BINDINGS TO UPDATE

### Existing Table Updates
```javascript
// At-Risk Meters Table
// OLD: {{ IQOverview.data.atRisk.meters }}
// NEW: {{ filteredAtRiskMeters.value }}
```

### New Table Bindings
```javascript
// worst10HealthTable
{{ filteredWorst10Health.value }}

// worst10BillingTable
{{ filteredWorst10Billing.value }}
```

### Alert Card Bindings
```javascript
// criticalCard value
{{ alertCounts.value.critical }}

// warningCard value
{{ alertCounts.value.warning }}

// goodCard value
{{ alertCounts.value.good }}
```

---

## 🎯 API RESPONSE STRUCTURE (Reference)

Your `/dashboard/overview` returns:

```json
{
  "health": {
    "meterCount": 3,
    "avgScore": 76.7,
    "bandCounts": {
      "excellent": 0,
      "good": 2,
      "fair": 1,
      "poor": 0,
      "critical": 0
    },
    "worstMeters": [
      {
        "meterId": "MTR-1003",
        "score": 60,
        "band": "fair",
        "type": "electric",
        "status": "inactive",
        "issues": [...]
      }
    ]
  },
  "atRisk": {
    "threshold": 60,
    "count": 0,
    "meters": []
  },
  "riskMap": {
    "groupBy": "city",
    "buckets": [...]
  },
  "billing": {
    "topFlags": [...],
    "worstMeters": [...]
  }
}
```

---

## ⚠️ COMMON PITFALLS TO AVOID

1. **Don't use `.data` on transformers**
   - ❌ `{{ worst10Health.data }}`
   - ✅ `{{ worst10Health.value }}`

2. **Always add null checks**
   - ❌ `IQOverview.data.health.worstMeters`
   - ✅ `IQOverview.data?.health?.worstMeters || []`

3. **Field name variations**
   - Use: `m.meterId || m.meter_id`
   - Covers both naming conventions

4. **Export uses `.data` not `.value`**
   - Tables: `{{ tableName.data }}`
   - Transformers in exports: `{{ transformerName.value }}`

5. **Auto-refresh interval naming**
   - Must be unique: `"iq_auto_refresh"`
   - Don't reuse interval names

---

## 🔍 TESTING CHECKLIST (5 min)

After implementation:

```bash
# Test 1: Search functionality
- Enter "MTR-1001" in search
- Verify tables filter correctly
- Clear search, verify tables reset

# Test 2: Alert cards
- Check critical count matches band counts
- Verify color coding (red/orange/green)

# Test 3: Auto-refresh
- Toggle ON, select 30s
- Wait 30s, check IQOverview re-runs
- Toggle OFF, verify it stops

# Test 4: CSV Export
- Click each export button
- Verify CSV downloads
- Open CSV, check data integrity

# Test 5: Worst 10 Tables
- Verify health table sorted by score (asc)
- Verify billing table sorted by flags (desc)
- Check for proper data display
```

---

## 💡 OPTIONAL ENHANCEMENTS

If you have extra time:

1. **Add tooltips** to alert cards explaining bands
2. **Add meter type filter** (electric/water dropdown)
3. **Add date range picker** for custom time windows
4. **Add click-to-drill-down** on meter rows (modal with details)
5. **Add real-time update indicator** (last refreshed timestamp)

---

## 📞 NEED HELP?

**Field Name Mismatches:**
Check your actual API response in Retool query inspector and update transformer code.

**Component Not Found:**
Component names may vary by Retool version. Use closest equivalent:
- Statistic → Metric/KPI Card
- Switch → Toggle
- Select → Dropdown

**Transformer Errors:**
All code includes defensive programming with `|| []` and `?.` operators.

---

## 🎨 DARK THEME COLORS (Copy-Paste)

```css
Background Primary:   #0f172a
Background Secondary: #1e293b
Card Background:      #1a1a2e

Text Primary:   #e2e8f0
Text Secondary: #94a3b8

Accent Blue:   #60a5fa
Accent Green:  #00ff88
Accent Yellow: #ffaa00
Accent Red:    #ff4444
Accent Orange: #ff7744

Border Subtle: #334155
Border Accent: #60a5fa
```

---

**Full Guide:** See `RETOOL_ENHANCEMENT_GUIDE.md` for detailed instructions

**API Docs:** See `RETOOL_DASHBOARD_SPEC.txt` for complete API reference

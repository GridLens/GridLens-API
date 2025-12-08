# GridLens Smart MeterIQ - Core API

## Overview
GridLens Smart MeterIQ is a utility meter monitoring and management system for Advanced Metering Infrastructure (AMI). It tracks electric and water meters across Mississippi, monitors meter events (outages, alarms), and provides real-time status updates with a billing integrity engine. This Core API provides REST endpoints for meter data retrieval, event management, and billing flag detection. The project uses a modular architecture with centralized mock data, designed for future PostgreSQL integration.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Technology Stack**: Node.js (ES Modules), Express.js 4.18.2, JavaScript (ES6+).
- **Port**: 5000 (webview-compatible).
- **Data Layer**: Centralized mock data in `data/mockDb.js` for rapid prototyping. Future plans include migration to PostgreSQL.

### Project Structure
```
gridlens-api/
├── index.js              # Main server file with middleware and router mounting
├── data/
│   └── mockDb.js         # Centralized in-memory mock database
├── routes/
│   ├── systemHealthRouter.js    # /api/kpi/system-health/*
│   ├── waterLeaksRouter.js      # /api/kpi/water-leaks/*
│   ├── electricUsageRouter.js   # /api/kpi/electric-usage/*
│   ├── energyLossRouter.js      # /api/kpi/energy-loss/*
│   ├── outagesRouter.js         # /api/kpi/outages/*
│   └── fieldOpsRouter.js        # /api/fieldops/*
└── public/               # Static files (dashboard)
```

### API Endpoints

#### System Health (Electric Fleet Summary)
- `GET /api/kpi/system-health/overview` - Fleet health metrics

#### Water Leaks & Loss
- `GET /api/kpi/water-leaks/overview` - Water loss summary
- `GET /api/kpi/water-leaks/candidates` - Leak candidates list

#### Electric Usage & Loss
- `GET /api/kpi/electric-usage/overview` - Usage summary
- `GET /api/kpi/electric-usage/trend` - 7-day usage trend
- `GET /api/kpi/electric-usage/zones` - Usage by zone
- `GET /api/kpi/electric-usage/top-loss-points` - Top loss meters

#### Energy Loss & Health (Electric)
- `GET /api/kpi/energy-loss/overview` - Energy loss overview
- `GET /api/kpi/energy-loss/feeders` - Feeder loss data
- `GET /api/kpi/energy-loss/suspicious-meters` - Suspicious meter list
- `GET /api/kpi/energy-loss/fieldops` - Field operations work orders

#### Events & Outages
- `GET /api/kpi/outages/overview` - Outage summary
- `GET /api/kpi/outages/active-outages` - Active outage list
- `GET /api/kpi/outages/reliability-30d` - 30-day reliability metrics
- `GET /api/kpi/outages/ami-events` - AMI event feed
- `GET /api/kpi/outages/critical-customers` - Critical customer status

#### FieldOps Queue
- `GET /api/fieldops/queue` - Work order queue
- `GET /api/fieldops/work-order/:id` - Individual work order detail

#### Legacy Endpoints
- **Health Check**: `GET /health`
- **Meter Management**: `GET /meters`, `GET /meter/:id`, `PATCH /meter/:id`
- **AMI Events**: `GET /ami/events`, `POST /ami/events`
- **Usage Data**: `GET /usage/:meter`, `POST /usage/:meter`, `POST /usage/:meter/bulk`
- **Billing Integrity Engine v2**: `GET /billing/flags`, `GET /billing/flags/:meterId`
- **Meter Health Index**: `GET /meter-health/score`, `GET /meter-health/score/:meterId`
- **Dashboard & Analytics**: `GET /meters/risk-map`, `GET /dashboard/overview`

### Billing Integrity Engine v2
Analyzes usage reads and AMI events using 7 detection rules: Missing Reads, Zero Usage, Impossible Spike, Negative Reads, Inactive Billing Risk, AMI Event Risk, Read Gap, and Flatline Usage.

### Meter Health Index
A proprietary 0-100 scoring system with 8 diagnostic rules, categorizing meters into 5 health bands: Excellent (90-100), Good (75-89), Fair (60-74), Poor (40-59), and Critical (0-39).

### Frontend Dashboard
A live interactive dashboard is served from `/public/dashboard.html` using `express.static`. It features real-time KPI cards, Chart.js visualizations, and interactive filters.

### Security
Write operations (POST, PATCH) require API key authentication via a Bearer token in the Authorization header. The API key is stored as `GRIDLENS_API_KEY` in the Replit environment. Read operations are publicly accessible.

## External Dependencies

### Runtime Dependencies
- **Express.js (^4.18.2)**: HTTP server and routing framework.
- **dotenv (^16.3.1)**: Environment variable management.
- **cors**: Cross-origin resource sharing.
- **nodemailer**: Email notifications.

### Planned Dependencies
- **PostgreSQL Client - pg (^8.11.0)**: For future database integration.

### External Services
- **AMI Network Integration**: Designed for future integration with Advanced Metering Infrastructure networks for real-time data and events.

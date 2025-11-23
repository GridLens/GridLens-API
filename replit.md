# GridLens Smart MeterIQ - Core API

## Overview

GridLens Smart MeterIQ is a utility meter monitoring and management system designed for Advanced Metering Infrastructure (AMI). The system tracks electric and water meters across Mississippi locations, monitors meter events (such as outages and alarms), and provides real-time status updates with a billing integrity engine. This Core API serves as the backend service exposing REST endpoints for meter data retrieval, event management, and billing flag detection.

**Last Updated**: November 23, 2025

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture

**Technology Stack**
- **Runtime**: Node.js with ES Modules (type: "module")
- **Framework**: Express.js 4.18.2 for REST API
- **Language**: JavaScript (ES6+)
- **Port**: 5000 (webview-compatible)

**Current Data Layer**
The system uses in-memory data structures for MVP development. Three primary data entities exist:
- **Meters**: Store meter identification, status (active/inactive), type (electric/water), last readings (kWh or gallons), timestamps, and location data (city, state)
- **AMI Events**: Track meter-related events with severity levels and occurrence timestamps
- **Usage Reads**: Hourly consumption data for meters (kWh for electric, gallons for water)

**Rationale**: In-memory storage allows rapid prototyping and testing of API contracts without database complexity. When ready for production scale, data can be migrated to PostgreSQL for persistence, history tracking, and concurrent access.

### API Endpoints

The API provides 15 comprehensive endpoints:

**Health Check**
- `GET /health` - System health status

**Meter Management** (Read Operations)
- `GET /meters` - List all meters with optional filters (?status=active&type=electric)
- `GET /meter/:id` - Get single meter by ID

**Meter Management** (Write Operations)
- `PATCH /meter/:id` - Update meter (secure partial updates with field whitelisting)

**AMI Events**
- `GET /ami/events` - List AMI events with filters (?meterId=MTR-1001&eventType=comm_fail&severity=high)
- `POST /ami/events` - Ingest new AMI events

**Usage Data**
- `GET /usage/:meter` - Get usage reads for a meter (?limit=24)
- `POST /usage/:meter` - Ingest single usage read
- `POST /usage/:meter/bulk` - Bulk ingest multiple usage reads

**Billing Integrity Engine v2**
- `GET /billing/flags` - Analyze all meters for billing anomalies (?since=ISO_DATE&limit=200)
- `GET /billing/flags/:meterId` - Analyze single meter for billing anomalies

**Meter Health Index™**
- `GET /meter-health/score` - Get health scores for all meters (0-100 scale)
- `GET /meter-health/score/:meterId` - Get health score for single meter

**Dashboard & Analytics**
- `GET /meters/risk-map` - Group meter health by location/infrastructure (?groupBy=city|feeder|zone|transformer)
- `GET /dashboard/overview` - Comprehensive dashboard data bundle (fleet health, at-risk meters, risk map, billing flags)

### Billing Integrity Engine v2

The enhanced billing engine analyzes **both usage reads AND AMI events** with 7 comprehensive detection rules:

**Detection Rules**
1. **Missing Reads** - No usage data in the query window (high severity)
2. **Zero Usage** - Sustained zero consumption ≥80% of reads (medium severity)
3. **Impossible Spike** - Usage exceeds 5x average (high severity)
4. **Negative Reads** - Rollback/register errors detected (high severity)
5. **Inactive Billing Risk** - Inactive meter still producing reads (high severity)
6. **AMI Event Risk** - Communication failures, last gasp, tamper events (high severity)
7. **Read Gap** - No reads in last 24 hours (medium severity)
8. **Flatline Usage** - Too little variance in consumption patterns (low severity)

**Flag Structure**
Each flag includes:
- `code`: Identifier for the issue type
- `severity`: Severity level (high, medium, low)
- `msg`: Human-readable description
- `stats`: Additional diagnostic data (optional)

### Meter Health Index™

Proprietary 0-100 scoring system with 8 diagnostic rules and 5 health bands:

**Health Bands**
- 90-100: **Excellent** - Meter operating optimally
- 75-89: **Good** - Normal operation
- 60-74: **Fair** - Minor issues
- 40-59: **Poor** - Significant issues requiring attention
- 0-39: **Critical** - Urgent action required

**Health Scoring Rules** (point deductions from 100)
1. Missing reads (-35 pts)
2. Zero usage patterns (-20 pts)
3. Flatline/stuck meters (-15 pts)
4. Negative reads (-25 pts)
5. AMI communication failures (-5 to -25 pts based on severity)
6. Reverse flow/tamper events (-20 pts)
7. No AMI events in window (-5 pts)
8. Read gaps in last 24h (-10 pts)

### Sample Data

**Meters**
- MTR-1001: Active electric meter in Holly Springs, MS
- MTR-1002: Active water meter in Byhalia, MS
- MTR-1003: Inactive electric meter in Byhalia, MS (triggers missing reads flag)

**AMI Events**
- EVT-9001: Last gasp (power failure) on MTR-1001
- EVT-9002: Communication failure on MTR-1002

**Usage Reads**
- 3 hourly electric readings for MTR-1001
- 2 hourly water readings for MTR-1002

## External Dependencies

### Runtime Dependencies

**Express.js (^4.18.2)**
- Purpose: HTTP server and routing framework
- Justification: Industry-standard, lightweight, and flexible for building REST APIs with minimal overhead

**dotenv (^16.3.1)**
- Purpose: Environment variable management
- Justification: Standard approach for 12-factor app configuration, keeps sensitive credentials out of source code

### Planned Dependencies

**PostgreSQL Client - pg (^8.11.0)**
- Purpose: Database connectivity and query execution (when migrating from in-memory to persistent storage)
- Status: Installed but not yet integrated

### External Services

**AMI Network Integration** (future)
- The system is designed to receive data from Advanced Metering Infrastructure networks
- Event types like "last_gasp" suggest real-time integration with smart meter communication protocols
- Future integration points likely include: meter data collection services, outage detection systems, and utility billing platforms

## Development & Deployment

**Replit Environment**
- The application runs on Replit with workflow: "Start API Server"
- Command: `node index.js`
- Uses Node.js native capabilities without build/transpilation steps
- ES Modules enabled for modern JavaScript syntax

**Running Locally**
```bash
node index.js
```

**Testing Endpoints**
```bash
# Read operations (no auth required)
curl http://localhost:5000/health
curl http://localhost:5000/meters?status=active
curl http://localhost:5000/ami/events
curl http://localhost:5000/billing/flags

# Write operations (require API key)
curl -H "Authorization: Bearer YOUR_API_KEY" -X POST http://localhost:5000/ami/events -H "Content-Type: application/json" -d '{"meterId":"MTR-1001",...}'
```

## Security

**Temporary API Protection** (November 23, 2025)
- **Read Operations**: All GET endpoints are publicly accessible (no authentication required)
- **Write Operations**: POST, PATCH, DELETE endpoints require API key authentication
- **Authentication Method**: Bearer token in Authorization header (`Authorization: Bearer YOUR_API_KEY`)
- **API Key Storage**: `GRIDLENS_API_KEY` secret in Replit environment
- **Dashboard Access**: Public HTML dashboard remains fully accessible at `/dashboard.html`
- **Rationale**: Protects data modification while keeping read access open for dashboard and monitoring

**To Disable Security**: Delete the `GRIDLENS_API_KEY` secret from Replit environment

## Frontend Dashboard

**Live Interactive Dashboard** (`/dashboard.html`)
- **Location**: Served from `/public` directory via express.static
- **Features**: Real-time KPI cards, Chart.js visualizations, interactive filters, responsive design
- **Data Source**: Calls `/dashboard/overview` endpoint for bundled analytics
- **Public Access**: Dashboard is always accessible without authentication
- **Visualization Library**: Chart.js 4.4.0 from CDN

## Recent Changes

**November 23, 2025 - Session 3: Security & Access Control**
- Added temporary API authentication middleware (read-only public access, write operations require API key)
- Migrated server from port 3000 to 5000 for Replit webview compatibility
- Configured Express to bind to 0.0.0.0 for external access
- Dashboard remains publicly accessible while protecting write operations

**November 23, 2025 - Session 2: Dashboard & Analytics**
- Added `/meters/risk-map` endpoint - Group meter health by location/infrastructure (city, feeder, zone, transformer)
- Added `/dashboard/overview` endpoint - Comprehensive dashboard data bundle for Retool integration
- Built live HTML dashboard with Chart.js visualizations, KPI cards, and interactive filters
- API now has 15 total endpoints providing complete meter monitoring and analytics capabilities

**November 23, 2025 - Session 1: Core API Development**
- Converted API from CommonJS to ES modules
- Implemented all 5 core meter/event/usage endpoints with filtering capabilities
- Enhanced Billing Integrity Engine to v2 with 7 detection rules (reads + AMI events)
- Added Meter Health Index™ scoring system (0-100 scale) with 8 diagnostic rules and 5 health bands
- Implemented secure PATCH /meter/:id endpoint with field whitelisting and validation
- Added data ingestion endpoints (POST /ami/events, POST /usage/:meter, POST /usage/:meter/bulk)
- Added health score endpoints for all meters and individual meters
- Added per-meter billing flag analysis endpoint
- Removed database integration (using in-memory storage for MVP)
- Cleaned up unused files (db.js, test-db.js)

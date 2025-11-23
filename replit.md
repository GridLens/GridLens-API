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
- **Port**: 3000

**Current Data Layer**
The system uses in-memory data structures for MVP development. Three primary data entities exist:
- **Meters**: Store meter identification, status (active/inactive), type (electric/water), last readings (kWh or gallons), timestamps, and location data (city, state)
- **AMI Events**: Track meter-related events with severity levels and occurrence timestamps
- **Usage Reads**: Hourly consumption data for meters (kWh for electric, gallons for water)

**Rationale**: In-memory storage allows rapid prototyping and testing of API contracts without database complexity. When ready for production scale, data can be migrated to PostgreSQL for persistence, history tracking, and concurrent access.

### API Endpoints

The API provides 5 core endpoints plus health check:

**Health Check**
- `GET /health` - System health status
  - Returns: `{ ok: true, api: "up", db: "mvp-mock" }`

**Meter Management**
- `GET /meters` - List all meters
  - Query params: `?status=active&type=electric`
  - Returns: `{ count: N, data: [...meters] }`
- `GET /meter/:id` - Get single meter by ID
  - Example: `/meter/MTR-1001`
  - Returns: meter object or 404

**AMI Events**
- `GET /ami/events` - List AMI events
  - Query params: `?meterId=MTR-1001&eventType=comm_fail&severity=high`
  - Returns: `{ count: N, data: [...events] }`

**Usage Data**
- `GET /usage/:meter` - Get usage reads for a meter
  - Example: `/usage/MTR-1001?limit=24`
  - Returns: `{ meterId, count, data: [...reads] }`

**Billing Integrity**
- `GET /billing/flags` - Run billing integrity engine
  - Returns flags for all meters: `{ count: N, data: [{ meterId, flags, flagCount }] }`

### Billing Integrity Engine

The billing engine applies MVP-level detection rules to identify billing anomalies:

**Detection Rules**
1. **Missing Reads** - No usage data in the query window (high severity)
2. **Zero Usage** - Sustained zero consumption (≥80% of reads are zero) (medium severity)
3. **Impossible Spike** - Usage exceeds 5x average (high severity)
4. **Inactive Billing Risk** - Inactive meter still producing reads (high severity)

**Flag Structure**
Each flag includes:
- `code`: Identifier for the issue type
- `level`: Severity (high, medium, low)
- `msg`: Human-readable description

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
curl http://localhost:3000/health
curl http://localhost:3000/meters?status=active
curl http://localhost:3000/ami/events
curl http://localhost:3000/billing/flags
```

## Recent Changes

**November 23, 2025**
- Converted API from CommonJS to ES modules
- Implemented all 5 core endpoints with filtering capabilities
- Added billing integrity engine with 4 detection rules
- Removed database integration (using in-memory storage for MVP)
- Cleaned up unused files (db.js, test-db.js)

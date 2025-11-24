# GridLens Smart MeterIQ - Core API

## Overview
GridLens Smart MeterIQ is a utility meter monitoring and management system for Advanced Metering Infrastructure (AMI). It tracks electric and water meters across Mississippi, monitors meter events (outages, alarms), and provides real-time status updates with a billing integrity engine. This Core API provides REST endpoints for meter data retrieval, event management, and billing flag detection. The project aims to prototype API contracts rapidly using in-memory data, with a future vision for PostgreSQL integration for production scalability.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Technology Stack**: Node.js (ES Modules), Express.js 4.18.2, JavaScript (ES6+).
- **Port**: 5000 (webview-compatible).
- **Data Layer**: In-memory data structures for Meters, AMI Events, and Usage Reads for rapid prototyping. Future plans include migration to PostgreSQL.

### API Endpoints
The API offers 15 endpoints covering:
- **Health Check**: `GET /health`
- **Meter Management**: `GET /meters`, `GET /meter/:id`, `PATCH /meter/:id`
- **AMI Events**: `GET /ami/events`, `POST /ami/events`
- **Usage Data**: `GET /usage/:meter`, `POST /usage/:meter`, `POST /usage/:meter/bulk`
- **Billing Integrity Engine v2**: `GET /billing/flags`, `GET /billing/flags/:meterId`
- **Meter Health Index™**: `GET /meter-health/score`, `GET /meter-health/score/:meterId`
- **Dashboard & Analytics**: `GET /meters/risk-map`, `GET /dashboard/overview`

### Billing Integrity Engine v2
Analyzes usage reads and AMI events using 7 detection rules: Missing Reads, Zero Usage, Impossible Spike, Negative Reads, Inactive Billing Risk, AMI Event Risk, Read Gap, and Flatline Usage. Flags include code, severity (high, medium, low), message, and optional diagnostic stats.

### Meter Health Index™
A proprietary 0-100 scoring system with 8 diagnostic rules, categorizing meters into 5 health bands: Excellent (90-100), Good (75-89), Fair (60-74), Poor (40-59), and Critical (0-39). Scoring rules deduct points based on issues like missing reads, zero usage, flatline usage, negative reads, communication failures, and tamper events.

### Frontend Dashboard
A live interactive dashboard is served from `/public/dashboard.html` using `express.static`. It features real-time KPI cards, Chart.js visualizations, and interactive filters, consuming data from the `/dashboard/overview` endpoint. It is publicly accessible without authentication.

### Security
Write operations (POST, PATCH) require API key authentication via a Bearer token in the Authorization header. The API key is stored as `GRIDLENS_API_KEY` in the Replit environment. Read operations are publicly accessible.

### Retool Dashboard Documentation
The project includes comprehensive Retool implementation guides for building a utility monitoring dashboard, covering a premium 5-tab drill-down modal, utility-wide analytics, professional UI/UX polish, and V3 advanced features like AI anomaly detection, work order management, timeline analytics, and executive reporting.

## External Dependencies

### Runtime Dependencies
- **Express.js (^4.18.2)**: HTTP server and routing framework.
- **dotenv (^16.3.1)**: Environment variable management.

### Planned Dependencies
- **PostgreSQL Client - pg (^8.11.0)**: For future database integration.

### External Services
- **AMI Network Integration**: Designed for future integration with Advanced Metering Infrastructure networks for real-time data and events.
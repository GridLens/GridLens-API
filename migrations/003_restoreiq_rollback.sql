-- =============================================================================
-- GridLens RestoreIQ ROLLBACK Migration
-- Version: 003 (ROLLBACK)
-- Description: Drops all RestoreIQ schema objects (USE WITH CAUTION)
-- Environment: DEV ONLY - Never run in PILOT/PROD without explicit approval
-- =============================================================================

-- WARNING: This will permanently delete all RestoreIQ data!
-- Only use for complete rollback scenarios in DEV environment

BEGIN;

-- Drop tables in reverse dependency order (child tables first)
-- Using IF EXISTS to ensure idempotency

DROP TABLE IF EXISTS restoreiq.operator_feedback;
DROP TABLE IF EXISTS restoreiq.crew_recommendations;
DROP TABLE IF EXISTS restoreiq.crew_skills;
DROP TABLE IF EXISTS restoreiq.crews;
DROP TABLE IF EXISTS restoreiq.restoration_options;
DROP TABLE IF EXISTS restoreiq.fault_zone_rankings;
DROP TABLE IF EXISTS restoreiq.fault_zones;
DROP TABLE IF EXISTS restoreiq.outage_replays;
DROP TABLE IF EXISTS restoreiq.provisional_outages;
DROP TABLE IF EXISTS restoreiq.recommendation_runs;
DROP TABLE IF EXISTS restoreiq.outage_impacts;
DROP TABLE IF EXISTS restoreiq.outages;
DROP TABLE IF EXISTS restoreiq.events;

-- Optionally drop the schema itself (only if empty or CASCADE approved)
-- Uncomment the line below ONLY if you want to remove the entire schema
-- DROP SCHEMA IF EXISTS restoreiq CASCADE;

COMMIT;

-- Note: Indexes are automatically dropped when tables are dropped
-- The schema itself is preserved unless explicitly dropped above

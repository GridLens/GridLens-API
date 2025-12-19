-- =============================================================================
-- GridLens RestoreIQ ROLLBACK Migration
-- Version: 003 (ROLLBACK)
-- Description: Drops all RestoreIQ tables and indexes (USE WITH CAUTION)
-- Environment: DEV ONLY - Never run in PILOT/PROD without explicit approval
-- =============================================================================

-- WARNING: This will permanently delete all RestoreIQ data!
-- Only use for complete rollback scenarios

BEGIN;

-- Drop tables in reverse dependency order (child tables first)
DROP TABLE IF EXISTS operator_feedback CASCADE;
DROP TABLE IF EXISTS crew_recommendations CASCADE;
DROP TABLE IF EXISTS crew_skills CASCADE;
DROP TABLE IF EXISTS crews CASCADE;
DROP TABLE IF EXISTS restoration_options CASCADE;
DROP TABLE IF EXISTS fault_zone_rankings CASCADE;
DROP TABLE IF EXISTS fault_zones CASCADE;
DROP TABLE IF EXISTS outage_replays CASCADE;
DROP TABLE IF EXISTS provisional_outages CASCADE;
DROP TABLE IF EXISTS recommendation_runs CASCADE;
DROP TABLE IF EXISTS outage_impacts CASCADE;
DROP TABLE IF EXISTS outages CASCADE;
DROP TABLE IF EXISTS events CASCADE;

COMMIT;

-- Note: Indexes are automatically dropped when tables are dropped

-- =============================================================================
-- GridLens RestoreIQ Indexes Migration
-- Version: 002
-- Description: Creates all required indexes for RestoreIQ tables
-- Environment: DEV (apply to PILOT/PROD only with explicit approval)
-- =============================================================================

-- IMPORTANT: This migration is IDEMPOTENT - safe to run multiple times
-- All CREATE INDEX statements use IF NOT EXISTS

BEGIN;

-- -----------------------------------------------------------------------------
-- EVENTS INDEXES (Required by charter)
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_events_tenant_canon_occurred 
    ON events(tenant_id, canon_outage_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_events_tenant_prov_outage 
    ON events(tenant_id, prov_outage_id);

CREATE INDEX IF NOT EXISTS idx_events_tenant_occurred 
    ON events(tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_tenant_type 
    ON events(tenant_id, event_type);

CREATE INDEX IF NOT EXISTS idx_events_feeder 
    ON events(tenant_id, feeder_id) WHERE feeder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_device 
    ON events(tenant_id, device_id) WHERE device_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- OUTAGES INDEXES (Required by charter)
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_outages_tenant_outage 
    ON outages(tenant_id, outage_id);

CREATE INDEX IF NOT EXISTS idx_outages_tenant_status 
    ON outages(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_outages_tenant_start 
    ON outages(tenant_id, start_at DESC);

CREATE INDEX IF NOT EXISTS idx_outages_tenant_feeder 
    ON outages(tenant_id, primary_feeder_id) WHERE primary_feeder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outages_active 
    ON outages(tenant_id, status) WHERE status = 'active';

-- -----------------------------------------------------------------------------
-- OUTAGE_IMPACTS INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_outage_impacts_tenant_outage 
    ON outage_impacts(tenant_id, outage_id);

CREATE INDEX IF NOT EXISTS idx_outage_impacts_asset 
    ON outage_impacts(tenant_id, asset_type, asset_id);

-- -----------------------------------------------------------------------------
-- RECOMMENDATION_RUNS INDEXES (Required by charter)
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_recommendation_runs_tenant_outage_run_at 
    ON recommendation_runs(tenant_id, outage_id, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_runs_tenant_type 
    ON recommendation_runs(tenant_id, run_type);

CREATE INDEX IF NOT EXISTS idx_recommendation_runs_tenant_run_at 
    ON recommendation_runs(tenant_id, run_at DESC);

-- -----------------------------------------------------------------------------
-- PROVISIONAL_OUTAGES INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_provisional_outages_tenant_status 
    ON provisional_outages(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_provisional_outages_tenant_pending 
    ON provisional_outages(tenant_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_provisional_outages_feeder 
    ON provisional_outages(tenant_id, primary_feeder_id) WHERE primary_feeder_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- FAULT_ZONES INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_fault_zones_tenant_active 
    ON fault_zones(tenant_id) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_fault_zones_tenant_feeder 
    ON fault_zones(tenant_id, feeder_id) WHERE feeder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fault_zones_tenant_substation 
    ON fault_zones(tenant_id, substation_id) WHERE substation_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- FAULT_ZONE_RANKINGS INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_fault_zone_rankings_run 
    ON fault_zone_rankings(run_id);

CREATE INDEX IF NOT EXISTS idx_fault_zone_rankings_tenant_outage 
    ON fault_zone_rankings(tenant_id, outage_id);

CREATE INDEX IF NOT EXISTS idx_fault_zone_rankings_rank 
    ON fault_zone_rankings(run_id, rank_position);

-- -----------------------------------------------------------------------------
-- RESTORATION_OPTIONS INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_restoration_options_run 
    ON restoration_options(run_id);

CREATE INDEX IF NOT EXISTS idx_restoration_options_tenant_outage 
    ON restoration_options(tenant_id, outage_id);

CREATE INDEX IF NOT EXISTS idx_restoration_options_recommended 
    ON restoration_options(run_id) WHERE is_recommended = TRUE;

-- -----------------------------------------------------------------------------
-- CREWS INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_crews_tenant_active 
    ON crews(tenant_id) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_crews_tenant_status 
    ON crews(tenant_id, current_status);

CREATE INDEX IF NOT EXISTS idx_crews_available 
    ON crews(tenant_id) WHERE current_status = 'available' AND is_active = TRUE;

-- -----------------------------------------------------------------------------
-- CREW_SKILLS INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_crew_skills_crew 
    ON crew_skills(crew_id);

CREATE INDEX IF NOT EXISTS idx_crew_skills_tenant_skill 
    ON crew_skills(tenant_id, skill_name);

-- -----------------------------------------------------------------------------
-- CREW_RECOMMENDATIONS INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_crew_recommendations_run 
    ON crew_recommendations(run_id);

CREATE INDEX IF NOT EXISTS idx_crew_recommendations_tenant_outage 
    ON crew_recommendations(tenant_id, outage_id);

CREATE INDEX IF NOT EXISTS idx_crew_recommendations_crew 
    ON crew_recommendations(crew_id) WHERE crew_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- OPERATOR_FEEDBACK INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_operator_feedback_run 
    ON operator_feedback(run_id) WHERE run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operator_feedback_outage 
    ON operator_feedback(outage_id) WHERE outage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operator_feedback_tenant_type 
    ON operator_feedback(tenant_id, feedback_type);

-- -----------------------------------------------------------------------------
-- OUTAGE_REPLAYS INDEXES (Required by charter)
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_outage_replays_tenant_outage_generated 
    ON outage_replays(tenant_id, outage_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_outage_replays_tenant_generated 
    ON outage_replays(tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_outage_replays_outage 
    ON outage_replays(outage_id);

CREATE INDEX IF NOT EXISTS idx_outage_replays_status 
    ON outage_replays(tenant_id, status);

COMMIT;

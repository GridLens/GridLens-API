-- =============================================================================
-- GridLens RestoreIQ Core Schema Migration
-- Version: 001
-- Description: Creates all RestoreIQ tables for outage management, fault zone
--              ranking, restoration options, crew recommendations, and replays
-- Environment: DEV (apply to PILOT/PROD only with explicit approval)
-- =============================================================================

-- IMPORTANT: This migration is IDEMPOTENT - safe to run multiple times
-- All CREATE statements use IF NOT EXISTS

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. EVENTS TABLE (extends existing or creates new)
-- Core event tracking with canonical and provisional outage linkage
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    source VARCHAR(64) NOT NULL DEFAULT 'telemetry',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_id VARCHAR(128),
    feeder_id VARCHAR(64),
    substation_id VARCHAR(64),
    circuit_id VARCHAR(64),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    raw_payload JSONB,
    canon_outage_id UUID,
    prov_outage_id UUID,
    is_provisional BOOLEAN DEFAULT FALSE,
    confidence_score NUMERIC(4, 3) DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE events IS 'Core telemetry events with linkage to canonical and provisional outages';
COMMENT ON COLUMN events.canon_outage_id IS 'FK to confirmed/canonical outage record';
COMMENT ON COLUMN events.prov_outage_id IS 'FK to provisional (unconfirmed) outage record';

-- -----------------------------------------------------------------------------
-- 2. OUTAGES TABLE
-- Canonical confirmed outage records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outages (
    outage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    outage_type VARCHAR(64) NOT NULL DEFAULT 'unplanned',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    cause_code VARCHAR(64),
    cause_description TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    affected_customers INTEGER DEFAULT 0,
    affected_meters INTEGER DEFAULT 0,
    primary_feeder_id VARCHAR(64),
    primary_substation_id VARCHAR(64),
    geographic_center_lat NUMERIC(10, 7),
    geographic_center_lon NUMERIC(10, 7),
    severity VARCHAR(32) DEFAULT 'medium',
    priority INTEGER DEFAULT 5,
    is_major_event BOOLEAN DEFAULT FALSE,
    restoration_crew_count INTEGER DEFAULT 0,
    estimated_restore_at TIMESTAMPTZ,
    actual_restore_at TIMESTAMPTZ,
    saidi_contribution_minutes NUMERIC(10, 2),
    saifi_contribution NUMERIC(10, 4),
    cmi_contribution INTEGER,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE outages IS 'Canonical confirmed outage records with reliability metrics';

-- -----------------------------------------------------------------------------
-- 3. OUTAGE_IMPACTS TABLE
-- Detailed impact tracking per asset/customer
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outage_impacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    outage_id UUID NOT NULL REFERENCES outages(outage_id) ON DELETE CASCADE,
    impact_type VARCHAR(64) NOT NULL,
    asset_type VARCHAR(64),
    asset_id VARCHAR(128),
    customer_count INTEGER DEFAULT 0,
    estimated_load_kw NUMERIC(12, 2),
    estimated_loss_dollars NUMERIC(12, 2),
    priority_customers INTEGER DEFAULT 0,
    critical_customers INTEGER DEFAULT 0,
    medical_baseline_customers INTEGER DEFAULT 0,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE outage_impacts IS 'Granular impact tracking per outage, asset, or customer segment';

-- -----------------------------------------------------------------------------
-- 4. RECOMMENDATION_RUNS TABLE
-- Audit trail for all AI/analytical recommendation generations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendation_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    outage_id UUID REFERENCES outages(outage_id) ON DELETE SET NULL,
    run_type VARCHAR(64) NOT NULL,
    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    input_params JSONB,
    output_summary JSONB,
    zones_ranked INTEGER DEFAULT 0,
    options_generated INTEGER DEFAULT 0,
    crews_recommended INTEGER DEFAULT 0,
    model_version VARCHAR(32),
    execution_time_ms INTEGER,
    status VARCHAR(32) DEFAULT 'completed',
    error_message TEXT,
    created_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE recommendation_runs IS 'Audit trail for all recommendation generation runs';

-- -----------------------------------------------------------------------------
-- 5. PROVISIONAL_OUTAGES TABLE
-- Unconfirmed/provisional outage clusters awaiting operator validation
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provisional_outages (
    prov_outage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    confidence_score NUMERIC(4, 3) DEFAULT 0.5,
    event_count INTEGER DEFAULT 0,
    affected_meters INTEGER DEFAULT 0,
    affected_customers INTEGER DEFAULT 0,
    primary_feeder_id VARCHAR(64),
    primary_substation_id VARCHAR(64),
    geographic_center_lat NUMERIC(10, 7),
    geographic_center_lon NUMERIC(10, 7),
    first_event_at TIMESTAMPTZ,
    last_event_at TIMESTAMPTZ,
    promoted_to_outage_id UUID REFERENCES outages(outage_id) ON DELETE SET NULL,
    promoted_at TIMESTAMPTZ,
    promoted_by VARCHAR(128),
    dismissed_at TIMESTAMPTZ,
    dismissed_by VARCHAR(128),
    dismiss_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE provisional_outages IS 'Provisional outage clusters pending operator confirmation';

-- -----------------------------------------------------------------------------
-- 6. FAULT_ZONES TABLE
-- Geographic/topological fault zone definitions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fault_zones (
    zone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    zone_name VARCHAR(128) NOT NULL,
    zone_type VARCHAR(64) DEFAULT 'geographic',
    feeder_id VARCHAR(64),
    substation_id VARCHAR(64),
    circuit_segment VARCHAR(128),
    upstream_device_id VARCHAR(128),
    downstream_device_id VARCHAR(128),
    meter_count INTEGER DEFAULT 0,
    customer_count INTEGER DEFAULT 0,
    critical_customer_count INTEGER DEFAULT 0,
    avg_load_kw NUMERIC(12, 2),
    geographic_bounds JSONB,
    center_lat NUMERIC(10, 7),
    center_lon NUMERIC(10, 7),
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fault_zones IS 'Fault zone definitions for localization and ranking';

-- -----------------------------------------------------------------------------
-- 7. FAULT_ZONE_RANKINGS TABLE
-- Per-run fault zone ranking results
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fault_zone_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    run_id UUID NOT NULL REFERENCES recommendation_runs(run_id) ON DELETE CASCADE,
    outage_id UUID REFERENCES outages(outage_id) ON DELETE SET NULL,
    zone_id UUID REFERENCES fault_zones(zone_id) ON DELETE SET NULL,
    zone_name VARCHAR(128),
    rank_position INTEGER NOT NULL,
    confidence_score NUMERIC(4, 3),
    evidence_count INTEGER DEFAULT 0,
    affected_meters INTEGER DEFAULT 0,
    affected_customers INTEGER DEFAULT 0,
    severity_score NUMERIC(5, 2),
    ranking_factors JSONB,
    reasoning TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fault_zone_rankings IS 'Ranked fault zones per recommendation run';

-- -----------------------------------------------------------------------------
-- 8. RESTORATION_OPTIONS TABLE
-- Generated restoration strategy options
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restoration_options (
    option_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    run_id UUID NOT NULL REFERENCES recommendation_runs(run_id) ON DELETE CASCADE,
    outage_id UUID REFERENCES outages(outage_id) ON DELETE SET NULL,
    option_rank INTEGER NOT NULL,
    option_type VARCHAR(64) NOT NULL,
    option_name VARCHAR(256),
    description TEXT,
    estimated_restore_minutes INTEGER,
    estimated_customers_restored INTEGER,
    estimated_load_restored_kw NUMERIC(12, 2),
    switching_steps JSONB,
    crew_requirements JSONB,
    equipment_requirements JSONB,
    risk_factors JSONB,
    risk_score NUMERIC(4, 2) DEFAULT 0,
    feasibility_score NUMERIC(4, 2) DEFAULT 1.0,
    confidence_score NUMERIC(4, 3),
    is_recommended BOOLEAN DEFAULT FALSE,
    advisory_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE restoration_options IS 'Generated restoration strategy options (advisory only)';
COMMENT ON COLUMN restoration_options.advisory_notes IS 'Advisory notes - operator validation required';

-- -----------------------------------------------------------------------------
-- 9. CREWS TABLE
-- Field crew roster
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crews (
    crew_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    crew_name VARCHAR(128) NOT NULL,
    crew_type VARCHAR(64) DEFAULT 'line',
    home_base_location VARCHAR(256),
    home_base_lat NUMERIC(10, 7),
    home_base_lon NUMERIC(10, 7),
    current_status VARCHAR(32) DEFAULT 'available',
    current_lat NUMERIC(10, 7),
    current_lon NUMERIC(10, 7),
    current_assignment_id UUID,
    member_count INTEGER DEFAULT 2,
    vehicle_type VARCHAR(64),
    equipment_tags JSONB,
    certifications JSONB,
    shift_start TIME,
    shift_end TIME,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE crews IS 'Field crew roster and status tracking';

-- -----------------------------------------------------------------------------
-- 10. CREW_SKILLS TABLE
-- Crew skill/certification matrix
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crew_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    crew_id UUID NOT NULL REFERENCES crews(crew_id) ON DELETE CASCADE,
    skill_name VARCHAR(128) NOT NULL,
    skill_category VARCHAR(64),
    proficiency_level VARCHAR(32) DEFAULT 'standard',
    certified_at DATE,
    expires_at DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE crew_skills IS 'Crew skill and certification matrix';

-- -----------------------------------------------------------------------------
-- 11. CREW_RECOMMENDATIONS TABLE
-- Generated crew assignment recommendations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crew_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    run_id UUID NOT NULL REFERENCES recommendation_runs(run_id) ON DELETE CASCADE,
    outage_id UUID REFERENCES outages(outage_id) ON DELETE SET NULL,
    option_id UUID REFERENCES restoration_options(option_id) ON DELETE SET NULL,
    crew_id UUID REFERENCES crews(crew_id) ON DELETE SET NULL,
    crew_name VARCHAR(128),
    recommendation_rank INTEGER NOT NULL,
    assignment_type VARCHAR(64),
    estimated_travel_minutes INTEGER,
    estimated_work_minutes INTEGER,
    estimated_arrival_at TIMESTAMPTZ,
    skill_match_score NUMERIC(4, 2),
    proximity_score NUMERIC(4, 2),
    availability_score NUMERIC(4, 2),
    overall_score NUMERIC(5, 2),
    reasoning TEXT,
    is_recommended BOOLEAN DEFAULT FALSE,
    advisory_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE crew_recommendations IS 'Generated crew assignment recommendations (advisory only)';

-- -----------------------------------------------------------------------------
-- 12. OPERATOR_FEEDBACK TABLE
-- Operator feedback on recommendations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operator_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    run_id UUID REFERENCES recommendation_runs(run_id) ON DELETE SET NULL,
    outage_id UUID REFERENCES outages(outage_id) ON DELETE SET NULL,
    feedback_type VARCHAR(64) NOT NULL,
    target_type VARCHAR(64),
    target_id UUID,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    was_accepted BOOLEAN,
    rejection_reason TEXT,
    operator_id VARCHAR(128),
    operator_name VARCHAR(256),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE operator_feedback IS 'Operator feedback on AI recommendations for continuous improvement';

-- -----------------------------------------------------------------------------
-- 13. OUTAGE_REPLAYS TABLE
-- After-action replay and report generation
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outage_replays (
    replay_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    outage_id UUID NOT NULL REFERENCES outages(outage_id) ON DELETE CASCADE,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by VARCHAR(128),
    replay_type VARCHAR(64) DEFAULT 'after_action',
    summary JSONB NOT NULL DEFAULT '{}',
    timeline JSONB,
    metrics JSONB,
    findings JSONB,
    recommendations JSONB,
    report_blob_ref JSONB,
    status VARCHAR(32) DEFAULT 'draft',
    approved_at TIMESTAMPTZ,
    approved_by VARCHAR(128),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE outage_replays IS 'After-action replay summaries with report blob references';
COMMENT ON COLUMN outage_replays.summary IS 'JSONB containing milestones, metrics, narrative, top recommendations, evidence counts';
COMMENT ON COLUMN outage_replays.report_blob_ref IS 'JSONB with S3 signed URLs for PDF/DOCX exports';

COMMIT;

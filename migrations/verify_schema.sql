-- =============================================================================
-- GridLens RestoreIQ Schema Verification Queries
-- Description: SQL smoke queries to validate tables and indexes exist in restoreiq schema
-- Run these queries after applying migrations to verify schema is correct
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. VERIFY SCHEMA EXISTS
-- -----------------------------------------------------------------------------
SELECT 
    'SCHEMA CHECK' as check_type,
    schema_name,
    CASE WHEN schema_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.schemata 
WHERE schema_name = 'restoreiq';

-- -----------------------------------------------------------------------------
-- 2. VERIFY ALL TABLES EXIST IN restoreiq SCHEMA
-- -----------------------------------------------------------------------------
SELECT 
    'TABLE CHECK' as check_type,
    table_name,
    CASE WHEN table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'restoreiq' 
AND table_name IN (
    'events',
    'outages',
    'outage_impacts',
    'recommendation_runs',
    'provisional_outages',
    'fault_zones',
    'fault_zone_rankings',
    'restoration_options',
    'crews',
    'crew_skills',
    'crew_recommendations',
    'operator_feedback',
    'outage_replays'
)
ORDER BY table_name;

-- -----------------------------------------------------------------------------
-- 3. VERIFY CRITICAL INDEXES EXIST (Charter Required)
-- -----------------------------------------------------------------------------
SELECT 
    'INDEX CHECK' as check_type,
    indexname,
    tablename,
    'EXISTS' as status
FROM pg_indexes 
WHERE schemaname = 'restoreiq'
AND indexname IN (
    'idx_events_tenant_canon_occurred',
    'idx_events_tenant_prov_outage',
    'idx_outages_tenant_outage',
    'idx_recommendation_runs_tenant_outage_run_at',
    'idx_outage_replays_tenant_outage_generated'
)
ORDER BY tablename, indexname;

-- -----------------------------------------------------------------------------
-- 4. VERIFY TABLE COUNTS (should be 13 RestoreIQ tables)
-- -----------------------------------------------------------------------------
SELECT 
    'TABLE COUNT' as check_type,
    COUNT(*) as restoreiq_table_count,
    CASE WHEN COUNT(*) >= 13 THEN 'PASS' ELSE 'FAIL - Expected 13' END as status
FROM information_schema.tables 
WHERE table_schema = 'restoreiq' 
AND table_name IN (
    'events', 'outages', 'outage_impacts', 'recommendation_runs',
    'provisional_outages', 'fault_zones', 'fault_zone_rankings',
    'restoration_options', 'crews', 'crew_skills', 'crew_recommendations',
    'operator_feedback', 'outage_replays'
);

-- -----------------------------------------------------------------------------
-- 5. VERIFY INDEX COUNT (should have 30+ indexes in restoreiq schema)
-- -----------------------------------------------------------------------------
SELECT 
    'INDEX COUNT' as check_type,
    COUNT(*) as restoreiq_index_count,
    CASE WHEN COUNT(*) >= 30 THEN 'PASS' ELSE 'CHECK - May have fewer indexes' END as status
FROM pg_indexes 
WHERE schemaname = 'restoreiq'
AND indexname LIKE 'idx_%';

-- -----------------------------------------------------------------------------
-- 6. VERIFY FOREIGN KEY CONSTRAINTS IN restoreiq SCHEMA
-- -----------------------------------------------------------------------------
SELECT 
    'FK CHECK' as check_type,
    tc.constraint_name,
    tc.table_name as from_table,
    ccu.table_name as to_table,
    'EXISTS' as status
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
    AND tc.constraint_schema = ccu.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'restoreiq'
AND tc.table_name IN (
    'outage_impacts', 'recommendation_runs', 'provisional_outages',
    'fault_zone_rankings', 'restoration_options', 'crew_skills',
    'crew_recommendations', 'operator_feedback', 'outage_replays'
)
ORDER BY tc.table_name;

-- -----------------------------------------------------------------------------
-- 7. VERIFY CRITICAL COLUMNS EXIST IN restoreiq SCHEMA
-- -----------------------------------------------------------------------------
SELECT 
    'COLUMN CHECK' as check_type,
    table_name,
    column_name,
    data_type,
    'EXISTS' as status
FROM information_schema.columns
WHERE table_schema = 'restoreiq'
AND (
    (table_name = 'events' AND column_name IN ('canon_outage_id', 'prov_outage_id', 'tenant_id'))
    OR (table_name = 'outage_replays' AND column_name IN ('summary', 'report_blob_ref', 'outage_id'))
    OR (table_name = 'fault_zone_rankings' AND column_name IN ('run_id', 'rank_position'))
    OR (table_name = 'recommendation_runs' AND column_name IN ('run_id', 'outage_id', 'run_at'))
)
ORDER BY table_name, column_name;

-- -----------------------------------------------------------------------------
-- 8. VERIFY JSONB COLUMNS FOR RETOOL COMPATIBILITY
-- -----------------------------------------------------------------------------
SELECT 
    'JSONB CHECK' as check_type,
    table_name,
    column_name,
    data_type,
    CASE WHEN data_type = 'jsonb' THEN 'PASS' ELSE 'FAIL' END as status
FROM information_schema.columns
WHERE table_schema = 'restoreiq'
AND data_type = 'jsonb'
AND table_name IN (
    'events', 'outages', 'recommendation_runs', 'provisional_outages',
    'fault_zones', 'fault_zone_rankings', 'restoration_options',
    'crews', 'outage_replays'
)
ORDER BY table_name, column_name;

-- -----------------------------------------------------------------------------
-- 9. COMPREHENSIVE PASS/FAIL SUMMARY
-- -----------------------------------------------------------------------------
WITH checks AS (
    SELECT 
        'schema' as category,
        COUNT(*) as found,
        1 as expected
    FROM information_schema.schemata 
    WHERE schema_name = 'restoreiq'
    UNION ALL
    SELECT 
        'tables' as category,
        COUNT(*) as found,
        13 as expected
    FROM information_schema.tables 
    WHERE table_schema = 'restoreiq' 
    AND table_name IN (
        'events', 'outages', 'outage_impacts', 'recommendation_runs',
        'provisional_outages', 'fault_zones', 'fault_zone_rankings',
        'restoration_options', 'crews', 'crew_skills', 'crew_recommendations',
        'operator_feedback', 'outage_replays'
    )
    UNION ALL
    SELECT 
        'charter_indexes' as category,
        COUNT(*) as found,
        5 as expected
    FROM pg_indexes 
    WHERE schemaname = 'restoreiq'
    AND indexname IN (
        'idx_events_tenant_canon_occurred',
        'idx_events_tenant_prov_outage',
        'idx_outages_tenant_outage',
        'idx_recommendation_runs_tenant_outage_run_at',
        'idx_outage_replays_tenant_outage_generated'
    )
)
SELECT 
    '=== VERIFICATION SUMMARY ===' as result,
    category,
    found,
    expected,
    CASE WHEN found >= expected THEN 'PASS' ELSE 'FAIL' END as status
FROM checks;

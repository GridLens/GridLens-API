/**
 * GridLens RestoreIQ - Fault Zone Ranking Service (Step 17)
 * 
 * Ranks fault zones for a given outage based on evidence, affected meters,
 * and severity scoring. Uses deterministic ranking logic.
 * 
 * ADVISORY ONLY - Operator validation required before any actions.
 */

import { pool } from "../../db.js";

const ADVISORY_DISCLAIMER = "Advisory-only recommendations. Operator validation required.";

/**
 * Rank fault zones for a given outage
 * @param {Object} params - Ranking parameters
 * @param {string} params.tenantId - Tenant identifier
 * @param {string} params.outageId - Outage UUID
 * @param {string} [params.createdBy] - User who initiated the ranking
 * @returns {Object} Ranking results with run_id
 */
export async function rankFaultZones({ tenantId, outageId, createdBy = 'system' }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const outageCheck = await client.query(
      `SELECT outage_id, tenant_id, status, primary_feeder_id, affected_meters, affected_customers
       FROM restoreiq.outages 
       WHERE outage_id = $1 AND tenant_id = $2`,
      [outageId, tenantId]
    );
    
    if (outageCheck.rows.length === 0) {
      throw new Error(`Outage ${outageId} not found for tenant ${tenantId}`);
    }
    
    const outage = outageCheck.rows[0];
    
    const zonesResult = await client.query(
      `SELECT 
         zone_id, zone_name, feeder_id, substation_id,
         meter_count, customer_count, critical_customer_count,
         avg_load_kw, center_lat, center_lon
       FROM restoreiq.fault_zones
       WHERE tenant_id = $1 AND is_active = TRUE
       ORDER BY zone_name`,
      [tenantId]
    );
    
    const zones = zonesResult.rows;
    
    if (zones.length === 0) {
      const runResult = await client.query(
        `INSERT INTO restoreiq.recommendation_runs 
         (tenant_id, outage_id, run_type, run_at, input_params, output_summary, 
          zones_ranked, status, created_by)
         VALUES ($1, $2, 'fault_zone_ranking', NOW(), $3, $4, 0, 'completed', $5)
         RETURNING run_id, run_at`,
        [
          tenantId, 
          outageId, 
          JSON.stringify({ outageId, tenantId }),
          JSON.stringify({ message: 'No active fault zones found', advisory: ADVISORY_DISCLAIMER }),
          createdBy
        ]
      );
      
      await client.query('COMMIT');
      
      return {
        status: 'completed',
        run_id: runResult.rows[0].run_id,
        outage_id: outageId,
        zones_ranked: 0,
        rankings: [],
        advisory: ADVISORY_DISCLAIMER,
        generated_at: runResult.rows[0].run_at
      };
    }
    
    const eventsResult = await client.query(
      `SELECT feeder_id, COUNT(*) as event_count
       FROM restoreiq.events
       WHERE tenant_id = $1 AND canon_outage_id = $2
       GROUP BY feeder_id`,
      [tenantId, outageId]
    );
    
    const eventsByFeeder = {};
    for (const row of eventsResult.rows) {
      eventsByFeeder[row.feeder_id] = parseInt(row.event_count);
    }
    
    const rankedZones = zones.map(zone => {
      const evidenceCount = eventsByFeeder[zone.feeder_id] || 0;
      const meterCount = zone.meter_count || 0;
      const customerCount = zone.customer_count || 0;
      const criticalCustomers = zone.critical_customer_count || 0;
      const avgLoad = parseFloat(zone.avg_load_kw) || 0;
      
      const evidenceScore = Math.min(evidenceCount * 10, 40);
      const meterScore = Math.min(meterCount / 10, 25);
      const criticalScore = criticalCustomers * 5;
      const loadScore = Math.min(avgLoad / 100, 20);
      
      const severityScore = evidenceScore + meterScore + criticalScore + loadScore;
      
      const confidenceScore = evidenceCount > 0 
        ? Math.min(0.5 + (evidenceCount * 0.1), 0.95)
        : 0.3;
      
      return {
        zone_id: zone.zone_id,
        zone_name: zone.zone_name,
        feeder_id: zone.feeder_id,
        substation_id: zone.substation_id,
        evidence_count: evidenceCount,
        affected_meters: meterCount,
        affected_customers: customerCount,
        critical_customers: criticalCustomers,
        severity_score: parseFloat(severityScore.toFixed(2)),
        confidence_score: parseFloat(confidenceScore.toFixed(3)),
        ranking_factors: {
          evidence_score: evidenceScore,
          meter_score: meterScore,
          critical_score: criticalScore,
          load_score: loadScore
        }
      };
    });
    
    rankedZones.sort((a, b) => {
      if (b.severity_score !== a.severity_score) {
        return b.severity_score - a.severity_score;
      }
      if (b.affected_meters !== a.affected_meters) {
        return b.affected_meters - a.affected_meters;
      }
      return a.zone_id.localeCompare(b.zone_id);
    });
    
    rankedZones.forEach((zone, idx) => {
      zone.rank_position = idx + 1;
      zone.reasoning = generateReasoning(zone);
    });
    
    const startTime = Date.now();
    
    const runResult = await client.query(
      `INSERT INTO restoreiq.recommendation_runs 
       (tenant_id, outage_id, run_type, run_at, input_params, output_summary, 
        zones_ranked, status, created_by)
       VALUES ($1, $2, 'fault_zone_ranking', NOW(), $3, $4, $5, 'completed', $6)
       RETURNING run_id, run_at`,
      [
        tenantId, 
        outageId, 
        JSON.stringify({ outageId, tenantId }),
        JSON.stringify({ 
          top_zone: rankedZones[0]?.zone_name,
          top_score: rankedZones[0]?.severity_score,
          total_zones: rankedZones.length,
          advisory: ADVISORY_DISCLAIMER
        }),
        rankedZones.length,
        createdBy
      ]
    );
    
    const runId = runResult.rows[0].run_id;
    const runAt = runResult.rows[0].run_at;
    
    for (const zone of rankedZones) {
      await client.query(
        `INSERT INTO restoreiq.fault_zone_rankings
         (tenant_id, run_id, outage_id, zone_id, zone_name, rank_position,
          confidence_score, evidence_count, affected_meters, affected_customers,
          severity_score, ranking_factors, reasoning)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          tenantId, runId, outageId, zone.zone_id, zone.zone_name, zone.rank_position,
          zone.confidence_score, zone.evidence_count, zone.affected_meters, 
          zone.affected_customers, zone.severity_score, 
          JSON.stringify(zone.ranking_factors), zone.reasoning
        ]
      );
    }
    
    const executionTime = Date.now() - startTime;
    await client.query(
      `UPDATE restoreiq.recommendation_runs SET execution_time_ms = $1 WHERE run_id = $2`,
      [executionTime, runId]
    );
    
    await client.query('COMMIT');
    
    return {
      status: 'completed',
      run_id: runId,
      outage_id: outageId,
      zones_ranked: rankedZones.length,
      rankings: rankedZones.slice(0, 10).map(z => ({
        rank: z.rank_position,
        zone_id: z.zone_id,
        zone_name: z.zone_name,
        severity_score: z.severity_score,
        confidence_score: z.confidence_score,
        evidence_count: z.evidence_count,
        affected_meters: z.affected_meters,
        reasoning: z.reasoning
      })),
      advisory: ADVISORY_DISCLAIMER,
      generated_at: runAt,
      execution_time_ms: executionTime
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function generateReasoning(zone) {
  const parts = [];
  
  if (zone.evidence_count > 0) {
    parts.push(`${zone.evidence_count} telemetry event(s) detected in this zone`);
  }
  
  if (zone.affected_meters > 0) {
    parts.push(`${zone.affected_meters} meter(s) in affected area`);
  }
  
  if (zone.critical_customers > 0) {
    parts.push(`${zone.critical_customers} critical customer(s) impacted`);
  }
  
  if (parts.length === 0) {
    parts.push('Zone included for comprehensive coverage');
  }
  
  return parts.join('. ') + '. ' + ADVISORY_DISCLAIMER;
}

export async function getRankingByRunId(tenantId, runId) {
  const result = await pool.query(
    `SELECT r.*, rr.run_at, rr.outage_id
     FROM restoreiq.fault_zone_rankings r
     JOIN restoreiq.recommendation_runs rr ON r.run_id = rr.run_id
     WHERE r.tenant_id = $1 AND r.run_id = $2
     ORDER BY r.rank_position`,
    [tenantId, runId]
  );
  
  return result.rows;
}

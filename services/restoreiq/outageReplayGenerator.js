/**
 * GridLens RestoreIQ - Outage Replay Generator Service (Step 20)
 * 
 * Generates after-action replay summaries for completed or active outages.
 * Assembles timeline, metrics, findings, and recommendations into a 
 * structured JSONB summary stored in outage_replays.
 * 
 * ADVISORY ONLY - Generated from telemetry available at time of generation.
 */

import { pool } from "../../db.js";

const ADVISORY_DISCLAIMER = "Advisory-only recommendations. Operator validation required. Generated from telemetry available at the time of generation.";

/**
 * Generate an after-action replay for an outage
 * @param {Object} params - Generation parameters
 * @param {string} params.tenantId - Tenant identifier
 * @param {string} params.outageId - Outage UUID
 * @param {string} [params.generatedBy] - User who initiated generation
 * @returns {Object} Replay summary with replay_id
 */
export async function generateAfterActionReplay({ tenantId, outageId, generatedBy = 'system' }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const outageResult = await client.query(
      `SELECT * FROM restoreiq.outages WHERE outage_id = $1 AND tenant_id = $2`,
      [outageId, tenantId]
    );
    
    if (outageResult.rows.length === 0) {
      throw new Error(`Outage ${outageId} not found for tenant ${tenantId}`);
    }
    
    const outage = outageResult.rows[0];
    
    const eventsResult = await client.query(
      `SELECT id, event_type, occurred_at, device_id, feeder_id, source
       FROM restoreiq.events
       WHERE tenant_id = $1 AND canon_outage_id = $2
       ORDER BY occurred_at ASC`,
      [tenantId, outageId]
    );
    
    const events = eventsResult.rows;
    
    const rankingsResult = await client.query(
      `SELECT fzr.*, rr.run_at
       FROM restoreiq.fault_zone_rankings fzr
       JOIN restoreiq.recommendation_runs rr ON fzr.run_id = rr.run_id
       WHERE fzr.tenant_id = $1 AND fzr.outage_id = $2
       ORDER BY rr.run_at DESC, fzr.rank_position ASC
       LIMIT 5`,
      [tenantId, outageId]
    );
    
    const topZones = rankingsResult.rows;
    
    const impactsResult = await client.query(
      `SELECT * FROM restoreiq.outage_impacts WHERE tenant_id = $1 AND outage_id = $2`,
      [tenantId, outageId]
    );
    
    const impacts = impactsResult.rows;
    
    const timeline = buildTimeline(outage, events);
    const metrics = buildMetrics(outage, events, impacts);
    const findings = buildFindings(outage, events, topZones, impacts);
    const recommendations = buildRecommendations(findings);
    const narrative = buildNarrative(outage, metrics, findings);
    
    const summary = {
      outage_id: outageId,
      tenant_id: tenantId,
      generated_at: new Date().toISOString(),
      advisory: ADVISORY_DISCLAIMER,
      milestones: timeline.milestones,
      metrics: metrics,
      narrative: narrative,
      top_recommendations: recommendations.slice(0, 5),
      evidence_counts: {
        total_events: events.length,
        zones_analyzed: topZones.length,
        impacts_recorded: impacts.length
      }
    };
    
    const replayResult = await client.query(
      `INSERT INTO restoreiq.outage_replays
       (tenant_id, outage_id, generated_at, generated_by, replay_type,
        summary, timeline, metrics, findings, recommendations, status)
       VALUES ($1, $2, NOW(), $3, 'after_action', $4, $5, $6, $7, $8, 'draft')
       RETURNING replay_id, generated_at`,
      [
        tenantId,
        outageId,
        generatedBy,
        JSON.stringify(summary),
        JSON.stringify(timeline),
        JSON.stringify(metrics),
        JSON.stringify(findings),
        JSON.stringify(recommendations)
      ]
    );
    
    const replayId = replayResult.rows[0].replay_id;
    const generatedAt = replayResult.rows[0].generated_at;
    
    await client.query('COMMIT');
    
    return {
      status: 'completed',
      replay_id: replayId,
      outage_id: outageId,
      generated_at: generatedAt,
      summary: summary,
      timeline_event_count: timeline.events?.length || 0,
      milestones_count: timeline.milestones?.length || 0,
      findings_count: findings.length,
      recommendations_count: recommendations.length,
      advisory: ADVISORY_DISCLAIMER
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function buildTimeline(outage, events) {
  const milestones = [];
  
  milestones.push({
    timestamp: outage.start_at,
    type: 'outage_start',
    description: `Outage detected on ${outage.primary_feeder_id || 'unknown feeder'}`,
    source: 'system'
  });
  
  if (events.length > 0) {
    const firstEvent = events[0];
    milestones.push({
      timestamp: firstEvent.occurred_at,
      type: 'first_event',
      description: `First telemetry event: ${firstEvent.event_type}`,
      source: firstEvent.source
    });
  }
  
  const eventTypes = {};
  for (const event of events) {
    eventTypes[event.event_type] = (eventTypes[event.event_type] || 0) + 1;
  }
  
  for (const [eventType, count] of Object.entries(eventTypes)) {
    if (count >= 3) {
      const eventsOfType = events.filter(e => e.event_type === eventType);
      const midEvent = eventsOfType[Math.floor(eventsOfType.length / 2)];
      milestones.push({
        timestamp: midEvent.occurred_at,
        type: 'event_cluster',
        description: `${count} ${eventType} events detected`,
        source: 'analysis'
      });
    }
  }
  
  if (outage.end_at) {
    milestones.push({
      timestamp: outage.end_at,
      type: 'outage_end',
      description: 'Outage resolved',
      source: 'system'
    });
  }
  
  if (outage.actual_restore_at) {
    milestones.push({
      timestamp: outage.actual_restore_at,
      type: 'restoration_complete',
      description: 'Power restored to all affected customers',
      source: 'system'
    });
  }
  
  milestones.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  return {
    milestones,
    events: events.slice(0, 50).map(e => ({
      timestamp: e.occurred_at,
      type: e.event_type,
      device_id: e.device_id,
      feeder_id: e.feeder_id
    }))
  };
}

function buildMetrics(outage, events, impacts) {
  const durationMinutes = outage.duration_minutes || 
    (outage.end_at && outage.start_at 
      ? Math.round((new Date(outage.end_at) - new Date(outage.start_at)) / 60000)
      : null);
  
  const totalLossDollars = impacts.reduce((sum, i) => 
    sum + (parseFloat(i.estimated_loss_dollars) || 0), 0);
  
  const totalLoadKw = impacts.reduce((sum, i) => 
    sum + (parseFloat(i.estimated_load_kw) || 0), 0);
  
  return {
    duration_minutes: durationMinutes,
    affected_customers: outage.affected_customers || 0,
    affected_meters: outage.affected_meters || 0,
    total_events: events.length,
    saidi_contribution: parseFloat(outage.saidi_contribution_minutes) || null,
    saifi_contribution: parseFloat(outage.saifi_contribution) || null,
    cmi_contribution: outage.cmi_contribution || null,
    estimated_loss_dollars: parseFloat(totalLossDollars.toFixed(2)),
    estimated_load_kw: parseFloat(totalLoadKw.toFixed(2)),
    crews_deployed: outage.restoration_crew_count || 0,
    severity: outage.severity,
    is_major_event: outage.is_major_event
  };
}

function buildFindings(outage, events, topZones, impacts) {
  const findings = [];
  
  if (topZones.length > 0) {
    findings.push({
      category: 'fault_localization',
      severity: 'high',
      title: 'Primary Fault Zone Identified',
      description: `Zone "${topZones[0].zone_name}" ranked highest with severity score ${topZones[0].severity_score}`,
      evidence_count: topZones[0].evidence_count,
      recommendation: 'Prioritize inspection of this zone for root cause analysis'
    });
  }
  
  const eventTypes = {};
  for (const event of events) {
    eventTypes[event.event_type] = (eventTypes[event.event_type] || 0) + 1;
  }
  
  const sortedTypes = Object.entries(eventTypes).sort((a, b) => b[1] - a[1]);
  if (sortedTypes.length > 0) {
    findings.push({
      category: 'event_analysis',
      severity: 'medium',
      title: 'Dominant Event Type',
      description: `${sortedTypes[0][1]} events of type "${sortedTypes[0][0]}" recorded`,
      evidence_count: sortedTypes[0][1],
      recommendation: 'Review event patterns for preventive maintenance opportunities'
    });
  }
  
  const criticalImpacts = impacts.filter(i => i.critical_customers > 0);
  if (criticalImpacts.length > 0) {
    const totalCritical = criticalImpacts.reduce((sum, i) => sum + i.critical_customers, 0);
    findings.push({
      category: 'customer_impact',
      severity: 'critical',
      title: 'Critical Customers Affected',
      description: `${totalCritical} critical customer(s) experienced service interruption`,
      evidence_count: criticalImpacts.length,
      recommendation: 'Review critical customer notification and priority restoration procedures'
    });
  }
  
  if (outage.duration_minutes && outage.duration_minutes > 120) {
    findings.push({
      category: 'duration',
      severity: 'high',
      title: 'Extended Outage Duration',
      description: `Outage lasted ${outage.duration_minutes} minutes (${(outage.duration_minutes / 60).toFixed(1)} hours)`,
      evidence_count: 1,
      recommendation: 'Analyze restoration timeline for process improvement opportunities'
    });
  }
  
  return findings;
}

function buildRecommendations(findings) {
  const recommendations = findings
    .filter(f => f.recommendation)
    .map((f, idx) => ({
      priority: idx + 1,
      category: f.category,
      action: f.recommendation,
      rationale: f.description,
      advisory: 'Operator validation required before implementation'
    }));
  
  recommendations.push({
    priority: recommendations.length + 1,
    category: 'documentation',
    action: 'Complete after-action report and file for regulatory compliance',
    rationale: 'Standard post-outage documentation requirement',
    advisory: 'Operator validation required before implementation'
  });
  
  return recommendations;
}

function buildNarrative(outage, metrics, findings) {
  const parts = [];
  
  parts.push(`On ${new Date(outage.start_at).toLocaleString()}, an ${outage.outage_type || 'unplanned'} outage occurred affecting ${metrics.affected_customers} customer(s).`);
  
  if (metrics.duration_minutes) {
    parts.push(`The outage lasted approximately ${metrics.duration_minutes} minutes.`);
  }
  
  if (outage.primary_feeder_id) {
    parts.push(`The primary affected feeder was ${outage.primary_feeder_id}.`);
  }
  
  const criticalFinding = findings.find(f => f.severity === 'critical');
  if (criticalFinding) {
    parts.push(criticalFinding.description + '.');
  }
  
  const faultFinding = findings.find(f => f.category === 'fault_localization');
  if (faultFinding) {
    parts.push(faultFinding.description + '.');
  }
  
  parts.push(ADVISORY_DISCLAIMER);
  
  return parts.join(' ');
}

export async function getReplayById(tenantId, replayId) {
  const result = await pool.query(
    `SELECT * FROM restoreiq.outage_replays WHERE tenant_id = $1 AND replay_id = $2`,
    [tenantId, replayId]
  );
  
  return result.rows[0] || null;
}

export async function getReplaysByOutage(tenantId, outageId) {
  const result = await pool.query(
    `SELECT replay_id, generated_at, generated_by, replay_type, status
     FROM restoreiq.outage_replays 
     WHERE tenant_id = $1 AND outage_id = $2
     ORDER BY generated_at DESC`,
    [tenantId, outageId]
  );
  
  return result.rows;
}

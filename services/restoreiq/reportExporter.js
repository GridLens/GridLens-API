/**
 * GridLens RestoreIQ - Report Exporter Service (Step 21)
 * 
 * Exports after-action reports to PDF format.
 * Uses a simple PDF generation approach with formatted text.
 * Supports multiple storage backends via Storage Adapter (local/azure).
 * 
 * ADVISORY ONLY - Reports are for informational purposes only.
 */

import { pool } from "../../db.js";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as storageAdapter from "./storage/storageAdapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADVISORY_DISCLAIMER = "Advisory-only recommendations. Operator validation required. Generated from telemetry available at the time of generation.";

/**
 * Export an after-action report to PDF
 * @param {Object} params - Export parameters
 * @param {string} params.tenantId - Tenant identifier
 * @param {string} params.replayId - Replay UUID
 * @param {string} [params.outageId] - Outage UUID (optional, derived from replay)
 * @returns {Object} Export result with file path
 */
export async function exportAfterActionReport({ tenantId, replayId, outageId }) {
  await storageAdapter.init();
  
  const replayResult = await pool.query(
    `SELECT r.*, o.start_at as outage_start, o.end_at as outage_end,
            o.primary_feeder_id, o.affected_customers, o.severity
     FROM restoreiq.outage_replays r
     JOIN restoreiq.outages o ON r.outage_id = o.outage_id
     WHERE r.tenant_id = $1 AND r.replay_id = $2`,
    [tenantId, replayId]
  );
  
  if (replayResult.rows.length === 0) {
    throw new Error(`Replay ${replayId} not found for tenant ${tenantId}`);
  }
  
  const replay = replayResult.rows[0];
  const summary = replay.summary || {};
  const metrics = replay.metrics || {};
  const findings = replay.findings || [];
  const recommendations = replay.recommendations || [];
  const timeline = replay.timeline || {};
  
  const tempDir = path.join(__dirname, '../../reports');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const pdfFilename = `after-action-${replay.outage_id}-${timestamp}.pdf`;
  const tempPdfPath = path.join(tempDir, pdfFilename);
  
  const reportContent = buildReportContent(replay, summary, metrics, findings, recommendations, timeline);
  
  await generatePdfReport(reportContent, tempPdfPath);
  
  const { blobRef } = await storageAdapter.putPdf(tempPdfPath, pdfFilename, 'application/pdf');
  
  const reportBlobRef = {
    ...blobRef,
    format: 'pdf',
    advisory: ADVISORY_DISCLAIMER
  };
  
  await pool.query(
    `UPDATE restoreiq.outage_replays 
     SET report_blob_ref = $1, updated_at = NOW()
     WHERE replay_id = $2`,
    [JSON.stringify(reportBlobRef), replayId]
  );
  
  const providerName = storageAdapter.getProviderName();
  console.log(`[RestoreIQ] PDF exported via ${providerName}: ${pdfFilename}`);
  
  return {
    status: 'completed',
    replay_id: replayId,
    outage_id: replay.outage_id,
    storage_provider: providerName,
    generated_at: reportBlobRef.pdf_generated_at,
    advisory: ADVISORY_DISCLAIMER
  };
}

function buildReportContent(replay, summary, metrics, findings, recommendations, timeline) {
  const lines = [];
  
  lines.push('=' .repeat(60));
  lines.push('GRIDLENS RESTOREIQ - AFTER-ACTION REPORT');
  lines.push('=' .repeat(60));
  lines.push('');
  lines.push('ADVISORY: This report is for informational purposes only.');
  lines.push('Operator validation required before any actions.');
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('OUTAGE SUMMARY');
  lines.push('-'.repeat(60));
  lines.push(`Outage ID: ${replay.outage_id}`);
  lines.push(`Tenant: ${replay.tenant_id}`);
  lines.push(`Start Time: ${new Date(replay.outage_start).toLocaleString()}`);
  if (replay.outage_end) {
    lines.push(`End Time: ${new Date(replay.outage_end).toLocaleString()}`);
  }
  lines.push(`Primary Feeder: ${replay.primary_feeder_id || 'N/A'}`);
  lines.push(`Affected Customers: ${replay.affected_customers || 0}`);
  lines.push(`Severity: ${replay.severity || 'Unknown'}`);
  lines.push('');
  
  lines.push('-'.repeat(60));
  lines.push('KEY METRICS');
  lines.push('-'.repeat(60));
  if (metrics.duration_minutes) {
    lines.push(`Duration: ${metrics.duration_minutes} minutes`);
  }
  lines.push(`Affected Meters: ${metrics.affected_meters || 0}`);
  lines.push(`Total Events: ${metrics.total_events || 0}`);
  if (metrics.estimated_loss_dollars) {
    lines.push(`Estimated Loss: $${metrics.estimated_loss_dollars.toLocaleString()}`);
  }
  if (metrics.saidi_contribution) {
    lines.push(`SAIDI Contribution: ${metrics.saidi_contribution} minutes`);
  }
  if (metrics.crews_deployed) {
    lines.push(`Crews Deployed: ${metrics.crews_deployed}`);
  }
  lines.push('');
  
  if (summary.narrative) {
    lines.push('-'.repeat(60));
    lines.push('EXECUTIVE SUMMARY');
    lines.push('-'.repeat(60));
    lines.push(summary.narrative);
    lines.push('');
  }
  
  if (timeline.milestones && timeline.milestones.length > 0) {
    lines.push('-'.repeat(60));
    lines.push('TIMELINE');
    lines.push('-'.repeat(60));
    for (const milestone of timeline.milestones.slice(0, 10)) {
      const time = new Date(milestone.timestamp).toLocaleString();
      lines.push(`[${time}] ${milestone.description}`);
    }
    lines.push('');
  }
  
  if (findings.length > 0) {
    lines.push('-'.repeat(60));
    lines.push('FINDINGS');
    lines.push('-'.repeat(60));
    for (let i = 0; i < Math.min(findings.length, 10); i++) {
      const finding = findings[i];
      lines.push(`${i + 1}. [${finding.severity?.toUpperCase()}] ${finding.title}`);
      lines.push(`   ${finding.description}`);
      if (finding.recommendation) {
        lines.push(`   Recommendation: ${finding.recommendation}`);
      }
      lines.push('');
    }
  }
  
  if (recommendations.length > 0) {
    lines.push('-'.repeat(60));
    lines.push('RECOMMENDATIONS');
    lines.push('-'.repeat(60));
    for (let i = 0; i < Math.min(recommendations.length, 5); i++) {
      const rec = recommendations[i];
      lines.push(`${i + 1}. ${rec.action}`);
      lines.push(`   Rationale: ${rec.rationale}`);
      lines.push('');
    }
  }
  
  lines.push('');
  lines.push('=' .repeat(60));
  lines.push('DISCLAIMER');
  lines.push('=' .repeat(60));
  lines.push(ADVISORY_DISCLAIMER);
  lines.push('');
  lines.push(`Report Generated: ${new Date().toLocaleString()}`);
  lines.push(`Replay ID: ${replay.replay_id}`);
  lines.push('');
  lines.push('GridLens RestoreIQ - Outage Intelligence Platform');
  lines.push('');
  
  return lines.join('\n');
}

async function generatePdfReport(content, outputPath) {
  const textPath = outputPath.replace('.pdf', '.txt');
  fs.writeFileSync(textPath, content, 'utf-8');
  
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sys
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    
    text_path = sys.argv[1]
    pdf_path = sys.argv[2]
    
    with open(text_path, 'r') as f:
        content = f.read()
    
    doc = SimpleDocTemplate(pdf_path, pagesize=letter,
                           topMargin=0.75*inch, bottomMargin=0.75*inch,
                           leftMargin=0.75*inch, rightMargin=0.75*inch)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=14, spaceAfter=12)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, spaceAfter=6)
    
    story = []
    
    for line in content.split('\\n'):
        if line.startswith('='):
            story.append(Spacer(1, 12))
        elif line.startswith('-'):
            story.append(Spacer(1, 6))
        elif line.strip():
            safe_line = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            if line.isupper() or 'GRIDLENS' in line:
                story.append(Paragraph(safe_line, title_style))
            else:
                story.append(Paragraph(safe_line, body_style))
    
    doc.build(story)
    print(f"PDF generated: {pdf_path}")
    
except ImportError:
    with open(pdf_path, 'wb') as f:
        f.write(b'%PDF-1.4\\n')
        f.write(b'1 0 obj <</Type/Catalog/Pages 2 0 R>>endobj\\n')
        f.write(b'2 0 obj <</Type/Pages/Kids[3 0 R]/Count 1>>endobj\\n')
        f.write(b'3 0 obj <</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\\n')
        f.write(b'xref\\n0 4\\n')
        f.write(b'0000000000 65535 f\\n')
        f.write(b'0000000009 00000 n\\n')
        f.write(b'0000000052 00000 n\\n')
        f.write(b'0000000101 00000 n\\n')
        f.write(b'trailer<</Size 4/Root 1 0 R>>\\n')
        f.write(b'startxref\\n167\\n')
        f.write(b'%%EOF\\n')
    print(f"Basic PDF generated (reportlab not available): {pdf_path}")
`;

    const python = spawn('python3', ['-c', pythonScript, textPath, outputPath]);
    
    let stdout = '';
    let stderr = '';
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    python.on('close', (code) => {
      if (fs.existsSync(textPath)) {
        fs.unlinkSync(textPath);
      }
      
      if (code === 0 || fs.existsSync(outputPath)) {
        resolve({ path: outputPath, stdout, stderr });
      } else {
        fs.writeFileSync(outputPath, content, 'utf-8');
        resolve({ path: outputPath, fallback: true });
      }
    });
    
    python.on('error', (err) => {
      fs.writeFileSync(outputPath, content, 'utf-8');
      resolve({ path: outputPath, fallback: true, error: err.message });
    });
  });
}

export async function getReportBlobRef(tenantId, replayId) {
  const result = await pool.query(
    `SELECT report_blob_ref FROM restoreiq.outage_replays 
     WHERE tenant_id = $1 AND replay_id = $2`,
    [tenantId, replayId]
  );
  
  return result.rows[0]?.report_blob_ref || null;
}

export async function getReportStream(tenantId, replayId) {
  const blobRef = await getReportBlobRef(tenantId, replayId);
  
  if (!blobRef) {
    return null;
  }
  
  await storageAdapter.init();
  
  const stream = await storageAdapter.getPdf(blobRef);
  
  return {
    stream,
    fileName: blobRef.file_name || `report-${replayId}.pdf`,
    contentType: blobRef.content_type || 'application/pdf',
    provider: blobRef.provider || 'local'
  };
}

export async function getStorageProviderInfo() {
  return storageAdapter.getProviderInfo();
}

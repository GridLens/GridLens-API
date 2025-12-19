#!/bin/bash
# =============================================================================
# GridLens RestoreIQ Smoke Test Script
# =============================================================================
# 
# This script tests the RestoreIQ endpoints:
#   - Step 17: POST /api/v1/fault-zones/rank
#   - Step 20: POST /api/v1/replays/after-action/generate
#   - Step 21: POST /api/v1/reports/after-action/export
#
# Prerequisites:
#   - RestoreIQ schema applied to database
#   - At least one outage record in restoreiq.outages
#   - Server running on localhost:5000
#
# Usage:
#   chmod +x scripts/smoke_restoreiq.sh
#   ./scripts/smoke_restoreiq.sh
#
# =============================================================================

set -e

BASE_URL="${API_BASE_URL:-http://localhost:5000}"
TENANT_ID="${TENANT_ID:-DEMO_TENANT}"

echo "=============================================="
echo "GridLens RestoreIQ Smoke Test"
echo "=============================================="
echo "Base URL: $BASE_URL"
echo "Tenant ID: $TENANT_ID"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

check_response() {
    local response="$1"
    local expected="$2"
    local step="$3"
    
    if echo "$response" | grep -q "$expected"; then
        echo -e "${GREEN}✓ $step: PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ $step: FAIL${NC}"
        echo "Response: $response"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Test 0: Health Check
# -----------------------------------------------------------------------------
echo "--- Test 0: Health Check ---"

HEALTH=$(curl -s "$BASE_URL/api/v1/health")
check_response "$HEALTH" "RestoreIQ" "Health check"
echo ""

# -----------------------------------------------------------------------------
# Test 1: Create Test Outage (if needed)
# -----------------------------------------------------------------------------
echo "--- Test 1: Ensure Test Outage Exists ---"

# Check if outage exists, create one if not
OUTAGE_CHECK=$(curl -s "$BASE_URL/api/v1/replays/outage/00000000-0000-0000-0000-000000000001?tenantId=$TENANT_ID" 2>/dev/null || echo '{"error":"not found"}')

if echo "$OUTAGE_CHECK" | grep -q "error"; then
    echo -e "${YELLOW}Note: No test outage found. Create one in restoreiq.outages first.${NC}"
    echo ""
    echo "Example SQL to create test outage:"
    echo "  INSERT INTO restoreiq.outages (outage_id, tenant_id, start_at, affected_customers)"
    echo "  VALUES ('00000000-0000-0000-0000-000000000001', 'DEMO_TENANT', NOW() - INTERVAL '2 hours', 150);"
    echo ""
    OUTAGE_ID="00000000-0000-0000-0000-000000000001"
else
    echo -e "${GREEN}✓ Test outage found${NC}"
    OUTAGE_ID="00000000-0000-0000-0000-000000000001"
fi
echo ""

# -----------------------------------------------------------------------------
# Test 2: Step 17 - Rank Fault Zones
# -----------------------------------------------------------------------------
echo "--- Test 2: POST /api/v1/fault-zones/rank (Step 17) ---"

echo "Request:"
echo "  curl -X POST $BASE_URL/api/v1/fault-zones/rank \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"tenantId\": \"$TENANT_ID\", \"outageId\": \"$OUTAGE_ID\"}'"
echo ""

RANK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/fault-zones/rank" \
    -H "Content-Type: application/json" \
    -d "{\"tenantId\": \"$TENANT_ID\", \"outageId\": \"$OUTAGE_ID\"}" 2>/dev/null || echo '{"status":"error"}')

echo "Response (truncated):"
echo "$RANK_RESPONSE" | head -c 500
echo ""
echo ""

if echo "$RANK_RESPONSE" | grep -q '"status"'; then
    echo -e "${GREEN}✓ Fault zone ranking endpoint responded${NC}"
    
    # Extract run_id if present
    RUN_ID=$(echo "$RANK_RESPONSE" | grep -o '"run_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$RUN_ID" ]; then
        echo "  run_id: $RUN_ID"
    fi
else
    echo -e "${RED}✗ Fault zone ranking failed${NC}"
fi
echo ""

# -----------------------------------------------------------------------------
# Test 3: Step 20 - Generate After-Action Replay
# -----------------------------------------------------------------------------
echo "--- Test 3: POST /api/v1/replays/after-action/generate (Step 20) ---"

echo "Request:"
echo "  curl -X POST $BASE_URL/api/v1/replays/after-action/generate \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"tenantId\": \"$TENANT_ID\", \"outageId\": \"$OUTAGE_ID\"}'"
echo ""

REPLAY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/replays/after-action/generate" \
    -H "Content-Type: application/json" \
    -d "{\"tenantId\": \"$TENANT_ID\", \"outageId\": \"$OUTAGE_ID\"}" 2>/dev/null || echo '{"status":"error"}')

echo "Response (truncated):"
echo "$REPLAY_RESPONSE" | head -c 500
echo ""
echo ""

if echo "$REPLAY_RESPONSE" | grep -q '"replay_id"'; then
    echo -e "${GREEN}✓ Replay generation endpoint responded${NC}"
    
    # Extract replay_id
    REPLAY_ID=$(echo "$REPLAY_RESPONSE" | grep -o '"replay_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$REPLAY_ID" ]; then
        echo "  replay_id: $REPLAY_ID"
    fi
else
    echo -e "${YELLOW}⚠ Replay generation may have failed (check if outage exists)${NC}"
    REPLAY_ID=""
fi
echo ""

# -----------------------------------------------------------------------------
# Test 4: Step 21 - Export After-Action Report (PDF)
# -----------------------------------------------------------------------------
echo "--- Test 4: POST /api/v1/reports/after-action/export (Step 21) ---"

if [ -n "$REPLAY_ID" ]; then
    echo "Request:"
    echo "  curl -X POST $BASE_URL/api/v1/reports/after-action/export \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"tenantId\": \"$TENANT_ID\", \"replayId\": \"$REPLAY_ID\"}'"
    echo ""

    EXPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/reports/after-action/export" \
        -H "Content-Type: application/json" \
        -d "{\"tenantId\": \"$TENANT_ID\", \"replayId\": \"$REPLAY_ID\"}" 2>/dev/null || echo '{"status":"error"}')

    echo "Response:"
    echo "$EXPORT_RESPONSE"
    echo ""

    if echo "$EXPORT_RESPONSE" | grep -q '"pdf_path"'; then
        echo -e "${GREEN}✓ Report export endpoint responded${NC}"
        PDF_PATH=$(echo "$EXPORT_RESPONSE" | grep -o '"pdf_path":"[^"]*"' | head -1 | cut -d'"' -f4)
        echo "  PDF path: $PDF_PATH"
    else
        echo -e "${YELLOW}⚠ Report export may have failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping export test (no replay_id available)${NC}"
fi
echo ""

# -----------------------------------------------------------------------------
# Test 5: Get Report Download Info
# -----------------------------------------------------------------------------
echo "--- Test 5: GET /api/v1/reports/:replayId/download ---"

if [ -n "$REPLAY_ID" ]; then
    echo "Request:"
    echo "  curl -s $BASE_URL/api/v1/reports/$REPLAY_ID/download?tenantId=$TENANT_ID"
    echo ""

    DOWNLOAD_RESPONSE=$(curl -s "$BASE_URL/api/v1/reports/$REPLAY_ID/download?tenantId=$TENANT_ID" 2>/dev/null || echo '{"status":"error"}')

    echo "Response:"
    echo "$DOWNLOAD_RESPONSE"
    echo ""

    if echo "$DOWNLOAD_RESPONSE" | grep -q '"report"'; then
        echo -e "${GREEN}✓ Report download info retrieved${NC}"
    else
        echo -e "${YELLOW}⚠ Report download info not available${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping download test (no replay_id available)${NC}"
fi
echo ""

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo "=============================================="
echo "Smoke Test Complete"
echo "=============================================="
echo ""
echo "Manual curl examples for testing:"
echo ""
echo "1. Rank Fault Zones:"
echo "   curl -X POST $BASE_URL/api/v1/fault-zones/rank \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"tenantId\": \"DEMO_TENANT\", \"outageId\": \"YOUR_OUTAGE_UUID\"}'"
echo ""
echo "2. Generate Replay:"
echo "   curl -X POST $BASE_URL/api/v1/replays/after-action/generate \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"tenantId\": \"DEMO_TENANT\", \"outageId\": \"YOUR_OUTAGE_UUID\"}'"
echo ""
echo "3. Export PDF Report:"
echo "   curl -X POST $BASE_URL/api/v1/reports/after-action/export \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"tenantId\": \"DEMO_TENANT\", \"replayId\": \"YOUR_REPLAY_UUID\"}'"
echo ""

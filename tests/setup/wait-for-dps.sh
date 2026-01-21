#!/bin/bash
# Wait for DPS (Delegated Proving Service) to be ready

set -e

DPS_PORT=${DPS_PORT:-3000}
DPS_HEALTH_URL="http://localhost:${DPS_PORT}/health"
TIMEOUT=${DPS_TIMEOUT:-120}  # 2 minutes default (DPS needs time to load proving keys)

echo "Waiting for DPS to be ready..."
echo "   Health URL: $DPS_HEALTH_URL"
echo "   Timeout: ${TIMEOUT}s"

START_TIME=$(date +%s)
while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    
    if [ $ELAPSED -ge $TIMEOUT ]; then
        echo "Error: DPS did not become ready within ${TIMEOUT}s" >&2
        echo "Check DPS logs at /tmp/dps-logs/dps.log" >&2
        exit 1
    fi
    
    if curl -s -f "$DPS_HEALTH_URL" > /dev/null 2>&1; then
        echo "DPS is ready! (took ${ELAPSED}s)"
        exit 0
    fi
    
    echo "   Waiting... (${ELAPSED}s elapsed)"
    sleep 5
done

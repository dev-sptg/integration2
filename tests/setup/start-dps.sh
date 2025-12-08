#!/bin/bash
# Start the DPS (Delegated Proving Service) for integration testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTEGRATION_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Configuration
DPS_PORT=3000
LOG_DIR="/tmp/dps-logs"
PID_FILE="/tmp/dps.pid"

# Find DPS binary
# Priority: 1) DPS_BINARY_PATH env var, 2) local_build paths
if [ -n "$DPS_BINARY_PATH" ] && [ -f "$DPS_BINARY_PATH" ]; then
    DPS_BIN="$DPS_BINARY_PATH"
elif [ -f "$INTEGRATION_ROOT/local_build/dps/bin/prover" ]; then
    DPS_BIN="$INTEGRATION_ROOT/local_build/dps/bin/prover"
elif [ -f "$INTEGRATION_ROOT/local_build/dps/prover" ]; then
    DPS_BIN="$INTEGRATION_ROOT/local_build/dps/prover"
else
    echo "Error: DPS binary (prover) not found." >&2
    echo "Searched locations:" >&2
    echo "  - \$DPS_BINARY_PATH: ${DPS_BINARY_PATH:-not set}" >&2
    echo "  - $INTEGRATION_ROOT/local_build/dps/bin/prover" >&2
    echo "  - $INTEGRATION_ROOT/local_build/dps/prover" >&2
    exit 1
fi

echo "Using DPS binary: $DPS_BIN"

# Create log directory
mkdir -p "$LOG_DIR"

# Check if DPS is already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "Warning: DPS already running (PID: $OLD_PID)" >&2
        exit 0
    else
        echo "Removing stale PID file"
        rm -f "$PID_FILE"
    fi
fi

# Start DPS
echo "Starting DPS..."
echo "   Address: 0.0.0.0:$DPS_PORT"
echo "   Network: testnet"
echo "   Endpoint: http://localhost:3030/v2"
echo "   Programs endpoint: http://localhost:3030/v2"
echo "   Logs: $LOG_DIR/dps.log"

LOG_FILE="$LOG_DIR/dps.log"

# Start DPS in background
cd "$(dirname "$DPS_BIN")"
nohup "$DPS_BIN" \
    --addr "0.0.0.0:$DPS_PORT" \
    --network testnet \
    --endpoint "http://localhost:3030/v2" \
    --programs-endpoint "http://localhost:3030/v2" \
    --rayon-threads 4 \
    --tokio-worker-threads 4 \
    --tokio-blocking-threads 8 \
    --verbosity 1 \
    > "$LOG_FILE" 2>&1 &

DPS_PID=$!
echo "$DPS_PID" > "$PID_FILE"

echo ""
echo "DPS started (PID: $DPS_PID)"
echo "   PID file: $PID_FILE"
echo ""
echo "Use './tests/setup/stop-dps.sh' to stop DPS"

# Wait a moment and check if it's still running
sleep 2
if ! ps -p "$DPS_PID" > /dev/null 2>&1; then
    echo "Error: DPS process died immediately. Check logs: $LOG_FILE" >&2
    rm -f "$PID_FILE"
    exit 1
fi

echo "DPS is running"


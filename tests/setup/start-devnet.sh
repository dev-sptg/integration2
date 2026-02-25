#!/bin/bash
# Start a local snarkOS devnet for integration testing
# 4 validators (minimum required for genesis committee)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTEGRATION_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Configuration
TOTAL_VALIDATORS=4
NETWORK_ID=1
LOG_DIR="/tmp/snarkos-devnet-logs"

# Find snarkOS binary
# Priority: 1) SNARKOS_BINARY_PATH env var, 2) direct binary, 3) target/release path
if [ -n "$SNARKOS_BINARY_PATH" ] && [ -f "$SNARKOS_BINARY_PATH" ]; then
    SNARKOS_BIN="$SNARKOS_BINARY_PATH"
elif [ -f "$INTEGRATION_ROOT/local_build/snarkOS/snarkos" ]; then
    SNARKOS_BIN="$INTEGRATION_ROOT/local_build/snarkOS/snarkos"
elif [ -f "$INTEGRATION_ROOT/local_build/snarkOS/target/release/snarkos" ]; then
    SNARKOS_BIN="$INTEGRATION_ROOT/local_build/snarkOS/target/release/snarkos"
elif [ -f "$INTEGRATION_ROOT/snarkOS/target/release/snarkos" ]; then
    SNARKOS_BIN="$INTEGRATION_ROOT/snarkOS/target/release/snarkos"
else
    echo "Error: snarkOS binary not found." >&2
    echo "Searched locations:" >&2
    echo "  - \$SNARKOS_BINARY_PATH: ${SNARKOS_BINARY_PATH:-not set}" >&2
    echo "  - $INTEGRATION_ROOT/local_build/snarkOS/snarkos" >&2
    echo "  - $INTEGRATION_ROOT/local_build/snarkOS/target/release/snarkos" >&2
    echo "  - $INTEGRATION_ROOT/snarkOS/target/release/snarkos" >&2
    exit 1
fi

echo "Using snarkOS binary: $SNARKOS_BIN"

# Create log directory
mkdir -p "$LOG_DIR"

# PID file to track all validator processes
PID_FILE="/tmp/snarkos-devnet-test.pid"

# Clean up old devnet data for all validators
echo "Cleaning old devnet data..."
for ((i = 0; i < TOTAL_VALIDATORS; i++)); do
    "$SNARKOS_BIN" clean --dev $i --network $NETWORK_ID 2>/dev/null || true
done

# Start devnet
echo "Starting snarkOS devnet..."
echo "   Network: testnet (ID: $NETWORK_ID)"
echo "   Mode: $TOTAL_VALIDATORS validators (dev 0-$((TOTAL_VALIDATORS-1)))"
echo "   REST API: http://localhost:3030 (validator 0)"
echo "   Logs: $LOG_DIR/"

# Start all validators in the background
PIDS=()
for ((i = 0; i < TOTAL_VALIDATORS; i++)); do
    LOG_FILE="$LOG_DIR/validator-$i.log"
    
    if [ $i -eq 0 ]; then
        # First validator with metrics and REST API
        nohup "$SNARKOS_BIN" start \
            --nodisplay \
            --dev $i \
            --dev-num-validators $TOTAL_VALIDATORS \
            --validator \
            --network $NETWORK_ID \
            --verbosity 1 \
            --no-dev-txs \
            > "$LOG_FILE" 2>&1 &
    else
        # Other validators
        nohup "$SNARKOS_BIN" start \
            --nodisplay \
            --dev $i \
            --dev-num-validators $TOTAL_VALIDATORS \
            --validator \
            --network $NETWORK_ID \
            --verbosity 1 \
            > "$LOG_FILE" 2>&1 &
    fi
    
    PIDS+=($!)
    echo "Started validator $i (PID: $!)"
    
    # Small delay between starts to avoid rate limits
    sleep 1
done

# Save all PIDs to file (space-separated)
echo "${PIDS[@]}" > "$PID_FILE"

echo ""
echo "DevNet started with ${#PIDS[@]} validators"
echo "   PID file: $PID_FILE"
echo ""
echo "Use './tests/setup/stop-devnet.sh' to stop the devnet"


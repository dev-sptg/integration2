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
if [ -d "$INTEGRATION_ROOT/local_build/snarkOS" ]; then
    SNARKOS_BASE="$INTEGRATION_ROOT/local_build/snarkOS"
elif [ -d "$INTEGRATION_ROOT/snarkOS" ]; then
    SNARKOS_BASE="$INTEGRATION_ROOT/snarkOS"
else
    echo "Error: snarkOS not found. Please build snarkOS first." >&2
    exit 1
fi

SNARKOS_BIN="$SNARKOS_BASE/target/release/snarkos"

if [ ! -f "$SNARKOS_BIN" ]; then
    echo "Error: snarkOS binary not found at $SNARKOS_BIN" >&2
    echo "Build with: cd $SNARKOS_BASE && cargo build --release"
    exit 1
fi

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


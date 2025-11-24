#!/bin/bash
# Stop the local snarkOS devnet (all validators)

PID_FILE="/tmp/snarkos-devnet-test.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "Warning: No devnet PID file found" >&2
    exit 0
fi

# Read all PIDs (space-separated)
PIDS=($(cat "$PID_FILE"))

echo "Stopping devnet validators..."
for DEVNET_PID in "${PIDS[@]}"; do
    if ps -p "$DEVNET_PID" > /dev/null 2>&1; then
        echo "   Stopping validator (PID: $DEVNET_PID)..."
        kill "$DEVNET_PID" 2>/dev/null || true
        
        # Wait up to 3 seconds for graceful shutdown
        for i in {1..3}; do
            if ! ps -p "$DEVNET_PID" > /dev/null 2>&1; then
                break
            fi
            sleep 1
        done
        
        # Force kill if still running
        if ps -p "$DEVNET_PID" > /dev/null 2>&1; then
            echo "   Force killing (PID: $DEVNET_PID)..."
            kill -9 "$DEVNET_PID" 2>/dev/null || true
        fi
    else
        echo "   Warning: Validator not running (PID: $DEVNET_PID)" >&2
    fi
done

echo "DevNet stopped"
rm -f "$PID_FILE"


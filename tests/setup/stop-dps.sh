#!/bin/bash
# Stop the DPS (Delegated Proving Service)

PID_FILE="/tmp/dps.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "Warning: No DPS PID file found" >&2
    exit 0
fi

DPS_PID=$(cat "$PID_FILE")

if ps -p "$DPS_PID" > /dev/null 2>&1; then
    echo "Stopping DPS (PID: $DPS_PID)..."
    kill "$DPS_PID" 2>/dev/null || true
    
    # Wait up to 5 seconds for graceful shutdown
    for _ in {1..5}; do
        if ! ps -p "$DPS_PID" > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done
    
    # Force kill if still running
    if ps -p "$DPS_PID" > /dev/null 2>&1; then
        echo "Force killing DPS (PID: $DPS_PID)..."
        kill -9 "$DPS_PID" 2>/dev/null || true
    fi
    
    echo "DPS stopped"
else
    echo "Warning: DPS not running (PID: $DPS_PID)" >&2
fi

rm -f "$PID_FILE"


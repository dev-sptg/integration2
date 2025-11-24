#!/bin/bash
# Wait for snarkOS devnet to be ready

API_URL="http://localhost:3030/v2/testnet/block/height/latest"
MAX_WAIT=180  # seconds (4 validators need time to connect and sync)
INTERVAL=1   # seconds

echo "Waiting for devnet to be ready..."
echo "   Checking: $API_URL"

for i in $(seq 1 $MAX_WAIT); do
    if curl -s -f "$API_URL" > /dev/null 2>&1; then
        HEIGHT=$(curl -s "$API_URL" 2>/dev/null)
        echo "DevNet is ready (height: $HEIGHT)"
        exit 0
    fi
    
    if [ $((i % 15)) -eq 0 ]; then
        echo "   Still waiting... (${i}s/${MAX_WAIT}s)"
    fi
    
    sleep $INTERVAL
done

echo "Error: DevNet failed to start within ${MAX_WAIT}s" >&2
echo ""
echo "=== DevNet Logs ==="
LOG_DIR="/tmp/snarkos-devnet-logs"
if [ -d "$LOG_DIR" ]; then
    for log_file in "$LOG_DIR"/validator-*.log; do
        if [ -f "$log_file" ]; then
            echo ""
            echo "--- $(basename "$log_file") ---"
            tail -50 "$log_file" 2>/dev/null || cat "$log_file" 2>/dev/null
        fi
    done
else
    echo "Log directory not found: $LOG_DIR"
fi
echo ""
echo "=== Process Status ==="
ps aux | grep -E 'snarkos|validator' | grep -v grep || echo "No snarkos processes found"
echo ""
exit 1


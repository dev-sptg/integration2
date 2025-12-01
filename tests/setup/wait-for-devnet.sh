#!/bin/bash
# Wait for snarkOS devnet to be ready

NETWORK_NAME="testnet"
API_BASE="http://localhost:3030/v2/$NETWORK_NAME"
MAX_WAIT_STARTUP=360  # seconds (wait for initial API response)
MAX_WAIT_CONSENSUS=300  # seconds (wait for consensus to stabilize)
MIN_STABLE_HEIGHT=12  # minimum height for consensus stability check

echo "Waiting for devnet to be ready..."
echo "   API: $API_BASE"

# Helper function to check if value is an integer
is_integer() {
    [[ "$1" =~ ^[0-9]+$ ]]
}

# Step 1: Wait for API to respond
echo ""
echo "Step 1: Waiting for API to respond..."
for i in $(seq 1 $MAX_WAIT_STARTUP); do
    RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$API_BASE/block/height/latest" 2>&1)
    HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")
    
    if [ "$HTTP_CODE" = "200" ] && [ -n "$BODY" ]; then
        echo "✅ API is responsive (height: $BODY)"
        break
    fi
    
    if [ $((i % 15)) -eq 0 ]; then
        echo "   Still waiting... (${i}s/${MAX_WAIT_STARTUP}s)"
        echo "   Last response: HTTP $HTTP_CODE - $BODY"
    fi
    
    sleep 1
    
    if [ $i -eq $MAX_WAIT_STARTUP ]; then
        echo "❌ Error: DevNet API failed to respond within ${MAX_WAIT_STARTUP}s" >&2
        echo "   Last response: HTTP $HTTP_CODE - $BODY"
        exit 1
    fi
done

# Step 2: Wait for consensus version to stabilize
echo ""
echo "Step 2: Waiting for consensus version to stabilize..."
echo "   Waiting for stable consensus with at least ${MIN_STABLE_HEIGHT} blocks..."

last_seen_consensus_version=0
last_seen_height=0
total_wait=0

# Function to check consensus version stability
consensus_version_stable() {
    consensus_version=$(curl -s "$API_BASE/consensus_version" 2>/dev/null)
    height=$(curl -s "$API_BASE/block/height/latest" 2>/dev/null)
    
    if is_integer "$consensus_version" && is_integer "$height"; then
        # If the consensus version is greater than the last seen, we update it
        if (( consensus_version > last_seen_consensus_version )); then
            echo "   Consensus version updated to $consensus_version (height: $height)"
            last_seen_consensus_version=$consensus_version
            last_seen_height=$height
            return 1
        # If consensus version is stable and height is different and at least MIN_STABLE_HEIGHT
        else
            if (( (height != last_seen_height) && (height >= MIN_STABLE_HEIGHT) )); then
                echo "✅ Consensus version is stable at $consensus_version (height: $height)"
                return 0
            fi
        fi
    else
        echo "   Waiting for valid consensus data... (consensus: $consensus_version, height: $height)"
    fi
    
    last_seen_consensus_version=$consensus_version
    last_seen_height=$height
    return 1
}

# Check consensus stability periodically
while (( total_wait < MAX_WAIT_CONSENSUS )); do
    if consensus_version_stable; then
        echo ""
        echo "✅ DevNet is ready and stable"
        exit 0
    fi
    
    sleep 30
    total_wait=$((total_wait + 30))
    
    if (( total_wait < MAX_WAIT_CONSENSUS )); then
        echo "   Waited ${total_wait}s so far... (timeout in $((MAX_WAIT_CONSENSUS - total_wait))s)"
    fi
done

echo "❌ Error: Consensus version did not stabilize within ${MAX_WAIT_CONSENSUS}s" >&2
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


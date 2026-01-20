#!/bin/bash
# Generates a standalone HTML dashboard with embedded data
# Usage: ./generate-standalone-dashboard.sh <json-data> <output-file>

set -euo pipefail

DATA_JSON="$1"
OUTPUT_FILE="$2"
TEMPLATE_FILE="compatibility/dashboard/standalone.html"

if [ -z "$DATA_JSON" ] || [ -z "$OUTPUT_FILE" ]; then
    echo "Usage: $0 <json-data> <output-file>" >&2
    exit 1
fi

if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "Error: Template file not found: $TEMPLATE_FILE" >&2
    exit 1
fi

# Validate JSON
if ! echo "$DATA_JSON" | jq empty 2>/dev/null; then
    echo "Error: Invalid JSON data" >&2
    exit 1
fi

# Minify JSON for embedding
# Since we're using <script type="application/json">, we can embed JSON directly
ESCAPED_JSON=$(echo "$DATA_JSON" | jq -c .)

# Read template and inject data using awk
# Use a JavaScript variable instead of application/json script tag for better browser compatibility
awk -v data="$ESCAPED_JSON" '
  /<!-- EMBEDDED_DATA -->/ {
    print "<script>window.__REPORT_DATA = " data ";</script>"
    next
  }
  { print }
' "$TEMPLATE_FILE" > "$OUTPUT_FILE"

echo "✅ Generated standalone report: $OUTPUT_FILE"

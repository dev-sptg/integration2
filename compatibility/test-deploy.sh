#!/bin/bash
set -e

# Local test script for compatibility dashboard deployment
# Usage:
#   ./compatibility/test-deploy.sh [serve|deploy]
#   - serve: Prepare dashboard and serve locally (default)
#   - deploy: Prepare dashboard and deploy to Cloudflare Pages

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_DIST="$SCRIPT_DIR/dashboard-dist"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Preparing compatibility dashboard...${NC}"

# Clean and create dist directory
rm -rf "$DASHBOARD_DIST"
mkdir -p "$DASHBOARD_DIST"

# Copy dashboard files
echo "Copying dashboard files..."
for file in "$SCRIPT_DIR/dashboard"/*; do
  if [ -f "$file" ]; then
    cp "$file" "$DASHBOARD_DIST/"
  fi
done

# Copy data files
echo "Copying data files..."
cp "$SCRIPT_DIR/matrix.json" "$DASHBOARD_DIST/"
cp "$SCRIPT_DIR/versions.json" "$DASHBOARD_DIST/"

# Verify required files exist
echo "Verifying files..."
REQUIRED_FILES=("index.html" "app.js" "styles.css" "matrix.json" "versions.json")
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$DASHBOARD_DIST/$file" ]; then
    echo -e "${YELLOW}⚠️  Warning: $file not found${NC}"
  else
    echo -e "${GREEN}✓${NC} $file"
  fi
done

echo -e "\n${GREEN}✅ Dashboard prepared in: $DASHBOARD_DIST${NC}"

# Handle command
COMMAND="${1:-serve}"

case "$COMMAND" in
  serve)
    echo -e "\n${BLUE}🌐 Starting local server...${NC}"
    echo -e "${GREEN}Dashboard will be available at: http://localhost:3000${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}\n"
    
    # Check if npx serve is available, otherwise use Python
    if command -v npx &> /dev/null; then
      cd "$DASHBOARD_DIST"
      npx serve@latest -p 3000
    elif command -v python3 &> /dev/null; then
      cd "$DASHBOARD_DIST"
      python3 -m http.server 3000
    else
      echo -e "${YELLOW}⚠️  Neither 'npx' nor 'python3' found.${NC}"
      echo "Please install Node.js or Python to serve locally."
      echo "Or manually open: file://$DASHBOARD_DIST/index.html"
      exit 1
    fi
    ;;
    
  deploy)
    echo -e "\n${BLUE}🚀 Deploying to Cloudflare Pages...${NC}"
    
    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
      echo -e "${YELLOW}⚠️  Wrangler CLI not found. Installing...${NC}"
      npm install -g wrangler
    fi
    
    # Check if authenticated
    if ! wrangler whoami &> /dev/null; then
      echo -e "${YELLOW}⚠️  Not authenticated with Cloudflare.${NC}"
      echo "Please run: wrangler login"
      exit 1
    fi
    
    # Deploy using wrangler
    cd "$DASHBOARD_DIST"
    wrangler pages deploy . \
      --project-name=e2e-testing-reports \
      --branch=main
    
    echo -e "\n${GREEN}✅ Deployment complete!${NC}"
    ;;
    
  *)
    echo -e "${YELLOW}Usage: $0 [serve|deploy]${NC}"
    echo "  serve  - Prepare and serve locally (default)"
    echo "  deploy - Prepare and deploy to Cloudflare Pages"
    exit 1
    ;;
esac


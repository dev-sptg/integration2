#!/bin/bash
set -e

# Script to build and prepare local packages for integration tests
# This script marks packages with local build identifiers and creates installable packages

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTEGRATION_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔧 Setting up local packages for integration tests..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check for SDK in multiple locations (local_build or root)
if [ -d "$INTEGRATION_ROOT/local_build/sdk" ]; then
    SDK_BASE="$INTEGRATION_ROOT/local_build/sdk"
    echo "Found SDK in local_build/"
elif [ -d "$INTEGRATION_ROOT/sdk" ]; then
    SDK_BASE="$INTEGRATION_ROOT/sdk"
    echo "Found SDK in root"
else
    echo -e "${RED}❌ SDK directory not found${NC}"
    echo "Please ensure SDK is cloned (either at root or in local_build/)"
    exit 1
fi

SDK_DIR="$SDK_BASE/sdk"
if [ ! -d "$SDK_DIR" ]; then
    echo -e "${RED}❌ SDK package directory not found at $SDK_DIR${NC}"
    exit 1
fi

# Check for snarkOS in multiple locations (local_build or root)
if [ -d "$INTEGRATION_ROOT/local_build/snarkOS" ]; then
    SNARKOS_BASE="$INTEGRATION_ROOT/local_build/snarkOS"
    echo "Found snarkOS in local_build/"
elif [ -d "$INTEGRATION_ROOT/snarkOS" ]; then
    SNARKOS_BASE="$INTEGRATION_ROOT/snarkOS"
    echo "Found snarkOS in root"
else
    echo -e "${YELLOW}⚠️  snarkOS directory not found${NC}"
    echo "snarkOS tests will be skipped"
    SNARKOS_BASE=""
fi

# Get git commit hash for version marking
if [ -d "$SDK_DIR/.git" ]; then
    SDK_COMMIT=$(cd "$SDK_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "local")
else
    SDK_COMMIT="local"
fi

echo -e "${GREEN}📦 Building SDK...${NC}"
cd "$SDK_DIR"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed or not in PATH${NC}"
    exit 1
fi

# Check if yarn is available
if ! command -v yarn &> /dev/null; then
    echo -e "${RED}❌ yarn is not installed or not in PATH${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing SDK dependencies..."
    NODE_OPTIONS="--max-old-space-size=4096" yarn install --frozen-lockfile
fi

# Read current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
LOCAL_VERSION="${CURRENT_VERSION}-local-${SDK_COMMIT}"

echo -e "${YELLOW}📝 Marking SDK with local version: $LOCAL_VERSION${NC}"

# Create a temporary package.json with local version
# We'll restore it after packing
cp package.json package.json.bak

# Update version in package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$LOCAL_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Build SDK (WASM + SDK) - skip if already built
echo "Checking SDK build status..."
cd "$SDK_BASE"

# Check if both WASM and SDK are already built
WASM_BUILT=false
SDK_BUILT=false

if [ -d "wasm/dist" ] && [ "$(ls -A wasm/dist 2>/dev/null)" ]; then
    WASM_BUILT=true
fi

if [ -d "sdk/dist" ] && [ "$(ls -A sdk/dist 2>/dev/null)" ]; then
    SDK_BUILT=true
fi

if [ "$WASM_BUILT" = true ] && [ "$SDK_BUILT" = true ]; then
    echo "✓ SDK already built (WASM + SDK), skipping..."
else
    echo "Building SDK (WASM + SDK)..."
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing SDK root dependencies..."
        NODE_OPTIONS="--max-old-space-size=4096" yarn install --frozen-lockfile
    fi
    NODE_OPTIONS="--max-old-space-size=4096" yarn build:all
    echo "✓ SDK build complete"
fi

# Pack SDK (must be run from SDK directory)
echo -e "${GREEN}📦 Creating SDK tarball...${NC}"
cd "$SDK_DIR"
PACK_OUTPUT=$(yarn pack 2>&1)
PACK_FILE=$(echo "$PACK_OUTPUT" | grep -o "provablehq-sdk-.*\.tgz" | tail -1)

if [ -z "$PACK_FILE" ]; then
    echo -e "${RED}❌ Failed to create SDK tarball${NC}"
    echo "$PACK_OUTPUT"
    mv package.json.bak package.json
    exit 1
fi

# Move tarball to SDK base directory for easier access
mv "$PACK_FILE" "$SDK_BASE/$PACK_FILE"

# Restore original package.json
mv package.json.bak package.json

echo -e "${GREEN}✅ SDK tarball created: $SDK_BASE/$PACK_FILE${NC}"

# Update test suite package.json files with actual tarball path
echo -e "${YELLOW}📝 Updating test suite package.json files...${NC}"
TARBALL_PATH="$SDK_BASE/$PACK_FILE"
for testDir in "$INTEGRATION_ROOT/tests/integration"/*/; do
    if [ -f "$testDir/package.json" ]; then
        # Use relative path from test directory to SDK tarball
        relPath=$(realpath --relative-to="$testDir" "$TARBALL_PATH" 2>/dev/null || echo "../../../sdk/$PACK_FILE")
        # Update package.json using node to handle JSON properly
        node -e "
            const fs = require('fs');
            const pkgPath = '$testDir/package.json';
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            pkg.dependencies['@provablehq/sdk'] = 'file:$relPath';
            fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
        "
        echo "  Updated: $testDir/package.json"
    fi
done

# Verify snarkOS binary
echo -e "${GREEN}🔍 Verifying snarkOS binary...${NC}"
if [ -n "$SNARKOS_BASE" ]; then
    SNARKOS_BINARY="$SNARKOS_BASE/target/release/snarkos"
    
    if [ ! -f "$SNARKOS_BINARY" ]; then
        echo -e "${YELLOW}⚠️  snarkOS binary not found at $SNARKOS_BINARY${NC}"
        echo "snarkOS may need to be built first"
    else
        echo -e "${GREEN}✅ snarkOS binary found${NC}"
        # Add to PATH for this session
        export PATH="$SNARKOS_BASE/target/release:$PATH"
        echo "snarkOS added to PATH: $SNARKOS_BINARY"
    fi
else
    SNARKOS_BINARY=""
    echo -e "${YELLOW}⚠️  snarkOS not found, skipping binary check${NC}"
fi

# Export variables for use in test scripts
export SDK_TARBALL="$SDK_BASE/$PACK_FILE"
export SDK_LOCAL_VERSION="$LOCAL_VERSION"
export SNARKOS_BINARY_PATH="$SNARKOS_BINARY"

echo -e "${GREEN}✅ Package setup complete!${NC}"
echo ""
echo "Environment variables set:"
echo "  SDK_TARBALL=$SDK_TARBALL"
echo "  SDK_LOCAL_VERSION=$SDK_LOCAL_VERSION"
echo "  SNARKOS_BINARY_PATH=$SNARKOS_BINARY_PATH"


#!/bin/bash
set -e

# Integration Test Runner
# Clones, builds, and tests snarkOS + SDK
#
# Usage:
#   ./run-all-tests.sh             # Full run (clone, build, test)
#   ./run-all-tests.sh --dev       # Dev mode (skip devnet start/stop, assume running)
#   ./run-all-tests.sh --skip-build # Skip clone/build (use existing artifacts)

RUNNER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTEGRATION_ROOT="$(cd "$RUNNER_DIR/.." && pwd)"
SETUP_DIR="$RUNNER_DIR/setup"
REPORT_DIR="$INTEGRATION_ROOT/test-results"
LOCAL_BUILD="$INTEGRATION_ROOT/local_build"

# Parse flags
DEV_MODE=false
SKIP_BUILD=false

for arg in "$@"; do
    case $arg in
        --dev)
            DEV_MODE=true
            ;;
        --skip-build)
            SKIP_BUILD=true
            ;;
        --help)
            echo "Integration Test Runner"
            echo ""
            echo "Usage:"
            echo "  ./run-all-tests.sh             # Full run (clean, clone, build, test)"
            echo "  ./run-all-tests.sh --dev       # Dev mode (skip devnet start/stop)"
            echo "  ./run-all-tests.sh --skip-build # Skip clone/build (use existing artifacts)"
            exit 0
            ;;
    esac
done

echo "Integration Test Suite"
if [ "$DEV_MODE" = true ]; then
    echo "Dev mode: Assuming devnet is running"
fi
if [ "$SKIP_BUILD" = true ]; then
    echo "Skip build: Using existing artifacts"
fi
echo ""

# ============================================================
# Step 1: Clean and clone repositories
# ============================================================
if [ "$SKIP_BUILD" = false ]; then
    echo "Cleaning old repositories..."
    pkill -f "snarkos" 2>/dev/null || true
    pkill -f "node.*test.js" 2>/dev/null || true
    sleep 2

    rm -rf "$LOCAL_BUILD/snarkOS" 2>/dev/null || true
    rm -rf "$LOCAL_BUILD/sdk" 2>/dev/null || true

    mkdir -p "$LOCAL_BUILD"
    cd "$LOCAL_BUILD"

    echo "Cloning snarkOS (shallow)..."
    git clone --depth 1 https://github.com/provableHQ/snarkOS.git

    echo "Cloning SDK (shallow)..."
    git clone --depth 1 https://github.com/ProvableHQ/sdk.git

    echo ""

    # ============================================================
    # Step 2: Build snarkOS
    # ============================================================
    echo "Building snarkOS..."
    cd "$LOCAL_BUILD/snarkOS"

    if ! command -v cargo &> /dev/null; then
        echo "Error: cargo not found. Install Rust toolchain" >&2
        exit 1
    fi

    RUSTFLAGS="-C target-cpu=native" cargo build --release --features=test_network
else
    echo "Skipping clone and build steps..."
fi

echo ""

# ============================================================
# Step 3: Build and prepare SDK packages
# ============================================================
# Skip if SDK_TARBALL is already set (e.g., in CI with pre-built artifacts)
if [ -n "$SDK_TARBALL" ] && [ -f "$SDK_TARBALL" ]; then
    echo "Using pre-built SDK tarball: $SDK_TARBALL"
else
    echo "Preparing SDK packages..."
    source "$SETUP_DIR/install-packages.sh"
fi

echo ""

# ============================================================
# Step 4: Run integration tests
# ============================================================
echo "Running tests..."
echo ""

mkdir -p "$REPORT_DIR"

# Check prerequisites
if ! command -v node &> /dev/null; then
    echo "Error: Node.js not installed" >&2
    exit 1
fi

if ! command -v yarn &> /dev/null; then
    echo "Error: yarn not installed" >&2
    exit 1
fi

# Export environment variables
export INTEGRATION_ROOT="$INTEGRATION_ROOT"
export SDK_TARBALL="${SDK_TARBALL:-}"
export SDK_LOCAL_VERSION="${SDK_LOCAL_VERSION:-}"
export SNARKOS_BINARY_PATH="${SNARKOS_BINARY_PATH:-$LOCAL_BUILD/snarkOS/target/release/snarkos}"
export DEV_MODE="$DEV_MODE"

# Run tests
node "$RUNNER_DIR/run-all-tests.js" || true

# Display results
if [ -f "$REPORT_DIR/test-report.json" ]; then
    echo ""
    echo "Test execution complete"
    echo "Report: $REPORT_DIR/test-report.json"
    echo "Summary: $REPORT_DIR/github-summary.md"
fi

exit 0


# Local Testing Guide

## Prerequisites

- **Node.js 24+** with yarn
- **Rust toolchain** (stable for snarkOS/DPS, nightly-2025-08-28 for SDK WASM)
- **Git**
- ~50GB disk space for builds

## Quick Start (Full Build)

```bash
./tests/run-all-tests.sh
```

This clones, builds, and tests everything from scratch (~30-60 min).

---

## Step-by-Step Manual Setup

### 1. Clone Repositories

```bash
mkdir -p local_build && cd local_build

# snarkOS
git clone --depth 1 --branch v4.4.0 https://github.com/provableHQ/snarkOS.git

# SDK
git clone --depth 1 --branch mainnet https://github.com/ProvableHQ/sdk.git

# DPS (requires GitHub token for private repo)
git clone --depth 1 https://github.com/provableHQ/delegated-proving-service.git dps
cd dps && git checkout f559cf7b979a0b4065a989c52ee6423b1c84614b && cd ..
```

### 2. Build snarkOS

```bash
cd local_build/snarkOS
RUSTFLAGS="-C target-cpu=native" cargo build --release --features=test_network
```

Binary: `target/release/snarkos`

### 3. Build SDK

```bash
cd local_build/sdk

# Set Rust nightly for WASM
rustup override set nightly-2025-08-28
rustup target add wasm32-unknown-unknown --toolchain nightly-2025-08-28

# Build
yarn install
yarn build:all
```

### 4. Build DPS

```bash
cd local_build/dps
cargo build --release --features test
```

Binary: `target/release/prover`

### 5. Prepare SDK Package

```bash
cd /path/to/integration
./tests/setup/install-packages.sh
```

This creates the SDK tarball and updates test `package.json` files.

---

## Running Tests

### Option A: All Tests

```bash
SNARKOS_BINARY_PATH=$(pwd)/local_build/snarkOS/target/release/snarkos \
  node tests/run-all-tests.js
```

### Option B: Single Test Suite

```bash
# Start devnet
./tests/setup/start-devnet.sh
./tests/setup/wait-for-devnet.sh

# Start DPS (for dps-devnet tests)
./tests/setup/start-dps.sh

# Run specific test
cd tests/integration/dps-devnet
yarn install
SNARKOS_BINARY_PATH=$(pwd)/../../../local_build/snarkOS/target/release/snarkos \
  node test.js

# Cleanup
./tests/setup/stop-dps.sh
./tests/setup/stop-devnet.sh
```

---

## Skip Build (Use Existing Artifacts)

If you already have built artifacts in `local_build/`:

```bash
./tests/run-all-tests.sh --skip-build
```

Or run tests directly:

```bash
SNARKOS_BINARY_PATH=$(pwd)/local_build/snarkOS/target/release/snarkos \
  node tests/run-all-tests.js
```

---

## Version Compatibility

| Component | Version | snarkVM |
|-----------|---------|---------|
| snarkOS | v4.4.0 | 4.4.0 |
| SDK | v0.9.14 | 4.3.0 |
| DPS | f559cf7 | 4.4.0 |

**Important**: SDK creates authorizations, DPS does proving. DPS and snarkOS must have matching snarkVM versions.

---

## Troubleshooting

### DevNet not starting
```bash
# Check logs
tail -f /tmp/snarkos-devnet-logs/validator-0.log

# Restart fresh
./tests/setup/stop-devnet.sh
./tests/setup/start-devnet.sh
```

### DPS not responding
```bash
# Check if running
ps aux | grep prover

# Check logs
cat /tmp/dps-logs/dps.log

# DPS needs ~60s to initialize proving keys
```

### SDK tarball path errors
```bash
# Regenerate paths
./tests/setup/install-packages.sh

# Or manually fix package.json files to point to:
# file:../../../local_build/sdk/provablehq-sdk-<version>-local-local.tgz
```

### Fee verification failed
snarkVM version mismatch between components. Ensure DPS and snarkOS use the same snarkVM version.

---

## Test Results

Reports generated in `test-results/`:
- `test-report.json` - Full JSON results
- `github-summary.md` - Markdown summary
- `traces/*.log` - Per-suite logs


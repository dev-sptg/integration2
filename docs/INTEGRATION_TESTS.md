# Integration Test Documentation

This document describes the integration test framework for validating compatibility between ProvableHQ components (snarkOS, SDK, DPS).

## Overview

The integration tests validate end-to-end functionality across multiple components that will eventually power the browser extension wallet. Tests run against a local devnet with locally-built components to ensure compatibility.

## Test Architecture

```
tests/
├── integration/             # Test suites
│   ├── sdk-devnet/          # SDK + snarkOS connectivity tests
│   ├── transfer-public/     # Public transfer transaction tests
│   └── dps-devnet/          # Delegated Proving Service tests
├── setup/                   # Test infrastructure
│   ├── install-packages.sh  # Build and prepare local SDK
│   ├── start-devnet.sh      # Start 4-validator devnet
│   ├── stop-devnet.sh       # Stop devnet
│   ├── start-dps.sh         # Start DPS service
│   ├── stop-dps.sh          # Stop DPS
│   ├── wait-for-devnet.sh   # Wait for devnet readiness
│   └── test-helpers.js      # Test utilities and reporting
├── programs/
│   └── main.aleo            # Test Aleo program for deployment
├── run-all-tests.sh         # Shell entry point
└── run-all-tests.js         # Node.js test orchestrator
```

## Test Suites

### 1. sdk-devnet

**Purpose**: Validates SDK connectivity to local snarkOS devnet.

**Tests**:
- Local SDK package verification (version contains `-local-` marker)
- snarkOS binary availability
- Devnet startup and connectivity
- SDK account creation and network connection
- Aleo program loading
- Deployment transaction building

**Requirements**: snarkOS binary

### 2. transfer-public

**Purpose**: Tests public credit transfers using `credits.aleo`.

**Tests**:
- SDK initialization with test accounts
- Public balance queries
- ProgramManager initialization
- `transfer_public` transaction building
- Transaction submission
- Transaction confirmation
- Balance verification

**Requirements**: snarkOS devnet running

### 3. dps-devnet

**Purpose**: Validates delegated proving through DPS service.

**Tests**:
- Local SDK package verification
- snarkOS and DPS binary availability
- Devnet and DPS service startup
- SDK connection to devnet
- Account balance verification
- Delegated proving request (`transfer_public`)
- Transaction confirmation on blockchain
- Balance change verification

**Requirements**: snarkOS binary, DPS binary

## Running Tests

### Quick Start

```bash
# Full run: clone, build, and test
./tests/run-all-tests.sh

# Skip build (use existing artifacts)
./tests/run-all-tests.sh --skip-build

# Dev mode (don't stop services after tests)
./tests/run-all-tests.sh --dev
```

### Manual Execution

```bash
# 1. Start devnet
./tests/setup/start-devnet.sh
./tests/setup/wait-for-devnet.sh

# 2. Start DPS (optional, for dps-devnet tests)
DPS_BINARY_PATH=/path/to/prover ./tests/setup/start-dps.sh

# 3. Run tests
SNARKOS_BINARY_PATH=/path/to/snarkos node tests/run-all-tests.js

# 4. Cleanup
./tests/setup/stop-dps.sh
./tests/setup/stop-devnet.sh
```

### Running Individual Suites

```bash
cd tests/integration/sdk-devnet
yarn install
SNARKOS_BINARY_PATH=/path/to/snarkos node test.js
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SNARKOS_BINARY_PATH` | Path to snarkOS binary | `local_build/snarkOS/target/release/snarkos` |
| `DPS_BINARY_PATH` | Path to DPS (prover) binary | `local_build/dps/target/release/prover` |
| `SDK_TARBALL` | Path to SDK tarball | Auto-detected |
| `DEV_MODE` | Keep services running after tests | `false` |
| `INTEGRATION_ROOT` | Root directory of integration repo | Auto-detected |

## Test Framework

Tests use Node.js built-in test runner (`node:test`) with TAP output.

### Test Helpers (`test-helpers.js`)

**Classes**:
- `TestResult`: Individual test result with name, status, duration, error, subtests
- `TestReport`: Aggregated results with summary and JSON export

**Functions**:
- `runTest(name, script, cwd, timeout)`: Execute a test script with timeout
- `verifyLocalSDK(testDir)`: Verify SDK installed from local tarball
- `verifySnarkOSBinary(path)`: Verify snarkOS binary exists and works
- `findBinary(paths, envVar)`: Find binary in multiple locations
- `waitForService({url, name, timeout})`: Poll service until ready
- `startService({script, name, env})`: Start a service via shell script
- `stopService(script, name)`: Stop a service
- `getAccountBalance(client, address)`: Get microcredits balance
- `creditsToMicrocredits(credits)`: Convert credits to microcredits
- `generateGitHubSummary(report)`: Generate markdown summary

### Writing New Tests

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { verifyLocalSDK, startService, stopService } from '../../setup/test-helpers.js';

test('My Test Suite', async (t) => {
    await t.test('Subtest 1', async () => {
        // Test code
        assert.ok(true, 'Should pass');
    });
    
    await t.test('Subtest 2', { timeout: 60000 }, async () => {
        // Long-running test
    });
});
```

## Test Accounts

Tests use pre-funded devnet accounts:

| Account | Private Key | Address |
|---------|-------------|---------|
| Sender | `APrivateKey1zkp8CZNn3yeCseEtxuVPbDCwSyhGW6yZKUYKfgXmcpoGPWH` | (derived) |
| Receiver | `APrivateKey1zkp2RWGDcde3efb89rjhME1VYA8QMxcxep5DShNBR6n8Yjh` | (derived) |

These accounts are funded in the devnet genesis configuration.

## DevNet Configuration

- **Network ID**: 1 (testnet)
- **Validators**: 4 (minimum for genesis committee)
- **REST API**: `http://localhost:3030`
- **Ports**: 3030-3033 (REST), 4130-4133 (node), 5000-5003 (metrics)

Logs are written to `/tmp/snarkos-devnet-logs/validator-{0-3}.log`.

## DPS Configuration

- **Address**: `0.0.0.0:3000`
- **Prove Endpoint**: `http://localhost:3000/prove`
- **Health Endpoint**: `http://localhost:3000/health`
- **Network**: testnet
- **Backend**: `http://localhost:3030` (devnet)

Logs are written to `/tmp/dps-logs/dps.log`.

## Consensus Version Heights

For SDK versions that support it, consensus version test heights are initialized:

```javascript
const heights = getOrInitConsensusVersionTestHeights("0,1,2,3,4,5,6,7,8,9,10,11");
```

This configures the SDK for devnet testing where consensus versions change at low block heights.

## Test Reports

After running tests, reports are generated in `test-results/`:

| File | Description |
|------|-------------|
| `test-report.json` | Full JSON report with all results |
| `github-summary.md` | Markdown summary for CI |
| `traces/<suite>.log` | Detailed stdout/stderr for each suite |

### JSON Report Format

```json
{
  "summary": {
    "total": 3,
    "passed": 2,
    "failed": 1,
    "skipped": 0
  },
  "duration": "125.50s",
  "tests": [
    {
      "name": "sdk-devnet",
      "status": "passed",
      "duration": "45.00s",
      "subtests": [
        {"name": "Local SDK package verification", "status": "passed", "duration": "0.5s"}
      ]
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Timeouts

| Suite | Timeout |
|-------|---------|
| sdk-devnet | 10 minutes |
| transfer-public | 10 minutes |
| dps-devnet | 10 minutes |

Individual operations have their own timeouts:
- Deployment transaction build: 5 minutes
- Proving request: 5 minutes
- Transaction confirmation: 2 minutes
- Devnet readiness: 2 minutes
- DPS readiness: 2 minutes

## Local Package Verification

Tests verify that SDK is installed from the local build, not npm:

1. **Version marker**: SDK version contains `-local-<commit>` suffix
2. **Lock file**: `yarn.lock` contains `file:` protocol references
3. **Package path**: `node_modules/@provablehq/sdk/package.json` has local version

This ensures tests validate the exact code being developed, not published versions.

## CI Integration

In CI (GitHub Actions), tests receive pre-built artifacts:

1. `setup-snarkos.yml` builds snarkOS binary
2. `setup-sdk.yml` builds SDK tarball
3. `setup-dps.yml` builds DPS binary
4. Test job downloads artifacts and runs tests
5. Reports uploaded as artifacts for debugging

See `compatibility-matrix.yml` for full CI workflow.

## Troubleshooting

### DevNet won't start

```bash
# Check if ports are in use
lsof -i :3030
lsof -i :4130

# Kill stale processes
pkill -f snarkos

# Check logs
tail -f /tmp/snarkos-devnet-logs/validator-0.log
```

### DPS not responding

```bash
# Check if running
ps aux | grep prover

# Check logs
cat /tmp/dps-logs/dps.log

# DPS needs ~60s to initialize proving keys
curl http://localhost:3000/health
```

### SDK tarball path errors

```bash
# Regenerate paths
./tests/setup/install-packages.sh

# Check package.json dependencies point to valid tarballs
cat tests/integration/sdk-devnet/package.json
```

### Transaction verification failed

snarkVM version mismatch between components. Ensure DPS and snarkOS use compatible snarkVM versions.

### Balance not updating

Wait for block finalization (2-3 seconds) after transaction confirmation before checking balances.

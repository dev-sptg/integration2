# Integration Test Repository

**[View E2E Testing Reports Dashboard](https://main.e2e-testing-reports.pages.dev/)**

Integration test framework for ProvableHQ's components. Tests multiple repositories together to ensure compatibility and correctness.

## Repository Coverage

- [snarkOS](https://github.com/provableHQ/snarkOS) - Decentralized OS for zero-knowledge applications
- [SDK](https://github.com/ProvableHQ/sdk) - Aleo SDK for TypeScript/JavaScript

## Test Suite

**sdk-devnet**: Full stack integration test validating:
- Local SDK package installation
- snarkOS devnet lifecycle management
- SDK connectivity to local node
- Aleo program deployment transaction building

## Running Tests Locally

### Prerequisites

- Node.js 20+
- Yarn
- Rust toolchain (for building snarkOS)

### Quick Start

```bash
# One command - handles everything
./tests/run-all-tests.sh
```

This script:
1. Clones snarkOS and SDK repositories (shallow, fast)
2. Builds snarkOS from scratch
3. Builds and prepares SDK packages with version markers
4. Runs all test suites
5. Generates reports in `test-results/`

### Test Reports

After running tests, reports are generated in `test-results/`:

- `test-report.json`: Detailed JSON report with all test results
- `github-summary.md`: Markdown summary for GitHub Actions

### Test Structure

```
tests/
├── setup/
│   ├── install-packages.sh    # Build and pack local SDK
│   ├── start-devnet.sh        # Start local snarkOS devnet
│   ├── stop-devnet.sh         # Stop devnet
│   ├── wait-for-devnet.sh     # Wait for devnet readiness
│   └── test-helpers.js        # Test runner and reporting utilities
├── integration/
│   └── sdk-devnet/            # Full stack integration tests
├── programs/
│   └── main.aleo              # Test Aleo program
├── run-all-tests.sh           # Master test runner
└── run-all-tests.js           # Test orchestrator
```

## CI/CD

Tests run automatically on push/PR to `master` branch.

### Workflow Architecture

- **Parallel builds**: snarkOS and SDK build simultaneously
- **Artifact passing**: Built binaries/packages passed between jobs
- **Smart caching**: Rust cache (Swatinem) and yarn cache
- **DevNet automation**: Full devnet lifecycle management in CI
- **Non-blocking tests**: Pipeline doesn't fail, collects all results

### GitHub Actions Runners

- Uses `ubuntu-latest-m` (GitHub hosted runner) for better performance
- Runs on `ubuntu-latest-m` for all jobs (snarkos-build, sdk-build, integration-tests)

## Local Package Verification

Tests verify packages are installed from local builds, not npm registry:

1. **Version marking**: SDK packages marked with `-local-<commit>` suffix
2. **Dependency check**: Tests verify `node_modules` contains locally built packages
3. **Binary verification**: snarkOS binary verified from local build

## Development

For detailed technical information and AI agent context, see [agents.md](agents.md).

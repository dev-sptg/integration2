# Integration Test Repository

**[View E2E Testing Reports Dashboard](https://e2e-testing-reports.pages.dev/)**

Integration test framework for ProvableHQ's components. Tests snarkOS, SDK, and DPS together to ensure compatibility.

## Documentation

| Doc | Description |
|-----|-------------|
| [Local Testing](docs/LOCAL_TESTING.md) | Step-by-step local setup and building |
| [Integration Tests](docs/INTEGRATION_TESTS.md) | Test architecture, suites, and configuration |
| [Extending Tests](docs/EXTENDING_TESTS.md) | How to add new test suites |
| [AI Agent Context](agents.md) | Technical details for AI agents |

## Quick Start

```bash
# Full run: clone, build, test
./tests/run-all-tests.sh

# Skip build (use existing artifacts)
./tests/run-all-tests.sh --skip-build

# Dev mode (keep services running)
./tests/run-all-tests.sh --dev
```

**Prerequisites**: Node.js 24+, Yarn, Rust toolchain

## Test Suites

| Suite | Purpose |
|-------|---------|
| `sdk-devnet` | SDK connectivity, program deployment |
| `transfer-public` | Public credit transfers |
| `dps-devnet` | Delegated proving via DPS |

## Repository Coverage

- [snarkOS](https://github.com/provableHQ/snarkOS) - Decentralized OS for zero-knowledge applications
- [SDK](https://github.com/ProvableHQ/sdk) - Aleo SDK for TypeScript/JavaScript
- [DPS](https://github.com/provableHQ/delegated-proving-service) - Delegated Proving Service

## On-Demand Testing

Test specific versions via GitHub Actions:

```bash
# Test with commit SHAs (DPS defaults to latest passing result; fallback to versions.json)
gh workflow run compatibility-matrix.yml \
  -f snarkos=a1b2c3d4e5f6 \
  -f sdk=f6e5d4c3b2a1

# Test with tags (all three components)
gh workflow run compatibility-matrix.yml \
  -f snarkos=v4.4.0 \
  -f sdk=v0.9.14 \
  -f dps=v0.19.0

# Force re-run even if results already exist
gh workflow run compatibility-matrix.yml \
  -f snarkos=v4.4.0 \
  -f sdk=v0.9.14 \
  -f rerun_existing=true
```

### Using curl / GitHub API

```bash
# Basic trigger with two components (DPS defaults from latest passing matrix or versions.json)
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/OWNER/REPO/actions/workflows/compatibility-matrix.yml/dispatches \
  -d '{"ref":"main","inputs":{"snarkos":"v4.4.0","sdk":"v0.9.14"}}'

# Force re-run existing tests
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/OWNER/REPO/actions/workflows/compatibility-matrix.yml/dispatches \
  -d '{"ref":"main","inputs":{"snarkos":"v4.4.0","sdk":"v0.9.14","rerun_existing":"true"}}'

# All three components with force re-run
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/OWNER/REPO/actions/workflows/compatibility-matrix.yml/dispatches \
  -d '{"ref":"main","inputs":{"snarkos":"v4.4.0","sdk":"v0.9.14","dps":"v0.19.0","rerun_existing":"true"}}'
```

**Note**: For `workflow_dispatch` via API, boolean inputs must be passed as strings (`"true"` or `"false"`).

Or use the [Actions UI](../../actions/workflows/compatibility-matrix.yml) → Run workflow.

## CI/CD

- **Parallel builds**: snarkOS and SDK build simultaneously
- **Smart caching**: Binary and Rust caches for fast rebuilds
- **Nightly matrix**: Tests all version combinations
- **Log collection**: Service logs uploaded as artifacts

## Test Reports

After tests complete:
- `test-results/test-report.json` - Full results
- `test-results/github-summary.md` - Markdown summary
- `test-results/traces/*.log` - Per-suite logs

# Integration Test Repository - AI Agent Documentation

This document provides technical information about the integration test repository for AI agents.

## Repository Purpose

Integration test framework for ProvableHQ's components. Aims to be an e2e test for browser extension wallet and its dependencies. Tests multiple repositories together to ensure compatibility and correctness. Validates that snarkOS, SDK, and DPS (Delegated Proving Service) repositories work together.

## Repository Coverage

- [snarkOS](https://github.com/provableHQ/snarkOS) - Decentralized OS for zero-knowledge applications
- [SDK](https://github.com/ProvableHQ/sdk) - Aleo SDK for TypeScript/JavaScript
- [DPS](https://github.com/provableHQ/delegated-proving-service) (private) - Delegated Proving Service
- Record Scanning Service (private) - Record scanning functionality
- Provapipe (private) - Pipeline infrastructure

## Repository Structure

```
├── .github/workflows/
│   ├── integration-tests.yml         # Main integration test workflow
│   ├── compatibility-matrix.yml      # Multi-version compatibility testing
│   ├── matrix-on-release.yml         # Trigger tests on releases
│   ├── evolve-tests.yml              # AI-powered e2e test evolution (nightly cron, crush agent)
│   ├── setup-snarkos.yml             # snarkOS build workflow
│   ├── setup-sdk.yml                 # SDK build workflow
│   ├── setup-dps.yml                 # DPS build workflow
│   ├── setup-provapipe.yml           # Provapipe build (disabled)
│   └── setup-record-scanning-service.yml  # RSS build (disabled)
├── compatibility/
│   ├── dashboard/                    # Web dashboard for results
│   │   ├── index.html
│   │   ├── app.js
│   │   └── styles.css
│   ├── matrix.json                   # Compatibility test results
│   ├── versions.json                 # Component version configuration
│   └── test-deploy.sh                # Dashboard deployment script
├── tests/
│   ├── integration/
│   │   ├── sdk-devnet/               # SDK + devnet integration tests
│   │   └── dps-devnet/               # DPS delegated proving tests
│   ├── setup/
│   │   ├── install-packages.sh       # Build and prepare local packages
│   │   ├── start-devnet.sh           # Start local snarkOS devnet
│   │   ├── stop-devnet.sh            # Stop devnet
│   │   ├── start-dps.sh              # Start DPS service
│   │   ├── stop-dps.sh               # Stop DPS service
│   │   ├── wait-for-devnet.sh        # Wait for devnet readiness
│   │   └── test-helpers.js           # Test utilities and reporting
│   ├── programs/                     # Test Aleo programs
│   ├── run-all-tests.sh              # Master test runner (shell)
│   └── run-all-tests.js              # Test orchestrator (Node.js)
├── scripts/
│   ├── generate-standalone-dashboard.sh
│   └── validate-commit-sha.sh
├── README.md                         # Human documentation
└── agents.md                         # This file
```

## Workflows Overview

### 1. Integration Tests (`integration-tests.yml`)

**Triggers**: Push/PR to `master` branch

**Purpose**: Run integration tests using latest (default branch) of all components

**Jobs**:
1. **snarkos-build**: Build snarkOS binary (parallel)
2. **sdk-build**: Build SDK packages (parallel)
3. **integration-tests**: Run tests against devnet

**Test Suites**: `sdk-devnet`, `dps-devnet`

### 2. Compatibility Matrix (`compatibility-matrix.yml`)

**Triggers**: Nightly (02:13 UTC), PR, manual, workflow_call

**Purpose**: Test all combinations of component versions for compatibility

**Jobs**:
1. **generate-matrix**: Read versions.json, optionally fetch latest tags from GitHub
2. **build-snarkos**: Build all snarkOS versions (parallel matrix)
3. **build-sdk**: Build all SDK versions (parallel matrix)
4. **build-dps**: Build all DPS versions (parallel matrix)
5. **test-compatibility**: Test all combinations (matrix of all versions)
6. **aggregate-results**: Collect results into matrix.json
7. **deploy-dashboard**: Deploy to Cloudflare Pages

**Version Configuration** (`compatibility/versions.json`):
```json
{
  "components": {
    "snarkos": { "repo": "provableHQ/snarkOS", "tags": ["v4.4.0", ...] },
    "sdk": { "repo": "ProvableHQ/sdk", "tags": ["v0.9.14", ...] },
    "dps": { "repo": "provableHQ/delegated-proving-service", "tags": ["v0.18.1", ...] }
  },
  "matrix_config": {
    "test_latest_n_tags": 3,
    "include_branches": false
  }
}
```

### 3. Evolve E2E Tests (`evolve-tests.yml`)

**Triggers**: Nightly cron (03:00 UTC), manual

**Purpose**: Use an AI coding agent (crush/opencode) with z.ai to analyze the test suite and propose improvements

**How it works**:
1. Checks for existing open evolution PRs (skips if one exists)
2. Closes stale evolution PRs (>14 days old)
3. Installs [crush](https://github.com/charmbracelet/crush) (the opencode successor)
4. Generates a `.crush.json` config with z.ai as the provider
5. Gathers upstream repo changes and test results as context for the prompt
6. Runs `crush run -y` in non-interactive mode with the evolution prompt
   - Crush has full agent capabilities: reads files, edits code, runs commands
   - The prompt instructs it to read all tests, pick ONE improvement, implement it
7. Validates all changed JS/JSON files (syntax check)
8. Creates a PR with the `e2e-evolution` label for human review

**Required Secrets**:
- `ZAI_TOKEN`: z.ai API authentication token

**Optional Configuration** (repository variables):
- `ZAI_MODEL`: Model ID (default: `claude-sonnet-4-20250514`)

**Safety measures**:
- Crush prompt restricts changes to `tests/` directory only
- Post-run syntax validation (node --check, JSON parse)
- Reverts all changes on validation failure
- One open evolution PR at a time (prevents noise)
- Stale PRs auto-closed after 14 days
- All changes require human review via PR

**Manual trigger with focus area**:
```bash
gh workflow run evolve-tests.yml \
  --field focus_area="error handling and edge cases"

# Override model
gh workflow run evolve-tests.yml \
  --field model="anthropic/claude-opus-4-20250514"
```

### 4. Matrix on Release (`matrix-on-release.yml`)

**Triggers**: repository_dispatch (snarkos-release, sdk-release), manual

**Purpose**: Automatically test new releases against latest versions of other components

## Build Workflows (setup-*.yml)

### setup-snarkos.yml
- **Runner**: `ubuntu-latest-l`
- **Caching**: Binary cache via `actions/cache@v4` (key: `snarkos-binary-{version}`)
- **Rust cache**: `Swatinem/rust-cache@v2` (shared-key: `snarkos-rust-{ref}`)
- **Build command**: `cargo build --release --features=test_network`
- **Artifact**: Just the binary (`snarkos-binary/snarkos`)

### setup-sdk.yml
- **Runner**: `ubuntu-latest-l`
- **Caching**: Build cache via `actions/cache@v4` (key: `sdk-build-{version}`)
- **Rust toolchain**: `nightly-2025-08-28` with `wasm32-unknown-unknown` target
- **Rust cache**: `Swatinem/rust-cache@v2` (shared-key: `sdk-wasm-rust-{ref}`)
- **Node.js**: **24** with yarn cache
- **Install**: `yarn install --immutable --check-cache`
- **Build command**: `yarn build:all`
- **Artifact**: `sdk-local.tgz`, `wasm-dist/`, `wasm-package.json`

### setup-dps.yml
- **Runner**: `ubuntu-latest-l`
- **Caching**: Binary cache via `actions/cache@v4` (key: `dps-binary-{version}`)
- **Rust cache**: `Swatinem/rust-cache@v2` (shared-key: `dps-rust-{ref}`)
- **Checkout branch**: `feat/test-flag` (hardcoded)
- **Build command**: `cargo build --release --features test`
- **Artifact**: Just the binary (`dps-binary/prover`)
- **Requires secret**: `REPO_ACCESS_TOKEN`

### setup-provapipe.yml (disabled)
- **Runner**: `ubuntu-latest-m`
- **Build command**: `cargo build --release`
- **System deps**: `libsasl2-dev`
- **Uses**: `actions/upload-artifact@v4`

### setup-record-scanning-service.yml (disabled)
- **Runner**: `ubuntu-latest-m`
- **SSH agent**: `webfactory/ssh-agent@v0.9.0`
- **Build command**: `cargo build --release`
- **Uses**: `actions/upload-artifact@v4`
- **Requires secrets**: `REPO_ACCESS_TOKEN`, `DEPENDENCY_CUSNARK_SSH_KEY`

## Action Versions

⚠️ **IMPORTANT**: Always use Context7 MCP to verify latest action versions before updating workflows. The versions below reflect current usage and may be outdated.

| Action | Current | Check Latest |
|--------|---------|--------------|
| actions/checkout | v5 | `context7 actions/checkout` |
| actions/setup-node | v6 | `context7 actions/setup-node` |
| actions/upload-artifact | v5 (main), v4 (provapipe/RSS) | `context7 actions/upload-artifact` |
| actions/download-artifact | v5 | `context7 actions/download-artifact` |
| actions/cache | v4 | `context7 actions/cache` |
| actions-rust-lang/setup-rust-toolchain | v1 | `context7 actions-rust-lang/setup-rust-toolchain` |
| Swatinem/rust-cache | v2 | `context7 Swatinem/rust-cache` |
| cloudflare/pages-action | v1 | `context7 cloudflare/pages-action` |
| webfactory/ssh-agent | v0.9.0 | `context7 webfactory/ssh-agent` |

## GitHub Runners

| Job Type | Runner |
|----------|--------|
| snarkOS/SDK/DPS build | `ubuntu-latest-l` |
| Integration tests | `ubuntu-latest-l` |
| Provapipe/RSS build | `ubuntu-latest-m` |
| Generate matrix / Aggregate | `ubuntu-latest` |

⚠️ **Always use Context7 MCP to verify latest action versions before making workflow changes**

## Integration Test Suites

**Test Framework**: Node.js-based tests using `node:test`

### sdk-devnet
- Local SDK package installation verification
- snarkOS devnet lifecycle management
- SDK connectivity to local node
- Aleo program deployment transaction building

### dps-devnet
- DPS binary availability check
- DPS service lifecycle management
- Delegated proving via transfer_public transaction
- Transaction confirmation on blockchain
- Balance verification after transfer

**Running Tests**:
```bash
# Run all tests (handles clone, build, devnet)
./tests/run-all-tests.sh

# Skip build (use pre-built artifacts)
./tests/run-all-tests.sh --skip-build

# Dev mode (don't stop services after tests)
./tests/run-all-tests.sh --dev
```

**Test Timeouts**:
- sdk-devnet: 60 minutes
- dps-devnet: 60 minutes

## Local Execution

**Requirements**:
- Node.js 24.x with yarn
- Rust nightly toolchain (for WASM)
- Git (for cloning repositories)

**One Command**:
```bash
./tests/run-all-tests.sh
```

**What it does**:
1. Cleans old repos and clones fresh from GitHub (shallow clone)
2. Builds snarkOS from scratch
3. Builds and prepares SDK packages with version markers
4. Starts devnet and DPS
5. Runs all test suites
6. Generates reports in `test-results/`

## Dependencies

**Public Repositories**:
- **snarkOS**: Rust stable, builds with `--features=test_network`
- **SDK**: Rust nightly-2025-08-28, Node.js 24, yarn, WASM target

**Private Repositories** (require secrets):
- **DPS**: Rust stable, requires `MY_GITHUB_TOKEN`, builds with `--features test`
- **Record Scanning Service**: Rust, requires `MY_GITHUB_TOKEN` and `DEPENDENCY_CUSNARK_SSH_KEY`
- **Provapipe**: Rust, requires `MY_GITHUB_TOKEN`, needs `libsasl2-dev`

## Compatibility Dashboard

**URL**: Deployed to Cloudflare Pages (e2e-testing-reports)

**Features**:
- Visual matrix of all version combinations
- Pass/fail status for each combination
- Timestamp of last test run
- Filterable by component version

**Data Files**:
- `compatibility/matrix.json`: Test results
- `compatibility/versions.json`: Component configuration

## Milestone Status

**Milestone 1**: ✅ Complete - snarkOS + SDK integration with devnet tests

**Milestone 2**: ✅ Complete - DPS integration
  - ✅ DPS build workflow
  - ✅ dps-devnet test suite
  - ✅ Delegated proving validation
  - ✅ Compatibility matrix with 3 components

**Milestone 3**: ✅ Complete - Compatibility dashboard enhancements
  - ✅ Cloudflare Pages deployment
  - ✅ Nightly version updates

**Milestone 3.5**: ✅ Complete - AI-powered test evolution
  - ✅ Nightly cron workflow (`evolve-tests.yml`)
  - ✅ crush (opencode) agent with z.ai provider
  - ✅ Upstream change awareness (snarkOS, SDK recent commits)
  - ✅ Past test results analysis (from `matrix.json`)
  - ✅ Auto-PR creation with `e2e-evolution` label
  - ✅ Stale PR auto-cleanup (>14 days)
  - ✅ JS syntax + JSON validation before PR

**Milestone 4**: 📋 Planned - Record scanning service integration

**Milestone 5**: 📋 Future - Wallet application testing

## Common Operations

**Adding a new component**:
1. Use Context7 MCP to get latest action versions
2. Create reusable workflow in `.github/workflows/setup-<component>.yml`
3. Add component to `compatibility/versions.json`
4. Add build job to `compatibility-matrix.yml`
5. Add input parameter to workflow_dispatch in compatibility-matrix.yml
6. Handle the new input in generate-matrix step

**Adding a test suite**:
1. Create directory in `tests/integration/<suite-name>/`
2. Add `package.json` with `@provablehq/sdk` dependency
3. Create `test.js` using node:test framework
4. Add suite name to `testSuites` array in `tests/run-all-tests.js`
5. Add timeout configuration in `suiteTimeouts`

**Updating versions.json**:
- Runs automatically on nightly schedule
- Tags fetched from GitHub API
- Commits with `[skip ci]` to avoid triggering builds

**Manual matrix test**:
```bash
gh workflow run compatibility-matrix.yml \
  --field snarkos_versions=v4.4.0 \
  --field sdk_versions=v0.9.14 \
  --field dps_versions=v0.18.1
```

## Troubleshooting

### CI/CD Issues

**Build job failures**: 
- Check component-specific workflows in `.github/workflows/setup-*.yml`
- Verify secrets are configured: `MY_GITHUB_TOKEN`, `DEPENDENCY_CUSNARK_SSH_KEY`
- Check Rust cache compatibility (Swatinem/rust-cache@v2)
- For SDK build: Requires Rust nightly-2025-08-28 with wasm32-unknown-unknown target
- For snarkOS build: Uses `--features=test_network`
- For DPS build: Requires `--features test` flag, checks out `feat/test-flag` branch

**Integration test failures**:
- Review test reports in workflow artifacts (7-day retention)
- Download `test-report-snarkos-{version}-sdk-{version}-dps-{version}` artifact
- Download `service-logs-snarkos-{version}-sdk-{version}-dps-{version}` artifact for snarkOS and DPS logs
- Check GitHub step summary for overview
- Verify local package versions have `-local-<commit>` markers

**DevNet issues in CI**:
- Check devnet logs: `/tmp/snarkos-devnet-logs/validator-*.log` (collected in `service-logs-*` artifact)
- Download `service-logs-snarkos-{version}-sdk-{version}-dps-{version}` artifact from workflow run
- Verify all 4 validators started
- DevNet requires 120s timeout for validators to sync
- REST API endpoint: `http://localhost:3030/v2/testnet/block/height/latest`

**DPS issues in CI**:
- Check DPS logs: `/tmp/dps-logs/dps.log` (collected in `service-logs-*` artifact)
- Download `service-logs-snarkos-{version}-sdk-{version}-dps-{version}` artifact from workflow run
- DPS endpoint: `http://localhost:3000/prove`
- Verify DPS binary has execute permission

**Compatibility matrix issues**:
- Check generate-matrix step output for version detection
- Verify versions.json has valid JSON structure
- Check if GitHub API rate limit exceeded
- Matrix uses all combinations: snarkos × sdk × dps

**Cache issues**:
- Binary caches: `snarkos-binary-{version}`, `sdk-build-{version}`, `dps-binary-{version}`
- Rust caches use `shared-key` for cross-job sharing
- Cache miss: Check if version/ref changed between runs

### Local Development

**Quick Start**:
```bash
./tests/run-all-tests.sh
```

**Test failures**:
1. Verify locally built packages have `-local-` version markers
2. Check `yarn.lock` files contain `file:` protocol references
3. Ensure snarkOS/DPS binaries exist for devnet tests
4. Review component compatibility if multiple tests fail

**Build issues**:
- WASM build requires Rust nightly with wasm32-unknown-unknown target
- Check `local_build/sdk/wasm/dist/` exists after build
- DPS requires `--features test` for local environment

**Known limitations**: 
- Rust may crash on Apple Silicon Macs due to QEMU emulation
- Private components not available for local testing without access
- DevNet/DPS tests require binaries to be fully built

## Notes for AI Agents

⚠️ **CRITICAL**: Always use Context7 MCP to verify latest GitHub Action versions before modifying any workflow file. Do not assume the versions in this document are current.

**Workflow Architecture**:
- Multi-job design with parallel builds and artifact passing
- Binary caching via `actions/cache@v4` for faster rebuilds
- Compatibility matrix tests all version combinations
- Results stored in matrix.json and deployed to dashboard

**CI Build Process**:
- SDK: Rust nightly-2025-08-28 + wasm32 target → `yarn install --immutable` → `yarn build:all` → Create tarball
- snarkOS: `cargo build --release --features=test_network`
- DPS: `cargo build --release --features test` (from `feat/test-flag` branch)
- Artifacts are minimal (just binaries/tarballs)

**DevNet in CI**:
- 4 validators via `start-devnet.sh` (minimum for genesis committee)
- 120s timeout for validators to sync
- REST API: `http://localhost:3030/v2/testnet/block/height/latest`
- Cleanup always runs via `stop-devnet.sh`
- Logs collected and uploaded as artifacts: `/tmp/snarkos-devnet-logs/validator-*.log`

**DPS in CI**:
- Started via `start-dps.sh`
- Connects to local devnet on port 3030
- Proves endpoint: `http://localhost:3000/prove`
- Logs in `/tmp/dps-logs/dps.log`
- Logs collected and uploaded as artifacts

**Artifacts**:
- `test-report-snarkos-{version}-sdk-{version}-dps-{version}`: Test results and traces (7-day retention)
- `service-logs-snarkos-{version}-sdk-{version}-dps-{version}`: snarkOS devnet and DPS service logs (7-day retention)
- `compat-result-{version}-{version}-{version}`: Individual test results for aggregation (7-day retention)
- `compatibility-dashboard`: Dashboard files for Cloudflare Pages deployment (30-day retention)

**Testing Strategy**:
- Tests are non-blocking: always exit 0 to not fail pipeline
- Local packages verified via version markers (`-local-<commit>`)
- Test reports: JSON + GitHub summary formats
- node:test framework for structured assertions
- Test timeouts: 60 minutes per suite

**Compatibility Matrix**:
- Reads component config from versions.json
- Nightly: Fetches latest N tags from GitHub API
- Tests all combinations of component versions
- Results aggregated into matrix.json
- Dashboard deployed to Cloudflare Pages

**Version Management**:
- versions.json: Source of truth for tags to test
- matrix.json: Historical test results
- Auto-updated on nightly runs with `[skip ci]` commits
- Manual override via workflow_dispatch inputs

**Component Integration**:
- snarkOS: Public, builds to binary with `--features=test_network`
- SDK: Public, builds to npm tarball via `yarn build:all`
- DPS: Private, builds to binary with `--features test`
- All components use binary caching for faster CI

# Integration Test Repository - AI Agent Documentation

This document provides technical information about the integration test repository for AI agents.

## Repository Purpose

Integration test framework for ProvableHQ's components. Aims to be an e2e test for browser extension wallet and its dependencies. Tests multiple repositories together to ensure compatibility and correctness. Currently validates that snarkOS and SDK repositories work together.

## Repository Coverage

- [snarkOS](https://github.com/provableHQ/snarkOS) - Decentralized OS for zero-knowledge applications
- [SDK](https://github.com/ProvableHQ/sdk) - Aleo SDK for TypeScript/JavaScript
- Record Scanning Service (private) - Record scanning functionality
- Provapipe (private) - Pipeline infrastructure

## Repository Structure

```
├── .github/workflows/integration-tests.yml  # GitHub Actions workflow
├── README.md                               # Human documentation
├── agents.md                               # This file
├── tests/
│   ├── integration/                        # Integration test suites
│   │   └── sdk-devnet/                     # Full devnet integration
│   ├── setup/                              # Setup scripts
│   │   ├── install-packages.sh             # Build and prepare local packages
│   │   ├── start-devnet.sh                 # Start local snarkOS devnet
│   │   ├── stop-devnet.sh                  # Stop devnet
│   │   ├── wait-for-devnet.sh              # Wait for devnet readiness
│   │   └── test-helpers.js                 # Test utilities and reporting
│   ├── programs/                           # Test Aleo programs
│   ├── run-all-tests.sh                    # Master test runner
│   └── run-all-tests.js                    # Test orchestrator
└── .gitignore                              # Git ignores
```

## Workflow Configuration

**Triggers**: Push/PR to `master` branch

**Architecture**: Multi-job workflow with artifact passing and proper caching

### Build Jobs (Parallel Execution)
1. **`snarkos-build`**:
   - Clones snarkOS repository (shallow)
   - Sets up Rust toolchain with Swatinem/rust-cache@v2
   - Builds release binary with `RUSTFLAGS="-C target-cpu=native"`
   - Uploads entire repository as artifact (includes built binary)

2. **`sdk-build`**:
   - Clones SDK repository (shallow)
   - Sets up Rust toolchain (for WASM compilation)
   - Installs wasm-pack
   - Sets up Node.js 20.x with yarn cache
   - Installs dependencies (frozen lockfile)
   - **Builds WASM module** (`sdk/wasm/yarn build` - requires Rust)
   - **Builds SDK packages** (`sdk/sdk/yarn build`)
   - Uploads entire repository as artifact (includes built packages)

3. **`record-scanning-service-build`** (private) - **COMMENTED OUT**:
   - Requires `MY_GITHUB_TOKEN` and `DEPENDENCY_CUSNARK_SSH_KEY` secrets
   - Builds record scanning service from private repo
   - Currently disabled for milestone 1

4. **`provapipe-build`** (private) - **COMMENTED OUT**:
   - Requires `MY_GITHUB_TOKEN` secret
   - Builds provapipe from private repo
   - Currently disabled for milestone 1

### Integration Tests Job (`ubuntu-latest-m`)
**Dependencies**: Waits for `snarkos-build` and `sdk-build` to complete

**Execution Flow**:
1. **Checkout** integration test repository
2. **Download Artifacts** to `local_build/` directory:
   - `local_build/snarkOS/` (with built binary)
   - `local_build/sdk/` (with built WASM & packages)
3. **Setup Environment**:
   - Node.js 20.x with yarn cache
   - Make snarkOS binary executable and verify version
4. **Prepare SDK Packages**:
   - Run `install-packages.sh` to create local package versions
   - Creates tarballs with `-local-<commit>` version markers
5. **DevNet Lifecycle**:
   - Start 4-validator devnet (`start-devnet.sh`)
   - Wait for readiness (`wait-for-devnet.sh` - checks REST API)
   - Run integration tests
   - Stop devnet in cleanup (always runs, even on failure)
6. **Test Execution**:
   - Runs test suite: `sdk-devnet`
   - Non-blocking: Uses `|| true` to collect all results
7. **Reporting**:
   - Uploads test reports as artifacts (7-day retention)
   - Posts GitHub step summary with test results

**Key Features**:
- **Parallel builds**: All components build simultaneously
- **Artifact reuse**: Built binaries/packages passed between jobs
- **Smart caching**: Rust cache (Swatinem) and yarn cache (actions/setup-node)
- **DevNet automation**: Full devnet lifecycle management in CI
- **Non-blocking tests**: Pipeline doesn't fail, collects all results
- **Local package verification**: Tests use locally built packages with version markers
- **Fast iteration**: `--quick --dev` flags skip redundant cloning/building

**Action Versions**: 
- actions/checkout@v5
- actions/setup-node@v6
- actions/upload-artifact@v4
- actions/download-artifact@v4
- actions-rust-lang/setup-rust-toolchain@v1
- Swatinem/rust-cache@v2

**GitHub Runners**:
- Uses `ubuntu-latest-m` (paid GitHub hosted runner) for all jobs
- Provides better performance than standard runners

Use Context7 MCP to verify latest versions when updating workflows

## Local Execution

**Direct Test Execution**:
```bash
# One command - handles everything
./tests/run-all-tests.sh
```

**Requirements**:
- Node.js 20.x with yarn
- Rust toolchain (for building snarkOS/WASM)
- Git (for cloning repositories)

**What it does**:
1. Cleans old repos and clones fresh from GitHub (shallow clone, fast)
2. Builds snarkOS from scratch
3. Builds and prepares SDK packages with version markers
4. Runs all test suites
5. Generates reports in `test-results/`

**Always gets latest**: Every run does shallow clone (latest commit only) and builds from scratch

## Dependencies

**Public Repositories**:
- **snarkOS**: Rust, Cargo, builds to release binary
- **SDK**: TypeScript/JavaScript, yarn, includes WASM modules

**Private Repositories** (require secrets):
- **Record Scanning Service**: Rust, requires `MY_GITHUB_TOKEN` and `DEPENDENCY_CUSNARK_SSH_KEY`
- **Provapipe**: Requires `MY_GITHUB_TOKEN`

**Build Requirements**:
- Rust toolchain (stable)
- Node.js 20.x with yarn
- WASM build tools (wasm-pack)

**Current**: Uses default branches. Future: commit hash specification.

## Integration Test Suites

**Test Framework**: Node.js-based tests using `node:test` that validate cross-component functionality with locally built packages.

**Available Suite**:
- **sdk-devnet**: Full stack integration test validating:
  - Local SDK package installation
  - snarkOS devnet lifecycle management
  - SDK connectivity to local node
  - Aleo program deployment transaction building

**Running Tests**:
```bash
# Just run this - handles everything
./tests/run-all-tests.sh
```

**Test Reports**: Generated in `test-results/` (JSON + GitHub summary)

**Local Package Verification**: Tests use locally built SDK/snarkOS with version markers to ensure correct package sources.

## Milestone Status

**Milestone 1**: ✅ Complete - snarkOS + SDK integration with devnet tests
  - ✅ Local test framework
  - ✅ CI workflow with parallel builds and artifact passing
  - ✅ Full devnet lifecycle management in CI
  - ✅ Professional test suite using node:test (sdk-devnet)

**Milestone 2**: 📋 Planned - Record scanning service integration
  - Requires private repo access and secrets
  - Workflow files commented out, ready to enable

**Milestone 3**: 📋 Planned - Provapipe integration
  - Requires private repo access
  - Workflow files commented out, ready to enable

**Milestone 4**: 📋 Future - Wallet application testing

## Common Operations

**Adding a new component**:
1. Create reusable workflow in `.github/workflows/setup-<component>.yml`
2. Add build job to `integration-tests.yml`
3. Add artifact download step to `integration-tests` job
4. Update `tests/setup/install-packages.sh` if needed

**Adding a test suite**:
1. Create directory in `tests/integration/<suite-name>/`
2. Add `package.json` with `@provablehq/sdk` dependency
3. Create `test.js` using node:test framework
4. Add suite name to `testSuites` array in `tests/run-all-tests.js`

**Modifying test commands**: Update `tests/run-all-tests.sh` or individual test files

**Updating GitHub Actions**: Use Context7 MCP to verify latest action versions

## Troubleshooting

### CI/CD Issues

**Build job failures**: 
- Check component-specific workflows in `.github/workflows/setup-*.yml`
- Verify secrets are configured (for private repos): `MY_GITHUB_TOKEN`, `DEPENDENCY_CUSNARK_SSH_KEY`
- Check Rust cache compatibility (Swatinem/rust-cache@v2)
- For SDK build: 
  - Ensure Rust toolchain is set up before WASM build
  - Verify wasm-pack is installed
  - WASM must build before SDK package build
  - Check `RUSTFLAGS="-C target-cpu=native"` for WASM compilation
- For snarkOS build: Check `RUSTFLAGS="-C target-cpu=native"` compatibility

**Integration test failures**:
- Review test reports in workflow artifacts (7-day retention)
- Download `integration-test-report` artifact and check `test-report.json`
- Check GitHub step summary for test result overview
- Verify local package versions have `-local-<commit>` markers
- Ensure artifacts downloaded to correct paths (`local_build/`)

**DevNet issues in CI**:
- Check devnet logs: `/tmp/snarkos-devnet-logs/validator-*.log`
- Verify all 4 validators started (check PIDs in `/tmp/snarkos-devnet-test.pid`)
- Ensure REST API endpoint is accessible: `http://localhost:3030/v2/testnet/block/height/latest`
- DevNet requires 120s timeout for 4 validators to sync
- Check if snarkOS binary is executable after artifact download

**Artifact issues**:
- Ensure build jobs complete successfully before integration tests job starts
- Check artifact names match between upload (setup-*.yml) and download (integration-tests.yml)
- Verify artifacts uploaded to correct paths (retention: 1 day for builds, 7 days for reports)
- Artifacts should include hidden files (`include-hidden-files: true`)

**Cache issues**:
- Rust cache uses `shared-key` for cross-job sharing
- Yarn cache uses `cache-dependency-path: local_build/sdk/yarn.lock`
- Cache misses: Check if cache keys changed between runs
- Clear cache: Re-run workflow or manually delete in GitHub Actions cache settings

### Local Development

**Quick Start**:
- Run `./tests/run-all-tests.sh` - it handles everything
- Always clones fresh and builds from scratch (ensures latest code)
- Requires Node.js 20.x, yarn, and Rust toolchain

**Test failures**:
1. Verify locally built packages have `-local-` version markers
2. Check `yarn.lock` files contain `file:` protocol references
3. Ensure snarkOS binary exists for devnet tests (or tests will skip)
4. Review component compatibility if multiple tests fail

**Build issues**:
- WASM build must complete before SDK build (automatic)
- Check `local_build/sdk/wasm/dist/` exists after build
- SDK build errors usually mean WASM isn't built yet

**Known limitations**: 
- Rust may crash on Apple Silicon Macs due to QEMU emulation (use GitHub Actions)
- Private components not available for local testing without access
- DevNet tests require snarkOS to be fully built (time-intensive)

## Related Documentation

- [snarkOS Documentation](https://developer.aleo.org/sdk/overview)
- [SDK Reference](https://github.com/ProvableHQ/sdk/blob/mainnet/.github/workflows/website.yml)
- [act Documentation](https://github.com/nektos/act)

## Notes for AI Agents

**Workflow Architecture**:
- Multi-job design with parallel builds and artifact passing
- Uses default branches - commit hash specification planned
- Public repos (snarkOS, SDK) + private repos (record-scanning, provapipe)
- Requires `MY_GITHUB_TOKEN` and `DEPENDENCY_CUSNARK_SSH_KEY` secrets for private components
- Artifacts downloaded to `local_build/` directory (matches local development structure)
- Build jobs complete before integration tests job (dependency chain)

**CI Build Process**:
- SDK build: Sets up Rust + wasm-pack → Installs deps → Builds WASM (`sdk/wasm/yarn build`) → Builds SDK packages (`sdk/sdk/yarn build`)
- snarkOS build: Builds release binary with `RUSTFLAGS="-C target-cpu=native"`
- Artifacts include entire repositories with built binaries/packages
- Smart caching: Rust cache with `shared-key`, yarn cache with `cache-dependency-path`
- Note: WASM compilation requires Rust toolchain and wasm-pack

**DevNet in CI**:
- 4 validators started via `start-devnet.sh` (minimum for genesis committee)
- 120s timeout for validators to sync and reach quorum
- REST API endpoint: `http://localhost:3030/v2/testnet/block/height/latest`
- Logs stored in `/tmp/snarkos-devnet-logs/validator-*.log`
- Cleanup always runs (even on failure) via `stop-devnet.sh`

**Testing Strategy**:
- Tests are non-blocking: collect results but don't fail CI pipeline (uses `|| true`)
- Local packages verified via version markers (`-local-<commit>` suffix)
- Test reports generated in JSON + GitHub summary formats
- Uses node:test framework for structured assertions
- Test suite: `sdk-devnet` - full stack integration

**Local Development**:
- One command: `./tests/run-all-tests.sh` - handles clean, clone, build, and test
- Always cleans old repos and shallow clones fresh (fast, latest code only)
- Builds everything from scratch each run
- Automatically detects SDK/snarkOS in `local_build/` directory
- Builds packages with version markers for verification
- Private components not available without repository access

**Component Integration**:
- Record scanning integrated but private/closed source
- Provapipe integrated but private/closed source  
- All components downloaded as artifacts in CI
- Local setup only includes public components (snarkOS, SDK)


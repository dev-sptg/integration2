# Integration Test Repository

**[View E2E Testing Reports Dashboard](https://e2e-testing-reports.pages.dev/)**

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
- **Log collection**: snarkOS and DPS logs automatically uploaded as artifacts for debugging

### GitHub Actions Runners

- Uses `ubuntu-latest-l` (GitHub hosted runner) for better performance
- Runs on `ubuntu-latest-l` for all jobs (snarkos-build, sdk-build, integration-tests)

## On-Demand Compatibility Testing

For developers who need to test compatibility between specific commits, tags, or branches across components (snarkOS, SDK, DPS), use the **Compatibility Matrix** workflow. The workflow automatically detects standalone mode when commit SHAs are provided.

### Use Cases

- Test your component's PR against specific versions of other components
- Verify compatibility before merging
- Debug integration issues with exact commit versions
- Generate shareable test reports
- Test specific tags or branches

### Running On-Demand Tests

The workflow supports unified inputs that accept tags, branches, or commit SHAs. Standalone mode is **automatically enabled** when any input looks like a commit SHA (7-40 hex characters).

#### Via GitHub Actions UI

1. Navigate to the **Actions** tab in this repository
2. Select **"Compatibility Matrix"** workflow
3. Click **"Run workflow"**
4. Fill in the parameters:
   - **snarkos**: Version (tag, branch, or commit SHA, e.g., `v4.4.0`, `mainnet`, or `a1b2c3d4`)
   - **sdk**: Version (tag, branch, or commit SHA)
   - **dps**: (Optional) Version (tag, branch, or commit SHA)
5. Click **"Run workflow"**

**Note**: 
- At least one component must be specified
- If only one component is provided, the workflow will automatically fetch the latest passing versions from `matrix.json` for the other components
- Commit SHAs are automatically detected and validated via GitHub API

#### Via GitHub CLI

**Test with commit SHAs (standalone mode auto-enabled):**
```bash
gh workflow run compatibility-matrix.yml \
  -f snarkos=a1b2c3d4e5f6 \
  -f sdk=f6e5d4c3b2a1
```

**Test with tags (matrix mode):**
```bash
gh workflow run compatibility-matrix.yml \
  -f snarkos=v4.4.0,v4.3.0 \
  -f sdk=v0.9.14
```

**Test single component (auto-fetches others from matrix.json):**
```bash
gh workflow run compatibility-matrix.yml \
  -f sdk=a1b2c3d4e5f6
```

#### Via GitHub REST API (curl)

**Test with commit SHAs:**
```bash
curl -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/ProvableHQ/integration/actions/workflows/compatibility-matrix.yml/dispatches \
  -d '{
    "ref": "master",
    "inputs": {
      "snarkos": "a1b2c3d4e5f6",
      "sdk": "f6e5d4c3b2a1"
    }
  }'
```

**Test with tags:**
```bash
curl -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/ProvableHQ/integration/actions/workflows/compatibility-matrix.yml/dispatches \
  -d '{
    "ref": "master",
    "inputs": {
      "snarkos": "v4.4.0",
      "sdk": "v0.9.14"
    }
  }'
```

#### From Another Workflow

You can also trigger on-demand tests programmatically from other repositories:

```yaml
- name: Run on-demand compatibility test
  uses: provableHQ/integration/.github/workflows/compatibility-matrix.yml@main
  with:
    snarkos: ${{ steps.snarkos.outputs.sha }}
    sdk: ${{ steps.sdk.outputs.sha }}
  secrets:
    REPO_ACCESS_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Accessing Results

After the workflow completes:

1. **GitHub Summary**: Quick overview on the workflow run page with component versions and test results
2. **HTML Report**: Download the `on-demand-report-*.html` artifact from the Artifacts section (standalone mode only)
   - Open the HTML file in any browser to view the full report
   - Share the file with team members for review
   - Reports include commit metadata, test results, and detailed logs

### Key Differences from Regular Matrix Tests

| Feature | Matrix Tests | Standalone Mode (On-Demand) |
|---------|-------------|------------------------------|
| Trigger | Scheduled/PR | Manual/Programmatic |
| Detection | Default behavior | Auto-detected from commit SHAs |
| Versions | Tags/branches | Commit SHAs, tags, or branches |
| Results | Updated in `matrix.json` | Standalone HTML report |
| Dashboard | Deployed to Cloudflare Pages | Not deployed |
| Purpose | Continuous monitoring | Ad-hoc verification |
| Single Component | Uses all from versions.json | Auto-fetches from matrix.json |

## Local Package Verification

Tests verify packages are installed from local builds, not npm registry:

1. **Version marking**: SDK packages marked with `-local-<commit>` suffix
2. **Dependency check**: Tests verify `node_modules` contains locally built packages
3. **Binary verification**: snarkOS binary verified from local build

## Development

For detailed technical information and AI agent context, see [agents.md](agents.md).

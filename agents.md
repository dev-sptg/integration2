# Integration Test Repository - AI Agent Documentation

This document provides technical information about the integration test repository for AI agents.

## Repository Purpose

Integration test framework for ProvableHQ's components. Aims to be an e2e test for browser extension wallet and its dependencies. Tests multiple repositories together to ensure compatibility and correctness. Currently validates that snarkOS and SDK repositories work together.

## Repository Coverage

- [snarkOS](https://github.com/provableHQ/snarkOS)
- [SDK](https://github.com/ProvableHQ/sdk)

## Repository Structure

```
├── .github/workflows/integration-tests.yml  # GitHub Actions workflow
├── README.md                               # Human documentation
├── agents.md                               # This file
└── .gitignore                              # Git ignores
```

## Workflow Configuration

**Triggers**: Push/PR to `main` or `master` branches

**Job**: `integration-tests` (ubuntu-latest)
- Clones integration repo, snarkOS, and SDK
- Sets up Rust toolchain with caching
- Builds and tests snarkOS
- Sets up Node.js with yarn cache
- Installs and tests SDK

**Action Versions**:
- `actions/checkout@v5`
- `actions-rust-lang/setup-rust-toolchain@v1`
- `actions/setup-node@v4`

## Local Execution

**Prerequisites**: Docker/Rancher Desktop + act

**Installation**:
- Docker: Install from docker.com or rancherdesktop.io
- act: `brew install act` (macOS) or equivalent

**Running locally**:
```bash
# Run with GitHub token (required for external repos)
act -W .github/workflows/integration-tests.yml \
    --container-architecture linux/amd64 \
    -s GITHUB_TOKEN=your_github_token
```

## Dependencies

**External Repositories**:
- **snarkOS**: Rust, Cargo, `cargo test --release`
- **SDK**: JavaScript/TypeScript, yarn, `yarn test`

**Current**: Uses default branches. Future: commit hash specification.

## Milestone Status

**Milestone 1 (Current)**: ✅ Basic workflow, snarkOS + SDK integration
**Milestone 2**: Add closed source components (Leo, etc.)
**Milestone 3**: Add wallet application testing

## Common Operations

**Adding a repository**: Add checkout, install, and test steps to workflow.yml

**Modifying test commands**: Update run steps in workflow.yml

**Updating actions**: Check Context7 for latest versions

## Troubleshooting

**Workflow failures**: Check repository access, action versions, test commands

**Local issues**: Ensure Docker running, use `--container-architecture linux/amd64` on Apple Silicon

**Known limitation**: Rust may crash on Apple Silicon Macs due to QEMU emulation. Use GitHub Actions for full testing.

### Test Failures

1. Check if repositories have changed their test commands
2. Verify dependency compatibility
3. Review individual repository CI/CD for reference
4. Check for breaking changes in dependencies

## Related Documentation

- [snarkOS Documentation](https://developer.aleo.org/sdk/overview)
- [SDK Reference](https://github.com/ProvableHQ/sdk/blob/mainnet/.github/workflows/website.yml)
- [act Documentation](https://github.com/nektos/act)

## Notes for AI Agents

- Minimal skeleton - test commands may need adjustment
- Uses default branches - commit hash specification planned
- Both repositories public - GITHUB_TOKEN sufficient
- Rust caching enabled, Node.js uses yarn


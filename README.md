# Integration Test Repository

This repository contains integration tests for ProvableHQ's components and aims in the end to be e2e test for browser extension wallet and its dependencies. It tests multiple repositories together to ensure compatibility and correctness.

## Repository coverage

- [snarkOS](https://github.com/provableHQ/snarkOS)
- [SDK](https://github.com/ProvableHQ/sdk)


## Running Tests Locally

Run the integration tests:
```bash
# Run with GitHub token (required for external repos)
act -W .github/workflows/integration-tests.yml \
    --container-architecture linux/amd64 \
    -s GITHUB_TOKEN=your_github_token
```
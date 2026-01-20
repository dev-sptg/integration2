#!/bin/bash
# Validates a commit SHA and fetches its metadata from GitHub API
# Usage: ./validate-commit-sha.sh <repo> <sha>
# Output: JSON with {valid, sha, date, author, message, error}

set -euo pipefail

REPO="$1"
SHA="$2"
export GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

# Validate SHA format (7+ chars hex)
if ! echo "$SHA" | grep -qE '^[a-fA-F0-9]{7,40}$'; then
    jq -n --arg sha "$SHA" '{"valid": false, "sha": $sha, "error": "Invalid SHA format"}'
    false
fi

# Fetch commit info from GitHub API
# GitHub API automatically resolves short SHAs (7+ chars), no need for separate resolution
if COMMIT_INFO=$(gh api "repos/$REPO/commits/$SHA" --jq '{sha: .sha, date: .commit.committer.date, author: .commit.author.name, message: .commit.message}' 2>/dev/null); then
    # Success - return commit metadata
    # Escape newlines in commit message for safe JSON embedding
    echo "$COMMIT_INFO" | jq '.message |= gsub("\n"; " ") | .valid = true'
    exit 0
fi

# If we get here, the commit wasn't found
# Use explicit false to ensure non-zero exit code (jq -n succeeds with exit 0)
jq -n --arg sha "$SHA" --arg repo "$REPO" '{"valid": false, "sha": $sha, "error": "Commit not found in \($repo) repository"}'
false

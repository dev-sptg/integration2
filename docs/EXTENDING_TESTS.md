# Extending Tests

Guide for adding new test suites to the integration framework.

## Adding a New Test Suite

### 1. Create Test Directory

```bash
mkdir -p tests/integration/my-new-test
```

### 2. Create package.json

```json
{
  "name": "my-new-test",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node test.js"
  },
  "dependencies": {
    "@provablehq/sdk": "file:../../../local_build/sdk/provablehq-sdk-v0.9.14-local-local.tgz"
  }
}
```

The SDK path gets auto-updated by `install-packages.sh`.

### 3. Create test.js

```javascript
#!/usr/bin/env node

import { test } from 'node:test';
import assert from 'node:assert';
import { Account, AleoNetworkClient } from '@provablehq/sdk/testnet.js';

const CONFIG = {
    devnetApi: 'http://localhost:3030',
};

test('My Test Suite', async (t) => {
    await t.test('Connect and do something', async () => {
        const account = new Account({ privateKey: "APrivateKey1zkp8CZNn3yeCseEtxuVPbDCwSyhGW6yZKUYKfgXmcpoGPWH" });
        const client = new AleoNetworkClient(CONFIG.devnetApi);
        
        const height = await client.getLatestHeight();
        assert.ok(height >= 0, 'Should connect to devnet');
        console.log(`  Block height: ${height}`);
    });
});
```

**Note:** Tests assume services (devnet, DPS) are already running. CI handles service startup.

### 4. Register in Test Runner

Edit `tests/run-all-tests.js`:

```javascript
const testSuites = ['sdk-devnet', 'transfer-public', 'dps-devnet', 'my-new-test'];
const suiteTimeouts = {
    // ...existing...
    'my-new-test': 10 * 60 * 1000
};
```

### 5. Run Your Test

```bash
# Start services first (for local dev)
./tests/setup/start-devnet.sh
./tests/setup/wait-for-devnet.sh

# Run test
cd tests/integration/my-new-test
yarn install
node test.js
```

## Test Accounts

Pre-funded devnet accounts are defined in `tests/setup/constants.js`:

```javascript
import { TEST_ACCOUNTS, ENDPOINTS, TIMEOUTS } from '../../setup/constants.js';

// Use the pre-funded sender account
const sender = new Account({ privateKey: TEST_ACCOUNTS.SENDER.privateKey });

// Use the receiver account
const receiver = new Account({ privateKey: TEST_ACCOUNTS.RECEIVER.privateKey });

// Or create a new random account as recipient
const randomRecipient = new Account();
```

## Consensus Heights (SDK)

For devnet testing:

```javascript
import { getOrInitConsensusVersionTestHeights } from '@provablehq/sdk/testnet.js';
getOrInitConsensusVersionTestHeights("0,1,2,3,4,5,6,7,8,9,10,11");
```

## Helper Functions

From `../../setup/test-helpers.js`:

| Function | Purpose |
|----------|---------|
| `creditsToMicrocredits(n)` | Convert credits to microcredits |

## Known SDK Quirks

### Balance Double-Multiplication Bug

When using `buildTransferTransaction()` with credit amounts, the SDK multiplies the input by `1_000_000` twice (credits → microcredits conversion happens twice internally).

```javascript
// If you pass 1 credit:
programManager.buildTransferTransaction(1, recipient, 'transfer_public', 0.2);

// The actual transfer will be 1_000_000_000_000 microcredits (1M credits), not 1_000_000
const actualAmount = BigInt(inputCredits * 1_000_000 * 1_000_000);
```

**Workaround**: Account for this when verifying balances in tests, or use microcredit values directly where possible.

## Tips

- **Timeouts**: Set appropriate timeouts for proving/confirmation operations
- **Assertions**: Use descriptive error messages
- **No service management**: Tests don't start/stop services - CI handles that

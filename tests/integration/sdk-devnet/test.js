#!/usr/bin/env node

/**
 * SDK + snarkOS DevNet Integration Test
 * 
 * Tests SDK connectivity and program deployment on local devnet.
 * Assumes devnet is already running (started by CI or manually).
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
    Account,
    AleoNetworkClient,
    ProgramManager,
    AleoKeyProvider,
    NetworkRecordProvider
} from '@provablehq/sdk/testnet.js';
import { TEST_ACCOUNTS, ENDPOINTS, TIMEOUTS } from '../../setup/constants.js';

// Initialize consensus heights for devnet
try {
    const sdkModule = await import('@provablehq/sdk/testnet.js');
    if ('getOrInitConsensusVersionTestHeights' in sdkModule) {
        sdkModule.getOrInitConsensusVersionTestHeights("0,1,2,3,4,5,6,7,8,9,10,11");
    }
} catch {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const INTEGRATION_ROOT = join(__dirname, '../../..');

test('SDK Integration Tests', async (t) => {
    let networkClient, account, programSource;

    await t.test('SDK connects to devnet and queries block height', async () => {
        account = new Account({ privateKey: TEST_ACCOUNTS.SENDER.privateKey });
        networkClient = new AleoNetworkClient(ENDPOINTS.DEVNET_API);
        
        const height = await networkClient.getLatestHeight();
        assert.ok(height >= 0, 'Should get valid block height');
        console.log(`  Block height: ${height}`);
    });

    await t.test('Build and submit deployment transaction', async () => {
        const programPath = join(INTEGRATION_ROOT, 'tests/programs/main.aleo');
        programSource = readFileSync(programPath, 'utf8');

        const keyProvider = new AleoKeyProvider();
        keyProvider.useCache(true);
        
        const recordProvider = new NetworkRecordProvider(account, networkClient);
        const programManager = new ProgramManager(ENDPOINTS.DEVNET_API, keyProvider, recordProvider);
        programManager.setAccount(account);
        
        console.log(`  Building deployment transaction...`);
        
        const deploymentTx = await Promise.race([
            programManager.buildDeploymentTransaction(programSource, 0, false),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Deployment build timeout')), TIMEOUTS.DEPLOYMENT)
            )
        ]);
        
        assert.ok(deploymentTx, 'Deployment transaction should be built');

        const response = await programManager.networkClient.submitTransaction(deploymentTx);
        assert.ok(response, 'Transaction should be submitted');
        console.log(`  Transaction submitted`);
    }, { timeout: TIMEOUTS.DEPLOYMENT + 5000 });
});

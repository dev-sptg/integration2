#!/usr/bin/env node

/**
 * SDK + snarkOS DevNet Integration Test
 *
 * Validates the full integration stack:
 * 1. Local SDK package installation
 * 2. snarkOS devnet lifecycle management
 * 3. SDK connectivity to local node
 * 4. Aleo program deployment transaction building
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { 
    Account, 
    AleoNetworkClient, 
    ProgramManager, 
    AleoKeyProvider, 
    NetworkRecordProvider,
    getOrInitConsensusVersionTestHeights
} from '@provablehq/sdk/testnet.js';
import { verifyLocalSDK } from '../../setup/test-helpers.js';

// Set consensus heights for development network
// This is required when running against a devnet - without it, the SDK uses
// production heights and creates incorrect deployment transactions
const DEVNET_CONSENSUS_HEIGHTS = "0,1,2,3,4,5,6,7,8,9,10,11";
const heights = getOrInitConsensusVersionTestHeights(DEVNET_CONSENSUS_HEIGHTS);
console.log(`Consensus version test heights initialized: [${heights.join(',')}]`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const INTEGRATION_ROOT = join(__dirname, '../../..');
const DEVNET_API = 'http://localhost:3030';
const DEPLOYMENT_TIMEOUT_MS = 300000; // 5 minutes
const DEV_MODE = process.env.DEV_MODE === 'true';

let devnetStarted = false;

// Cleanup function
async function stopDevnet() {
    if (devnetStarted && !DEV_MODE) {
        try {
            execSync(`${INTEGRATION_ROOT}/tests/setup/stop-devnet.sh`, { stdio: 'inherit' });
        } catch (e) {
            console.warn(`Devnet cleanup failed: ${e.message}`);
        }
    } else if (DEV_MODE) {
        console.log('\nDev mode: Leaving devnet running for next iteration');
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    await stopDevnet();
    process.exit(1);
});

process.on('SIGTERM', async () => {
    await stopDevnet();
    process.exit(1);
});

// ============================================================
// Test Suite
// ============================================================

test('SDK Integration Tests', async (t) => {
    try {
        // Test 1: Verify local SDK installation
        await t.test('Local SDK package verification', () => {
            const sdkPackage = verifyLocalSDK(__dirname);
            assert.ok(sdkPackage.version, 'SDK version should be present');
            assert.match(sdkPackage.version, /-local-/, 'SDK should use local build');
            console.log(`  SDK version: ${sdkPackage.version}`);
        });

        // Test 2: Check snarkOS availability
        const snarkosPath = process.env.SNARKOS_BINARY_PATH || '';
        
        await t.test('snarkOS binary availability', () => {
            if (!snarkosPath || !existsSync(snarkosPath)) {
                console.log(`  snarkOS not found, skipping devnet tests`);
                console.log(`  To run full tests: cd local_build/snarkOS && cargo build --release`);
                t.skip('snarkOS not built');
            }
            assert.ok(existsSync(snarkosPath), 'snarkOS binary should exist');
            console.log(`  snarkOS: ${snarkosPath}`);
        });

        // Skip remaining tests if snarkOS not available
        if (!snarkosPath || !existsSync(snarkosPath)) {
            return;
        }

        // Test 3: Start devnet (or verify it's running in dev mode)
        await t.test('Start snarkOS devnet', () => {
            if (DEV_MODE) {
                console.log('  Dev mode: Assuming devnet is already running');
                // Verify it's accessible
                try {
                    execSync(`curl -s -f ${DEVNET_API}/v2/testnet/block/height/latest > /dev/null 2>&1`);
                    console.log('  Devnet is accessible');
                } catch (error) {
                    throw new Error('Devnet not accessible! Start it manually: ./tests/setup/start-devnet.sh');
                }
            } else {
                const startTime = Date.now();
                
                execSync(`${INTEGRATION_ROOT}/tests/setup/start-devnet.sh`, { stdio: 'inherit' });
                devnetStarted = true;
                
                execSync(`${INTEGRATION_ROOT}/tests/setup/wait-for-devnet.sh`, { stdio: 'inherit' });
                
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`  Devnet ready (${duration}s)`);
            }
        });

        // Test 4: SDK connection to devnet
        let networkClient, account;
        
        await t.test('SDK connects to local devnet', async () => {
            // Use snarkOS dev account 0 (pre-funded in genesis)
            account = new Account({
                privateKey: "APrivateKey1zkp8CZNn3yeCseEtxuVPbDCwSyhGW6yZKUYKfgXmcpoGPWH"
            });
            console.log(`  Account: ${account.address().toString()}`);
            
            networkClient = new AleoNetworkClient(DEVNET_API);
            const height = await networkClient.getLatestHeight();
            
            assert.ok(height >= 0, 'Devnet height should be non-negative');
            console.log(`  Devnet height: ${height}`);
        });

        // Test 5: Load Aleo program
        let programSource;
        
        await t.test('Load Aleo program', () => {
            const programPath = join(INTEGRATION_ROOT, 'tests/programs/main.aleo');
            programSource = readFileSync(programPath, 'utf8');
            
            assert.ok(programSource.includes('program'), 'Program should contain "program" keyword');
            console.log(`  Program: ${programPath}`);
        });

        // Test 6: Build deployment transaction
        await t.test('Build deployment transaction', async () => {
            const keyProvider = new AleoKeyProvider();
            keyProvider.useCache(true);
            
            const recordProvider = new NetworkRecordProvider(account, networkClient);
            const programManager = new ProgramManager(DEVNET_API, keyProvider, recordProvider);
            programManager.setAccount(account);
            
            // Query network state to ensure SDK has fresh consensus information
            // This is required for program checksum computation (Aleo Stack v4.2.0+)
            // The SDK needs to know the current consensus state to compute the checksum correctly
            const currentHeight = await networkClient.getLatestHeight();
            console.log(`  Current block height: ${currentHeight}`);
            
            // Also ensure ProgramManager's networkClient has queried the network
            // This ensures the SDK has the latest consensus state for checksum computation
            await programManager.networkClient.getLatestHeight();
            
            // Small delay to ensure consensus state is stable before building transaction
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log(`  Building deployment transaction (may take up to 5 minutes)...`);
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Deployment build timeout')), DEPLOYMENT_TIMEOUT_MS)
            );
            
            const deploymentPromise = programManager.buildDeploymentTransaction(programSource, 0, false);
            const deploymentTx = await Promise.race([deploymentPromise, timeoutPromise]);
            
            assert.ok(deploymentTx, 'Deployment transaction should be built');

            // programManager.networkClient.setVerboseTransactionErrors(true);

            await programManager.networkClient.submitTransaction(deploymentTx);
            console.log("Program deployed - response:", deploymentTx);

            console.log(`  Deployment transaction ready`);
        }, { timeout: DEPLOYMENT_TIMEOUT_MS + 5000 });

        console.log('\n  All integration tests passed');
        
    } finally {
        await stopDevnet();
    }
});

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
    NetworkRecordProvider
} from '@provablehq/sdk/testnet.js';
import {
    verifyLocalSDK,
    startService,
    stopService,
    isServiceAccessible
} from '../../setup/test-helpers.js';

// Set consensus heights for development network (only for SDK versions that support it)
const DEVNET_CONSENSUS_HEIGHTS = "0,1,2,3,4,5,6,7,8,9,10,11";
try {
    const sdkModule = await import('@provablehq/sdk/testnet.js');
    if ('getOrInitConsensusVersionTestHeights' in sdkModule) {
        const heights = sdkModule.getOrInitConsensusVersionTestHeights(DEVNET_CONSENSUS_HEIGHTS);
        console.log(`Consensus version test heights initialized: [${heights.join(',')}]`);
    }
} catch (error) {
    console.error(`Could not initialize consensus version test heights: ${error.message}`);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const INTEGRATION_ROOT = join(__dirname, '../../..');

// Configuration
const CONFIG = {
    devnetApi: 'http://localhost:3030',
    deploymentTimeout: 300000, // 5 minutes
    devMode: process.env.DEV_MODE === 'true',
};

// Service state
const services = { devnet: false };

// Cleanup function - only stops services that we started
async function cleanup() {
    if (CONFIG.devMode) {
        console.log('\nDev mode: Leaving all services running');
        return;
    }
    
    // Only stop services we started (services.X === true)
    if (services.devnet) {
        console.log('\nStopping devnet (we started it)...');
        stopService(`${INTEGRATION_ROOT}/tests/setup/stop-devnet.sh`, 'Devnet');
    } else {
        console.log('\nNo services to stop (devnet was already running)');
    }
}

// Handle process termination
process.on('SIGINT', async () => { await cleanup(); process.exit(1); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(1); });

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
                t.skip('snarkOS not built');
            }
            assert.ok(existsSync(snarkosPath), 'snarkOS binary should exist');
            console.log(`  snarkOS: ${snarkosPath}`);
        });

        if (!snarkosPath || !existsSync(snarkosPath)) return;

        // Test 3: Start devnet (or reuse if already running)
        await t.test('Start snarkOS devnet', async () => {
            const isRunning = isServiceAccessible(`${CONFIG.devnetApi}/v2/testnet/block/height/latest`);
            
            if (isRunning) {
                console.log('  Devnet already running, reusing...');
                services.devnet = false; // Don't stop it in cleanup since we didn't start it
            } else {
                console.log('  Starting devnet...');
                startService({ script: `${INTEGRATION_ROOT}/tests/setup/start-devnet.sh`, name: 'devnet' });
                services.devnet = true; // We started it, so we should clean it up
                execSync(`${INTEGRATION_ROOT}/tests/setup/wait-for-devnet.sh`, { stdio: 'inherit' });
            }
        });

        // Test 4: SDK connection to devnet
        let networkClient, account;
        
        await t.test('SDK connects to local devnet', async () => {
            account = new Account({ privateKey: "APrivateKey1zkp8CZNn3yeCseEtxuVPbDCwSyhGW6yZKUYKfgXmcpoGPWH" });
            console.log(`  Account: ${account.address().to_string()}`);
            
            networkClient = new AleoNetworkClient(CONFIG.devnetApi);
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
            const programManager = new ProgramManager(CONFIG.devnetApi, keyProvider, recordProvider);
            programManager.setAccount(account);
            
            const currentHeight = await networkClient.getLatestHeight();
            console.log(`  Current block height: ${currentHeight}`);
            
            await programManager.networkClient.getLatestHeight();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log(`  Building deployment transaction (may take up to 5 minutes)...`);
            
            const deploymentTx = await Promise.race([
                programManager.buildDeploymentTransaction(programSource, 0, false),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Deployment build timeout')), CONFIG.deploymentTimeout)
                )
            ]);
            
            assert.ok(deploymentTx, 'Deployment transaction should be built');

            await programManager.networkClient.submitTransaction(deploymentTx);
            console.log("Program deployed - response:", deploymentTx);
            console.log(`  Deployment transaction ready`);
        }, { timeout: CONFIG.deploymentTimeout + 5000 });

        console.log('\n  All integration tests passed');

    } finally {
        await cleanup();
    }
});


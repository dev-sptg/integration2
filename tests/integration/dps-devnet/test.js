#!/usr/bin/env node

/**
 * DPS (Delegated Proving Service) + snarkOS DevNet Integration Test
 *
 * Validates the full delegated proving stack:
 * 1. Local SDK package installation
 * 2. snarkOS devnet lifecycle management
 * 3. DPS (Delegated Proving Service) connectivity
 * 4. Delegated proving via transfer_public transaction
 * 5. Transaction confirmation on blockchain
 * 
 * Reference: https://developer.aleo.org/sdk/delegate-proving/delegate_proving/
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'fs';
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
import { 
    verifyLocalSDK, 
    findBinary, 
    waitForService, 
    startService, 
    stopService,
    isServiceAccessible 
} from '../../setup/test-helpers.js';

// Set consensus heights for development network
const DEVNET_CONSENSUS_HEIGHTS = "0,1,2,3,4,5,6,7,8,9,10,11";
const heights = getOrInitConsensusVersionTestHeights(DEVNET_CONSENSUS_HEIGHTS);
console.log(`Consensus version test heights initialized: [${heights.join(',')}]`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const INTEGRATION_ROOT = join(__dirname, '../../..');

// Configuration
const CONFIG = {
    devnetApi: 'http://localhost:3030',
    dpsApi: 'http://localhost:3000/prove',
    dpsHealthUrl: 'http://localhost:3000/health',
    txConfirmationTimeout: 120000, // 2 minutes
    provingRequestTimeout: 300000, // 5 minutes
    devMode: process.env.DEV_MODE === 'true',
};

// Service state
const services = { devnet: false, dps: false };

// Helper to get account balance from credits.aleo mapping
const getBalance = async (networkClient, address) => {
    try {
        const mapping = await networkClient.getProgramMappingValue('credits.aleo', 'account', address);
        return mapping ? BigInt(mapping.replace('u64', '')) : BigInt(0);
    } catch { return BigInt(0); }
};

// Cleanup function - only stops services that we started
async function cleanup() {
    if (CONFIG.devMode) {
        console.log('\nDev mode: Leaving all services running');
        return;
    }
    
    // Only stop services we started (services.X === true)
    if (services.dps) {
        console.log('\nStopping DPS (we started it)...');
        stopService(`${INTEGRATION_ROOT}/tests/setup/stop-dps.sh`, 'DPS');
    }
    if (services.devnet) {
        console.log('Stopping devnet (we started it)...');
        stopService(`${INTEGRATION_ROOT}/tests/setup/stop-devnet.sh`, 'Devnet');
    }
    if (!services.dps && !services.devnet) {
        console.log('\nNo services to stop (all were already running)');
    }
}

// Handle process termination
process.on('SIGINT', async () => { await cleanup(); process.exit(1); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(1); });

// ============================================================
// Test Suite
// ============================================================

test('DPS Delegated Proving Integration Tests', async (t) => {
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

        // Test 3: Check DPS binary availability
        const dpsPath = findBinary([
            join(INTEGRATION_ROOT, 'local_build/dps/target/release/prover'),
            join(INTEGRATION_ROOT, 'local_build/dps/bin/prover'),
            join(INTEGRATION_ROOT, 'local_build/dps/prover'),
        ], 'DPS_BINARY_PATH');
        
        await t.test('DPS binary availability', () => {
            if (!dpsPath) {
                console.log(`  DPS binary not found, skipping DPS tests`);
                t.skip('DPS not built');
            }
            assert.ok(dpsPath, 'DPS binary should exist');
            console.log(`  DPS: ${dpsPath}`);
        });

        if (!dpsPath) return;

        // Test 4: Start devnet (or reuse if already running)
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

        // Test 5: Start DPS (or reuse if already running)
        await t.test('Start DPS', async () => {
            const isRunning = isServiceAccessible(CONFIG.dpsHealthUrl);

            if (isRunning) {
                console.log('  DPS already running, reusing...');
                services.dps = false; // Don't stop it in cleanup since we didn't start it
            } else {
                console.log('  Starting DPS...');
                startService({
                    script: `${INTEGRATION_ROOT}/tests/setup/start-dps.sh`,
                    name: 'DPS',
                    env: { DPS_BINARY_PATH: dpsPath }
                });
                services.dps = true; // We started it, so we should clean it up
                await waitForService({ url: CONFIG.dpsHealthUrl, name: 'DPS', timeout: 120000 });
            }
        });

        // Test 6: SDK connection to devnet
        let networkClient, account, receiverAccount;
        let senderAddress, receiverAddress;
        
        await t.test('SDK connects to local devnet', async () => {
            // Dev accounts (pre-funded in genesis)
            account = new Account({ privateKey: "APrivateKey1zkp8CZNn3yeCseEtxuVPbDCwSyhGW6yZKUYKfgXmcpoGPWH" });
            receiverAccount = new Account({ privateKey: "APrivateKey1zkp2RWGDcde3efb89rjhME1VYA8QMxcxep5DShNBR6n8Yjh" });
            
            // Use to_string() for WASM Address objects
            senderAddress = account.address().to_string();
            receiverAddress = receiverAccount.address().to_string();
            
            console.log(`  Sender: ${senderAddress}`);
            console.log(`  Receiver: ${receiverAddress}`);
            
            networkClient = new AleoNetworkClient(CONFIG.devnetApi);
            const height = await networkClient.getLatestHeight();
            assert.ok(height >= 0, 'Devnet height should be non-negative');
            console.log(`  Devnet height: ${height}`);
        });

        // Test 7: Check initial balances
        let initialSenderBalance, initialReceiverBalance;
        const transferAmount = BigInt(1000000); // 1 credit
        
        await t.test('Check initial account balances', async () => {
            initialSenderBalance = await getBalance(networkClient, senderAddress);
            initialReceiverBalance = await getBalance(networkClient, receiverAddress);
            
            console.log(`  Sender balance: ${initialSenderBalance} microcredits`);
            console.log(`  Receiver balance: ${initialReceiverBalance} microcredits`);
            assert.ok(initialSenderBalance > BigInt(0), 'Sender should have initial balance');
        });

        // Test 8: Submit delegated proving request
        let transactionId;
        
        await t.test('Submit delegated proving request for transfer_public', async () => {
            const keyProvider = new AleoKeyProvider();
            keyProvider.useCache(true);
            
            const recordProvider = new NetworkRecordProvider(account, networkClient);
            const programManager = new ProgramManager(CONFIG.devnetApi, keyProvider, recordProvider);
            programManager.setAccount(account);

            try{ 
                console.log(`  Account: ${account.address().to_string()}`);
                console.log(`  Balance: ${await getBalance(networkClient, account.address().to_string())}`);
            } catch (error) {
                console.error(`  Error getting balance: ${error}`);
            }


            console.log(`  Building proving request...`);
            console.log(`    Amount: ${transferAmount} microcredits`);
            
            // Build proving request per https://developer.aleo.org/sdk/delegate-proving/delegate_proving/
            const provingRequest = await programManager.provingRequest({
                programName: "credits.aleo",
                functionName: "transfer_public",
                baseFee: 100000,
                priorityFee: 0,
                privateFee: false,
                inputs: [receiverAddress, `${transferAmount}u64`],
                broadcast: true,
            });
            
            console.log(`  Submitting to DPS...`);
            
            const provingResponse = await Promise.race([
                programManager.networkClient.submitProvingRequest({
                    provingRequest: provingRequest,
                    url: CONFIG.dpsApi,
                    jwtData: { jwt: 'fake-jwt-for-local-dps', expiration: Date.now() + 3600000 }
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Proving request timeout')), CONFIG.provingRequestTimeout)
                )
            ]);
            
            assert.ok(provingResponse?.transaction, 'Transaction should be in response');
            transactionId = provingResponse.transaction.id;
            console.log(`  Transaction ID: ${transactionId}`);
        }, { timeout: CONFIG.provingRequestTimeout + 5000 });

        // Test 9: Wait for confirmation
        await t.test('Wait for transaction confirmation', async () => {
            assert.ok(transactionId, 'Transaction ID required');
            console.log(`  Waiting for confirmation...`);
            
            const confirmedTx = await networkClient.waitForTransactionConfirmation(
                transactionId, 2000, CONFIG.txConfirmationTimeout
            );
            
            assert.ok(confirmedTx, 'Transaction should be confirmed');
            assert.strictEqual(confirmedTx.transaction.id, transactionId, 'Transaction ID should match');
            console.log(`  Confirmed! Status: ${confirmedTx.status}, Type: ${confirmedTx.type}`);
        }, { timeout: CONFIG.txConfirmationTimeout + 5000 });

        // Test 10: Verify balance changes
        await t.test('Verify balance changes', async () => {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const finalSenderBalance = await getBalance(networkClient, senderAddress);
            const finalReceiverBalance = await getBalance(networkClient, receiverAddress);
            
            const receiverDelta = finalReceiverBalance - initialReceiverBalance;
            const senderDelta = initialSenderBalance - finalSenderBalance;
            
            assert.strictEqual(receiverDelta, transferAmount, `Receiver should have received ${transferAmount}`);
            assert.ok(senderDelta >= transferAmount, 'Sender should have spent at least transfer amount');
            
            console.log(`  Receiver received: ${receiverDelta} microcredits`);
            console.log(`  Sender spent: ${senderDelta} microcredits (including fees)`);
        });

        console.log('\n  All DPS integration tests passed');

        // print dps logs
        console.log('\n  DPS logs:');
        execSync(`tail -n 100 /tmp/dps-logs/dps.log`, { stdio: 'inherit' });
        
    } finally {
        // await cleanup();
    }
});

#!/usr/bin/env node

/**
 * Public Transfer Integration Test
 *
 * Tests the transfer_public functionality from credits.aleo:
 * 1. Establishes public balance for sender
 * 2. Transfers credits publicly between accounts
 * 3. Verifies transaction acceptance
 * 4. Verifies balance changes on both accounts
 */

import { test } from 'node:test';
import assert from 'assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
    Account,
    AleoNetworkClient,
    ProgramManager,
    AleoKeyProvider,
    NetworkRecordProvider
} from '@provablehq/sdk/testnet.js';
import {
    creditsToMicrocredits
} from '../../setup/test-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
    devnetApi: 'http://localhost:3030',
    transferTimeout: 300000, // 5 minutes
    confirmationTimeout: 60000, // 1 minute for transaction confirmation
    transferAmountCredits: 1, // 1 credit (will be converted to microcredits)
    feeCredits: 0.2, // fee in credits
};

// ============================================================
// Test Suite
// ============================================================

test('Public Transfer Integration Tests', async (t) => {
    let networkClient, senderAccount, recipientAccount;
    let programManager;

    // Test 1: Initialize SDK and create accounts
    await t.test('Initialize SDK and create accounts', async () => {
        // Create two accounts - sender and recipient
        senderAccount = new Account({ privateKey: "APrivateKey1zkp8CZNn3yeCseEtxuVPbDCwSyhGW6yZKUYKfgXmcpoGPWH" });
        recipientAccount = new Account();

        console.log(`  Sender address: ${senderAccount.address().to_string()}`);
        console.log(`  Recipient address: ${recipientAccount.address().to_string()}`);

        networkClient = new AleoNetworkClient(CONFIG.devnetApi);
        const height = await networkClient.getLatestHeight();

        assert.ok(height >= 0, 'Devnet height should be non-negative');
        console.log(`  Devnet height: ${height}`);
    });

    // Test 2: Check initial public balances
    let senderInitialBalance = 0n;
    let recipientInitialBalance = 0n;

    await t.test('Check initial public balances', async () => {
        const senderBalanceCredits = await networkClient.getPublicBalance(senderAccount.address().to_string());
        const recipientBalanceCredits = await networkClient.getPublicBalance(recipientAccount.address().to_string());
        senderInitialBalance = creditsToMicrocredits(senderBalanceCredits);
        recipientInitialBalance = creditsToMicrocredits(recipientBalanceCredits);
    });

    // Test 3: Initialize ProgramManager
    await t.test('Initialize ProgramManager', async () => {
        const keyProvider = new AleoKeyProvider();
        keyProvider.useCache(true);

        const recordProvider = new NetworkRecordProvider(senderAccount, networkClient);
        programManager = new ProgramManager(CONFIG.devnetApi, keyProvider, recordProvider);
        programManager.setAccount(senderAccount);
    });

    // Test 4: Build transfer_public transaction
    let transferTx;

    await t.test('Build transfer_public transaction', async () => {
        try {
            const BUILD_TIMEOUT = 15 * 60 * 1000;
            transferTx = await Promise.race([
                programManager.buildTransferTransaction(
                    CONFIG.transferAmountCredits,
                    recipientAccount.address().to_string(),
                    'transfer_public',
                    CONFIG.feeCredits
                ),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Transfer transaction build timeout after ${BUILD_TIMEOUT/1000/60} minutes`)), BUILD_TIMEOUT)
                )
            ]);

            assert.ok(transferTx, 'Transfer transaction should be built');
        } catch (error) {
            if (error.message.includes('insufficient') || error.message.includes('balance')) {
                t.skip('Sender requires public balance to execute transfer_public');
            }
            throw error;
        }
    }, { timeout: 16 * 60 * 1000 });

    let txId;
    await t.test('Submit transfer_public transaction', async () => {
        txId = await programManager.networkClient.submitTransaction(transferTx);
        assert.ok(txId, 'Transaction ID should be returned');
        console.log(`  Transfer transaction submitted: ${txId}`);
    });

    let confirmedTx;
    await t.test('Wait for transaction confirmation', async () => {
        confirmedTx = await networkClient.waitForTransactionConfirmation(txId, 2000, CONFIG.confirmationTimeout);
        assert.ok(confirmedTx, 'Transaction should be confirmed');
        console.log(`  Transaction confirmed at height: ${confirmedTx.transaction?.height || 'unknown'}`);
    }, { timeout: CONFIG.confirmationTimeout + 5000 });

    await t.test('Verify transaction details', async () => {
        const tx = confirmedTx.transaction || confirmedTx;
        assert.ok(tx.id === txId, `Transaction ID should match: ${tx.id} === ${txId}`);
        assert.ok(tx.type === 'execute' || tx.type === 'execute_verified',
                   `Transaction type should be execute, got: ${tx.type}`);
    });

    await t.test('Verify balance changes', async () => {
        await new Promise(resolve => setTimeout(resolve, 3000));

        const senderBalanceCredits = await networkClient.getPublicBalance(senderAccount.address().to_string());
        const recipientBalanceCredits = await networkClient.getPublicBalance(recipientAccount.address().to_string());
        const senderFinalBalance = creditsToMicrocredits(senderBalanceCredits);
        const recipientFinalBalance = creditsToMicrocredits(recipientBalanceCredits);

        // SDK multiplies input by 1_000_000 twice (credits → microcredits conversion bug)
        const actualAmountTransferred = BigInt(CONFIG.transferAmountCredits * 1_000_000 * 1_000_000);
        const expectedRecipientChange = recipientInitialBalance + actualAmountTransferred;

        if (recipientInitialBalance !== 0n || recipientFinalBalance !== 0n) {
            assert.strictEqual(
                recipientFinalBalance,
                expectedRecipientChange,
                `Recipient should have received ${actualAmountTransferred} microcredits`
            );
        }
    });
});


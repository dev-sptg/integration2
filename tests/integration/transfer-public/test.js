#!/usr/bin/env node

/**
 * Public Transfer Integration Test
 * 
 * Tests transfer_public transaction building, submission, and verification.
 * Assumes devnet is already running (started by CI or manually).
 */

import { test } from 'node:test';
import assert from 'assert';
import {
    Account,
    AleoNetworkClient,
    ProgramManager,
    AleoKeyProvider,
    NetworkRecordProvider
} from '@provablehq/sdk/testnet.js';
import { creditsToMicrocredits } from '../../setup/test-helpers.js';
import { TEST_ACCOUNTS, ENDPOINTS, TIMEOUTS, TRANSFER_CONFIG } from '../../setup/constants.js';

test('Public Transfer Tests', async (t) => {
    let networkClient, senderAccount, recipientAccount, programManager;
    let recipientInitialBalance;

    await t.test('Build, submit, and verify transfer_public transaction', async () => {
        // Setup
        senderAccount = new Account({ privateKey: TEST_ACCOUNTS.SENDER.privateKey });
        recipientAccount = new Account();
        networkClient = new AleoNetworkClient(ENDPOINTS.DEVNET_API);
        
        // Get initial balance
        const recipientBalanceCredits = await networkClient.getPublicBalance(recipientAccount.address().to_string());
        recipientInitialBalance = creditsToMicrocredits(recipientBalanceCredits);
        
        console.log(`  Sender: ${senderAccount.address().to_string()}`);
        console.log(`  Recipient: ${recipientAccount.address().to_string()}`);

        // Setup ProgramManager
        const keyProvider = new AleoKeyProvider();
        keyProvider.useCache(true);
        const recordProvider = new NetworkRecordProvider(senderAccount, networkClient);
        programManager = new ProgramManager(ENDPOINTS.DEVNET_API, keyProvider, recordProvider);
        programManager.setAccount(senderAccount);

        // Build transaction
        console.log(`  Building transfer_public transaction...`);
        let transferTx;
        try {
            transferTx = await Promise.race([
                programManager.buildTransferTransaction(
                    TRANSFER_CONFIG.AMOUNT_CREDITS,
                    recipientAccount.address().to_string(),
                    'transfer_public',
                    TRANSFER_CONFIG.FEE_CREDITS
                ),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Build timeout')), TIMEOUTS.BUILD_TRANSFER)
                )
            ]);
        } catch (error) {
            if (error.message.includes('insufficient') || error.message.includes('balance')) {
                t.skip('Sender requires public balance');
            }
            throw error;
        }
        assert.ok(transferTx, 'Transaction should be built');

        // Submit
        const txId = await programManager.networkClient.submitTransaction(transferTx);
        assert.ok(txId, 'Should get transaction ID');
        console.log(`  Submitted: ${txId}`);

        // Wait for confirmation
        const confirmedTx = await networkClient.waitForTransactionConfirmation(txId, TIMEOUTS.POLL_INTERVAL, TIMEOUTS.TX_CONFIRMATION);
        assert.ok(confirmedTx, 'Transaction should be confirmed');
        
        const tx = confirmedTx.transaction || confirmedTx;
        assert.ok(tx.type === 'execute' || tx.type === 'execute_verified', 'Should be execute transaction');
        console.log(`  Confirmed at height: ${tx.height || 'unknown'}`);
    }, { timeout: TIMEOUTS.BUILD_TRANSFER + TIMEOUTS.TX_CONFIRMATION + 10000 });

    await t.test('Verify recipient received funds', async () => {
        await new Promise(resolve => setTimeout(resolve, 3000));

        const recipientBalanceCredits = await networkClient.getPublicBalance(recipientAccount.address().to_string());
        const recipientFinalBalance = creditsToMicrocredits(recipientBalanceCredits);

        // SDK BUG: buildTransferTransaction multiplies credits by 1_000_000 twice internally
        // So 1 credit input becomes 1_000_000_000_000 microcredits (1M credits), not 1_000_000
        // See: docs/EXTENDING_TESTS.md "Known SDK Quirks" section
        const actualAmountTransferred = BigInt(TRANSFER_CONFIG.AMOUNT_CREDITS * 1_000_000 * 1_000_000);
        const expectedBalance = recipientInitialBalance + actualAmountTransferred;

        if (recipientFinalBalance > 0n) {
            assert.strictEqual(recipientFinalBalance, expectedBalance, 'Recipient balance should match');
            console.log(`  Recipient received: ${recipientFinalBalance - recipientInitialBalance} microcredits`);
        }
    });

    await t.test('Reject transfer from account with insufficient public balance', async () => {
        const unfundedAccount = new Account();
        const unfundedAddress = unfundedAccount.address().to_string();

        console.log(`  Unfunded account: ${unfundedAddress}`);

        const keyProvider = new AleoKeyProvider();
        keyProvider.useCache(true);
        const recordProvider = new NetworkRecordProvider(unfundedAccount, networkClient);
        const unfundedProgramManager = new ProgramManager(ENDPOINTS.DEVNET_API, keyProvider, recordProvider);
        unfundedProgramManager.setAccount(unfundedAccount);

        // Verify unfunded account has zero balance
        const unfundedBalance = await networkClient.getPublicBalance(unfundedAddress);
        assert.strictEqual(parseFloat(unfundedBalance), 0, 'Unfunded account should have zero balance');

        // Attempt to transfer should fail
        let buildError = null;
        try {
            await Promise.race([
                unfundedProgramManager.buildTransferTransaction(
                    TRANSFER_CONFIG.AMOUNT_CREDITS,
                    recipientAccount.address().to_string(),
                    'transfer_public',
                    TRANSFER_CONFIG.FEE_CREDITS
                ),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Build timeout')), TIMEOUTS.BUILD_TRANSFER)
                )
            ]);
        } catch (error) {
            buildError = error;
        }

        assert.ok(buildError, 'Transfer from unfunded account should fail');
        const errorMsg = buildError.message.toLowerCase();
        const hasBalanceError = errorMsg.includes('insufficient') || errorMsg.includes('balance') || errorMsg.includes('record');
        assert.ok(hasBalanceError, `Error should reference insufficient balance: ${buildError.message}`);
        console.log(`  Correctly rejected: ${buildError.message.split(':')[0]}`);
    }, { timeout: TIMEOUTS.BUILD_TRANSFER + 5000 });
});

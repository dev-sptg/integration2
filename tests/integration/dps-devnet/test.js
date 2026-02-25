#!/usr/bin/env node

/**
 * DPS (Delegated Proving Service) Integration Test
 * 
 * Tests delegated proving via transfer_public transaction.
 * Assumes devnet and DPS are already running (started by CI or manually).
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { 
    Account, 
    AleoNetworkClient, 
    ProgramManager, 
    AleoKeyProvider, 
    NetworkRecordProvider,
    getOrInitConsensusVersionTestHeights
} from '@provablehq/sdk/testnet.js';
import { TEST_ACCOUNTS, ENDPOINTS, TIMEOUTS } from '../../setup/constants.js';

// Initialize consensus heights for devnet
getOrInitConsensusVersionTestHeights("0,1,2,3,4,5,6,7,8,9,10,11");

const getBalance = async (networkClient, address) => {
    try {
        const mapping = await networkClient.getProgramMappingValue('credits.aleo', 'account', address);
        return mapping ? BigInt(mapping.replace('u64', '')) : BigInt(0);
    } catch { return BigInt(0); }
};

test('DPS Delegated Proving Tests', async (t) => {
    let networkClient, account, receiverAccount;
    let senderAddress, receiverAddress;
    let initialSenderBalance, initialReceiverBalance;
    let transactionId;
    const transferAmount = BigInt(1000000); // 1 credit

    await t.test('Execute delegated transfer_public via DPS', async () => {
        // Setup accounts
        account = new Account({ privateKey: TEST_ACCOUNTS.SENDER.privateKey });
        receiverAccount = new Account({ privateKey: TEST_ACCOUNTS.RECEIVER.privateKey });
        senderAddress = account.address().to_string();
        receiverAddress = receiverAccount.address().to_string();
        
        networkClient = new AleoNetworkClient(ENDPOINTS.DEVNET_API);
        
        // Record initial balances
        initialSenderBalance = await getBalance(networkClient, senderAddress);
        initialReceiverBalance = await getBalance(networkClient, receiverAddress);
        console.log(`  Sender balance: ${initialSenderBalance}, Receiver balance: ${initialReceiverBalance}`);
        assert.ok(initialSenderBalance > BigInt(0), 'Sender should have balance');

        // Build and submit proving request
        const keyProvider = new AleoKeyProvider();
        keyProvider.useCache(true);
        const recordProvider = new NetworkRecordProvider(account, networkClient);
        const programManager = new ProgramManager(ENDPOINTS.DEVNET_API, keyProvider, recordProvider);
        programManager.setAccount(account);

        console.log(`  Submitting delegated proving request to DPS...`);
        
        const provingRequest = await programManager.provingRequest({
            programName: "credits.aleo",
            functionName: "transfer_public",
            baseFee: 100000,
            priorityFee: 0,
            privateFee: false,
            inputs: [receiverAddress, `${transferAmount}u64`],
            broadcast: true,
        });
        
        const provingResponse = await Promise.race([
            programManager.networkClient.submitProvingRequest({
                provingRequest,
                url: ENDPOINTS.DPS_API,
                jwtData: { jwt: 'fake-jwt-for-local-dps', expiration: Date.now() + 3600000 }
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Proving request timeout')), TIMEOUTS.PROVING_REQUEST)
            )
        ]);
        
        assert.ok(provingResponse?.transaction, 'Should receive transaction from DPS');
        transactionId = provingResponse.transaction.id;
        console.log(`  Transaction ID: ${transactionId}`);
    }, { timeout: TIMEOUTS.PROVING_REQUEST + 5000 });

    await t.test('Wait for transaction confirmation', async () => {
        assert.ok(transactionId, 'Transaction ID required');
        console.log(`  Waiting for confirmation...`);
        
        const confirmedTx = await networkClient.waitForTransactionConfirmation(
            transactionId, TIMEOUTS.POLL_INTERVAL, TIMEOUTS.TX_CONFIRMATION
        );
        
        assert.ok(confirmedTx, 'Transaction should be confirmed');
        console.log(`  Confirmed! Status: ${confirmedTx.status}, Type: ${confirmedTx.type}`);
    }, { timeout: TIMEOUTS.TX_CONFIRMATION + 5000 });

    await t.test('Verify balance changes after transfer', async () => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Brief wait for state sync
        
        const finalSenderBalance = await getBalance(networkClient, senderAddress);
        const finalReceiverBalance = await getBalance(networkClient, receiverAddress);
        
        const receiverDelta = finalReceiverBalance - initialReceiverBalance;
        const senderDelta = initialSenderBalance - finalSenderBalance;
        
        assert.strictEqual(receiverDelta, transferAmount, 'Receiver should have received transfer');
        assert.ok(senderDelta >= transferAmount, 'Sender should have spent at least transfer amount');
        
        console.log(`  Receiver +${receiverDelta}, Sender -${senderDelta} (includes fees)`);
    });
});

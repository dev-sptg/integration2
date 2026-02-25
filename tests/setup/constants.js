/**
 * Test constants - pre-funded devnet accounts and configuration
 */

// Pre-funded accounts in devnet genesis
export const TEST_ACCOUNTS = {
    // Primary sender account (has funds in genesis)
    SENDER: {
        privateKey: "APrivateKey1zkp8CZNn3yeCseEtxuVPbDCwSyhGW6yZKUYKfgXmcpoGPWH"
    },
    // Secondary receiver account
    RECEIVER: {
        privateKey: "APrivateKey1zkp2RWGDcde3efb89rjhME1VYA8QMxcxep5DShNBR6n8Yjh"
    }
};

// Default service endpoints
export const ENDPOINTS = {
    DEVNET_API: 'http://localhost:3030',
    DPS_API: 'http://localhost:3000/prove',
    DPS_HEALTH: 'http://localhost:3000/health'
};

// Default timeouts (in milliseconds)
export const TIMEOUTS = {
    DEPLOYMENT: 300000,      // 5 minutes for deployment tx build
    PROVING_REQUEST: 300000, // 5 minutes for DPS proving
    TX_CONFIRMATION: 120000, // 2 minutes for tx confirmation
    BUILD_TRANSFER: 900000,  // 15 minutes for transfer tx build
    POLL_INTERVAL: 2000,     // 2 seconds between confirmation polls
};

// Test transfer configuration
export const TRANSFER_CONFIG = {
    AMOUNT_CREDITS: 1,
    FEE_CREDITS: 0.2,
};

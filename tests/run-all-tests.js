#!/usr/bin/env node

/**
 * Master test runner for integration tests
 * Collects results from all test suites and generates reports
 */

import { TestReport, runTest, saveReport, generateGitHubSummary } from './setup/test-helpers.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INTEGRATION_ROOT = process.env.INTEGRATION_ROOT || join(__dirname, '..');
const TESTS_DIR = join(__dirname, 'integration');
const REPORT_DIR = join(INTEGRATION_ROOT, 'test-results');

const testSuites = ['sdk-devnet'];
const suiteTimeouts = {
    'sdk-devnet': 60 * 60 * 1000 // 60 minutes
};

const report = new TestReport();

async function runAllTests() {
    console.log('Test Suites:', testSuites.join(', '), '\n');

    // Ensure report directory exists
    if (!existsSync(REPORT_DIR)) {
        mkdirSync(REPORT_DIR, { recursive: true });
    }

    for (const suite of testSuites) {
        const suiteDir = join(TESTS_DIR, suite);
        const testScript = join(suiteDir, 'test.js');

        // Check if test script exists
        if (!existsSync(testScript)) {
            console.log(`Test script not found: ${testScript}`);
            report.addTest({
                name: suite,
                status: 'skipped',
                duration: '0s',
                error: 'Test script not found'
            });
            continue;
        }

        // Install dependencies if needed
        const nodeModulesPath = join(suiteDir, 'node_modules');
        if (!existsSync(nodeModulesPath)) {
            console.log(`Installing dependencies for ${suite}...`);
            try {
                execSync('yarn install', {
                    cwd: suiteDir,
                    stdio: 'inherit',
                    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' }
                });
            } catch (error) {
                console.error(`Failed to install dependencies for ${suite}`);
                report.addTest({
                    name: suite,
                    status: 'failed',
                    duration: '0s',
                    error: 'Failed to install dependencies'
                });
                continue;
            }
        }

        // Run the test
        const timeoutMs = suiteTimeouts[suite] ?? undefined;
        const result = await runTest(suite, testScript, suiteDir, timeoutMs);
        report.addTest(result);
    }

    // Generate reports
    const jsonPath = join(REPORT_DIR, 'test-report.json');
    saveReport(report, jsonPath);

    // Generate GitHub summary
    const summaryPath = join(REPORT_DIR, 'github-summary.md');
    const summary = generateGitHubSummary(report);
    writeFileSync(summaryPath, summary, 'utf8');
    console.log(`GitHub summary saved to: ${summaryPath}`);

    // Print summary
    report.printSummary();

    // Always exit with 0 (non-blocking)
    process.exit(0);
}

runAllTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(0); // Still exit 0 to not fail pipeline
});

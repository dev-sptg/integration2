#!/usr/bin/env node

/**
 * Test helpers for integration tests
 * Provides test runner, report generation, and verification utilities
 */

import { readFileSync, writeFileSync, existsSync, createWriteStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get CPU times snapshot for delta calculation
 */
function getCpuSnapshot() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
        for (const type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    });
    
    return { idle: totalIdle, total: totalTick };
}

/**
 * Get system resource stats with CPU delta
 */
function getSystemStats(previousCpuSnapshot = null) {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);
    
    // Get current CPU snapshot
    const currentSnapshot = getCpuSnapshot();
    
    // Calculate CPU usage from delta if we have a previous snapshot
    let cpuUsage = 0;
    if (previousCpuSnapshot) {
        const idleDelta = currentSnapshot.idle - previousCpuSnapshot.idle;
        const totalDelta = currentSnapshot.total - previousCpuSnapshot.total;
        cpuUsage = totalDelta > 0 ? Math.round(100 - (100 * idleDelta / totalDelta)) : 0;
    }
    
    return {
        cpuUsage: cpuUsage,
        cpuSnapshot: currentSnapshot,
        memUsagePercent: memUsagePercent,
        memUsedGB: (usedMem / 1024 / 1024 / 1024).toFixed(2),
        memTotalGB: (totalMem / 1024 / 1024 / 1024).toFixed(2),
        cpuCores: cpus.length
    };
}

/**
 * Test result structure
 */
export class TestResult {
    constructor(name, status, duration, error = null, subtests = []) {
        this.name = name;
        this.status = status; // 'passed', 'failed', 'skipped'
        this.duration = duration;
        this.error = error;
        this.subtests = subtests; // Array of {name, status, duration}
        this.timestamp = new Date().toISOString();
    }

    toJSON() {
        return {
            name: this.name,
            status: this.status,
            duration: this.duration,
            error: this.error,
            subtests: this.subtests,
            timestamp: this.timestamp
        };
    }
}

/**
 * Parse TAP output to extract subtest results
 * @param {string} output - TAP format output
 * @returns {Array} - Array of {name, status, duration}
 */
function parseTapOutput(output) {
    const subtests = [];
    const lines = output.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Match subtest results: "ok 1 - Test name" or "not ok 1 - Test name"
        const match = line.match(/^(ok|not ok)\s+\d+\s+-\s+(.+)$/);
        if (match) {
            const status = match[1] === 'ok' ? 'passed' : 'failed';
            const name = match[2];
            
            // Look for duration in the following lines (TAP YAML block)
            let duration = null;
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                const durationMatch = lines[j].match(/duration_ms:\s*([\d.]+)/);
                if (durationMatch) {
                    const ms = parseFloat(durationMatch[1]);
                    duration = ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms.toFixed(0)}ms`;
                    break;
                }
                // Stop if we hit another test result
                if (lines[j].trim().match(/^(ok|not ok)\s+\d+/)) break;
            }
            
            subtests.push({ name, status, duration });
        }
    }
    
    return subtests;
}

/**
 * Test report structure
 */
export class TestReport {
    constructor() {
        this.summary = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0
        };
        this.tests = [];
        this.startTime = Date.now();
    }

    addTest(result) {
        this.tests.push(result);
        this.summary.total++;
        if (result.status === 'passed') {
            this.summary.passed++;
        } else if (result.status === 'failed') {
            this.summary.failed++;
        } else {
            this.summary.skipped++;
        }
    }

    getDuration() {
        return ((Date.now() - this.startTime) / 1000).toFixed(2) + 's';
    }

    toJSON() {
        return {
            summary: this.summary,
            duration: this.getDuration(),
            tests: this.tests,
            timestamp: new Date().toISOString()
        };
    }

    printSummary() {
        const duration = this.getDuration();
        console.log('\n' + '='.repeat(60));
        console.log('TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total:   ${this.summary.total}`);
        console.log(`Passed:  ${this.summary.passed}`);
        console.log(`Failed:  ${this.summary.failed}`);
        console.log(`Skipped: ${this.summary.skipped}`);
        console.log(`Duration: ${duration}`);
        console.log('='.repeat(60));

        if (this.summary.failed > 0) {
            console.log('\nFailed tests:');
            this.tests
                .filter(t => t.status === 'failed')
                .forEach(t => {
                    console.log(`  ❌ ${t.name}`);
                    if (t.error) {
                        console.log(`     ${t.error}`);
                    }
                });
        }
    }
}

/**
 * Run a test script and return result
 * @param {string} testName - Name of the test suite
 * @param {string} testScript - Path to test script
 * @param {string} cwd - Working directory
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30 minutes)
 */
export async function runTest(testName, testScript, cwd, timeoutMs = 1800000) {
    const startTime = Date.now();
    const initialStats = getSystemStats();
    console.log(`\n🧪 Running test: ${testName}`);
    console.log(`⏱️  Timeout: ${(timeoutMs / 1000 / 60).toFixed(1)} minutes`);

    // Track CPU snapshot for delta calculations
    let lastCpuSnapshot = initialStats.cpuSnapshot;

    // Set up trace file capture
    const INTEGRATION_ROOT = process.env.INTEGRATION_ROOT || join(__dirname, '../..');
    const traceDir = join(INTEGRATION_ROOT, 'test-results', 'traces');
    const traceFile = join(traceDir, `${testName}.log`);

    // Ensure trace directory exists
    if (!existsSync(traceDir)) {
        mkdirSync(traceDir, { recursive: true });
    }

    // Create write stream for trace file (flush immediately for real-time logging)
    const traceStream = createWriteStream(traceFile, { flags: 'w', flush: true });
    traceStream.write(`=== Test Trace: ${testName} ===\n`);
    traceStream.write(`Started: ${new Date().toISOString()}\n`);
    traceStream.write(`Timeout: ${(timeoutMs / 1000 / 60).toFixed(1)} minutes\n`);
    traceStream.write(`System: ${initialStats.cpuCores} cores, ${initialStats.memTotalGB} GB RAM\n`);
    traceStream.write(`${'='.repeat(60)}\n\n`);

    // Buffer output for clean printing after test completes
    const stdoutBuffer = [];
    const stderrBuffer = [];

    return new Promise((resolve) => {
        const child = spawn('node', ['--unhandled-rejections=strict', '--test-force-exit', testScript], {
            cwd: cwd,
            stdio: ['inherit', 'pipe', 'pipe'], // stdin: inherit, stdout/stderr: pipe
            shell: false,
            env: {
                ...process.env,
                NODE_NO_WARNINGS: '1',
                NODE_ENV: 'test',
                FORCE_COLOR: '0'
            }
        });

        // Buffer stdout for trace file and delayed printing
        child.stdout.on('data', (data) => {
            traceStream.write(data);
            stdoutBuffer.push(data);
        });

        // Buffer stderr for trace file and delayed printing
        child.stderr.on('data', (data) => {
            traceStream.write(data);
            stderrBuffer.push(data);
        });

        let resolved = false;

        // Helper to print buffered output
        const printBufferedOutput = () => {
            if (stdoutBuffer.length > 0 || stderrBuffer.length > 0) {
                console.log(`\n${'='.repeat(60)}`);
                console.log(`📋 Full output for ${testName}:`);
                console.log(`${'='.repeat(60)}`);
                if (stdoutBuffer.length > 0) {
                    process.stdout.write(Buffer.concat(stdoutBuffer));
                }
                if (stderrBuffer.length > 0) {
                    process.stderr.write(Buffer.concat(stderrBuffer));
                }
                console.log(`${'='.repeat(60)}`);
            }
            console.log(`📁 Trace file: ${traceFile}`);
        };

        // Set up timeout
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
                const finalStats = getSystemStats(lastCpuSnapshot);

                console.log(`\n❌ ${testName} TIMEOUT`);
                console.log(`   Duration: ${duration} | Timeout: ${(timeoutMs / 1000 / 60).toFixed(1)} minutes`);
                console.log(`   System: CPU ${finalStats.cpuUsage}%, Memory ${finalStats.memUsagePercent}%`);
                printBufferedOutput();

                child.kill('SIGTERM');

                setTimeout(() => {
                    if (!child.killed) {
                        child.kill('SIGKILL');
                    }
                }, 5000);

                const errorMsg = `Timed out after ${(timeoutMs / 1000 / 60).toFixed(1)} minutes`;

                traceStream.end();

                resolve(new TestResult(testName, 'failed', duration, errorMsg));
            }
        }, timeoutMs);

        child.on('error', (error) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

                console.log(`\n❌ ${testName} ERROR: ${error.message}`);
                printBufferedOutput();

                traceStream.end();

                resolve(new TestResult(testName, 'failed', duration, `Process error: ${error.message}`));
            }
        });

        child.on('exit', async (code, signal) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

                // Close trace stream with 5 minute timeout to prevent hanging
                await new Promise(resolveStream => {
                    const streamTimeout = setTimeout(resolveStream, 5 * 60 * 1000);
                    traceStream.end(() => {
                        clearTimeout(streamTimeout);
                        resolveStream();
                    });
                });

                // Parse TAP output for subtest details
                const output = Buffer.concat(stdoutBuffer).toString();
                const subtests = parseTapOutput(output);

                if (code === 0) {
                    console.log(`✅ ${testName} passed (${duration})`);
                    // Print last 10 lines of output (contains TAP summary)
                    const lines = output.split('\n').filter(l => l.trim());
                    const lastLines = lines.slice(-10);
                    if (lastLines.length > 0) {
                        console.log(lastLines.map(l => '   ' + l).join('\n'));
                    }
                    console.log(`   📁 Trace: ${traceFile}`);
                    resolve(new TestResult(testName, 'passed', duration, null, subtests));
                } else {
                    let errorMsg = signal ? `Killed by signal: ${signal}` : `Exit code: ${code}`;
                    console.log(`❌ ${testName} failed (${duration}) - ${errorMsg}`);
                    printBufferedOutput();
                    resolve(new TestResult(testName, 'failed', duration, errorMsg, subtests));
                }
            }
        });
    });
}

/**
 * Verify that SDK is installed from local package
 */
export function verifyLocalSDK(testDir) {
    const sdkPackagePath = join(testDir, 'node_modules', '@provablehq', 'sdk', 'package.json');
    
    if (!existsSync(sdkPackagePath)) {
        throw new Error('SDK package not found in node_modules');
    }

    const sdkPackage = JSON.parse(readFileSync(sdkPackagePath, 'utf8'));
    
    // Check version contains local marker
    if (!sdkPackage.version.includes('-local-')) {
        throw new Error(
            `SDK version does not contain local marker. Got: ${sdkPackage.version}. ` +
            `Expected version to include '-local-'`
        );
    }

    // Check package-lock.json or yarn.lock for file: protocol
    const lockFiles = [
        join(testDir, 'package-lock.json'),
        join(testDir, 'yarn.lock')
    ];

    let foundFileProtocol = false;
    for (const lockFile of lockFiles) {
        if (existsSync(lockFile)) {
            const lockContent = readFileSync(lockFile, 'utf8');
            // Check for file: protocol in lock file
            if (lockContent.includes('file:') && lockContent.includes('@provablehq/sdk')) {
                foundFileProtocol = true;
                break;
            }
        }
    }

    if (!foundFileProtocol) {
        console.warn('⚠️  Warning: Could not verify file: protocol in lock file');
    }

    console.log(`✅ Verified local SDK installation: ${sdkPackage.version}`);
    return sdkPackage;
}

/**
 * Verify snarkOS binary is available
 */
export function verifySnarkOSBinary(snarkosPath) {
    if (!snarkosPath || !existsSync(snarkosPath)) {
        throw new Error(`snarkOS binary not found at: ${snarkosPath}`);
    }

    // Try to get version
    try {
        const version = execSync(`"${snarkosPath}" --version`, { encoding: 'utf8' });
        console.log(`✅ Verified snarkOS binary: ${version.trim()}`);
        return version.trim();
    } catch (error) {
        console.warn('⚠️  Warning: Could not get snarkOS version');
        return null;
    }
}

/**
 * Find binary in multiple possible locations
 * @param {string[]} possiblePaths - Array of paths to check
 * @param {string} envVar - Environment variable name to check first
 * @returns {string|null} - Path to binary or null if not found
 */
export function findBinary(possiblePaths, envVar = null) {
    // Check env var first
    if (envVar && process.env[envVar] && existsSync(process.env[envVar])) {
        return process.env[envVar];
    }
    
    // Check each path
    for (const p of possiblePaths) {
        if (p && existsSync(p)) {
            return p;
        }
    }
    
    return null;
}

/**
 * Wait for a service to be ready by polling an endpoint
 * @param {Object} options - Configuration options
 * @param {string} options.url - URL to poll
 * @param {string} options.name - Service name for logging
 * @param {number} options.timeout - Timeout in milliseconds (default: 30000)
 * @param {number} options.interval - Poll interval in milliseconds (default: 1000)
 * @param {function} options.validate - Optional validation function (response) => boolean
 * @returns {Promise<boolean>}
 */
export async function waitForService({ url, name, timeout = 30000, interval = 1000, validate = null }) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        try {
            const response = await fetch(url);
            const isValid = validate ? validate(response) : response.ok;
            if (isValid) {
                console.log(`  ${name} is ready`);
                return true;
            }
        } catch (e) {
            // Service not ready yet, continue polling
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`${name} did not become ready within ${timeout}ms`);
}

/**
 * Start a service using a shell script
 * @param {Object} options - Configuration options
 * @param {string} options.script - Path to start script
 * @param {string} options.name - Service name for logging
 * @param {Object} options.env - Additional environment variables
 * @returns {boolean} - Whether service was started (false if already running)
 */
export function startService({ script, name, env = {} }) {
    console.log(`  Starting ${name}...`);
    execSync(script, { 
        stdio: 'inherit',
        env: { ...process.env, ...env }
    });
    return true;
}

/**
 * Stop a service using a shell script
 * @param {string} script - Path to stop script
 * @param {string} name - Service name for logging
 */
export function stopService(script, name) {
    try {
        execSync(script, { stdio: 'inherit' });
    } catch (e) {
        console.warn(`  ${name} cleanup failed: ${e.message}`);
    }
}

/**
 * Check if a service is accessible via HTTP
 * @param {string} url - URL to check
 * @returns {boolean}
 */
export function isServiceAccessible(url) {
    try {
        execSync(`curl -s -f "${url}" > /dev/null 2>&1`);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Save test report to JSON file
 */
export function saveReport(report, outputPath) {
    const json = JSON.stringify(report.toJSON(), null, 2);
    writeFileSync(outputPath, json, 'utf8');
    console.log(`\n📊 Test report saved to: ${outputPath}`);
}

/**
 * Get account balance from credits.aleo mapping (for devnet private accounts)
 * Uses getProgramMappingValue instead of getPublicBalance
 * @param {AleoNetworkClient} networkClient - The network client
 * @param {string} address - The address to check
 * @returns {Promise<bigint>} - The balance in microcredits
 */
export async function getAccountBalance(networkClient, address) {
    try {
        const mapping = await networkClient.getProgramMappingValue('credits.aleo', 'account', address);
        return mapping ? BigInt(mapping.replace('u64', '')) : BigInt(0);
    } catch { return BigInt(0); }
}

/**
 * Convert credits to microcredits (BigInt)
 * @param {number} credits - Amount in credits
 * @returns {bigint} - Amount in microcredits
 */
export function creditsToMicrocredits(credits) {
    return BigInt(Math.floor(credits * 1_000_000));
}

/**
 * Generate GitHub Actions summary
 */
export function generateGitHubSummary(report) {
    const summary = report.summary;
    const duration = report.getDuration();
    
    const statusEmoji = summary.failed > 0 ? '❌' : '✅';
    const statusText = summary.failed > 0 ? 'Some tests failed' : 'All tests passed';
    
    let markdown = `## ${statusEmoji} Integration Test Results\n\n`;
    markdown += `**Status:** ${statusText}\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total | ${summary.total} |\n`;
    markdown += `| Passed | ${summary.passed} |\n`;
    markdown += `| Failed | ${summary.failed} |\n`;
    markdown += `| Skipped | ${summary.skipped} |\n`;
    markdown += `| Duration | ${duration} |\n\n`;

    if (summary.failed > 0) {
        markdown += `### Failed Tests\n\n`;
        report.tests
            .filter(t => t.status === 'failed')
            .forEach(t => {
                markdown += `- ❌ **${t.name}**\n`;
                if (t.error) {
                    markdown += `  - ${t.error}\n`;
                }
            });
    }

    return markdown;
}


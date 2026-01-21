#!/usr/bin/env node

/**
 * Test helpers for integration tests
 * Provides test runner, report generation, and utilities
 */

import { writeFileSync, existsSync, createWriteStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
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
    
    const currentSnapshot = getCpuSnapshot();
    
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
        this.subtests = subtests;
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
 */
function parseTapOutput(output) {
    const subtests = [];
    const lines = output.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const match = line.match(/^(ok|not ok)\s+\d+\s+-\s+(.+)$/);
        if (match) {
            const status = match[1] === 'ok' ? 'passed' : 'failed';
            const name = match[2];
            
            let duration = null;
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                const durationMatch = lines[j].match(/duration_ms:\s*([\d.]+)/);
                if (durationMatch) {
                    const ms = parseFloat(durationMatch[1]);
                    duration = ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms.toFixed(0)}ms`;
                    break;
                }
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
        this.summary = { total: 0, passed: 0, failed: 0, skipped: 0 };
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
 */
export async function runTest(testName, testScript, cwd, timeoutMs = 1800000) {
    const startTime = Date.now();
    const initialStats = getSystemStats();
    console.log(`\n🧪 Running test: ${testName}`);
    console.log(`⏱️  Timeout: ${(timeoutMs / 1000 / 60).toFixed(1)} minutes`);

    let lastCpuSnapshot = initialStats.cpuSnapshot;

    const INTEGRATION_ROOT = process.env.INTEGRATION_ROOT || join(__dirname, '../..');
    const traceDir = join(INTEGRATION_ROOT, 'test-results', 'traces');
    const traceFile = join(traceDir, `${testName}.log`);

    if (!existsSync(traceDir)) {
        mkdirSync(traceDir, { recursive: true });
    }

    const traceStream = createWriteStream(traceFile, { flags: 'w', flush: true });
    traceStream.write(`=== Test Trace: ${testName} ===\n`);
    traceStream.write(`Started: ${new Date().toISOString()}\n`);
    traceStream.write(`Timeout: ${(timeoutMs / 1000 / 60).toFixed(1)} minutes\n`);
    traceStream.write(`System: ${initialStats.cpuCores} cores, ${initialStats.memTotalGB} GB RAM\n`);
    traceStream.write(`${'='.repeat(60)}\n\n`);

    const stdoutBuffer = [];
    const stderrBuffer = [];

    return new Promise((resolve) => {
        const child = spawn('node', ['--unhandled-rejections=strict', '--test-force-exit', testScript], {
            cwd: cwd,
            stdio: ['inherit', 'pipe', 'pipe'],
            shell: false,
            env: {
                ...process.env,
                NODE_NO_WARNINGS: '1',
                NODE_ENV: 'test',
                FORCE_COLOR: '0'
            }
        });

        child.stdout.on('data', (data) => {
            traceStream.write(data);
            stdoutBuffer.push(data);
        });

        child.stderr.on('data', (data) => {
            traceStream.write(data);
            stderrBuffer.push(data);
        });

        let resolved = false;

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
                    if (!child.killed) child.kill('SIGKILL');
                }, 5000);

                traceStream.end();
                resolve(new TestResult(testName, 'failed', duration, `Timed out after ${(timeoutMs / 1000 / 60).toFixed(1)} minutes`));
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

                await new Promise(resolveStream => {
                    const streamTimeout = setTimeout(resolveStream, 5 * 60 * 1000);
                    traceStream.end(() => {
                        clearTimeout(streamTimeout);
                        resolveStream();
                    });
                });

                const output = Buffer.concat(stdoutBuffer).toString();
                const subtests = parseTapOutput(output);

                if (code === 0) {
                    console.log(`✅ ${testName} passed (${duration})`);
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
 * Save test report to JSON file
 */
export function saveReport(report, outputPath) {
    const json = JSON.stringify(report.toJSON(), null, 2);
    writeFileSync(outputPath, json, 'utf8');
    console.log(`\n📊 Test report saved to: ${outputPath}`);
}

/**
 * Convert credits to microcredits (BigInt)
 * Note: SDK has a bug where buildTransferTransaction multiplies by 1_000_000 twice.
 * See docs/EXTENDING_TESTS.md "Known SDK Quirks" section.
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

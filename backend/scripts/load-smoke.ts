import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// The default stays below the single-IP production rate limit (300/minute).
// Use a dedicated multi-IP load environment for larger capacity tests.
const totalRequests = Number(process.env.LOAD_REQUESTS ?? 250);
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 25);
const baseUrl = process.env.LOAD_BASE_URL ?? "http://127.0.0.1:3000";
const endpoints = ["/health/ready", "/api/v1/catalogs", "/api/v1/listings?limit=20"];

if (!Number.isInteger(totalRequests) || totalRequests < 1) throw new Error("LOAD_REQUESTS must be a positive integer");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 500) throw new Error("LOAD_CONCURRENCY must be between 1 and 500");

const latencies: number[] = [];
const statuses = new Map<number, number>();
const errors: string[] = [];
let nextRequest = 0;

async function worker(): Promise<void> {
  while (true) {
    const requestNumber = nextRequest;
    nextRequest += 1;
    if (requestNumber >= totalRequests) return;
    const endpoint = endpoints[requestNumber % endpoints.length] ?? endpoints[0];
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(5_000)
      });
      await response.arrayBuffer();
      latencies.push(performance.now() - started);
      statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
      if (!response.ok) errors.push(`${endpoint}: HTTP ${response.status}`);
    } catch (error) {
      latencies.push(performance.now() - started);
      errors.push(error instanceof Error ? `${endpoint}: ${error.message}` : `${endpoint}: unknown error`);
    }
  }
}

function percentile(sorted: number[], value: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1);
  return Number((sorted[Math.max(0, index)] ?? 0).toFixed(3));
}

const started = performance.now();
await Promise.all(Array.from({ length: Math.min(concurrency, totalRequests) }, () => worker()));
const seconds = (performance.now() - started) / 1_000;
latencies.sort((left, right) => left - right);
const report = {
  completedAt: new Date().toISOString(),
  target: baseUrl,
  requests: totalRequests,
  concurrency,
  durationSeconds: Number(seconds.toFixed(3)),
  requestsPerSecond: Number((totalRequests / seconds).toFixed(2)),
  statusCounts: Object.fromEntries([...statuses.entries()].sort()),
  errors: errors.length,
  errorSamples: errors.slice(0, 10),
  latencyMs: {
    p50: percentile(latencies, 0.5),
    p95: percentile(latencies, 0.95),
    p99: percentile(latencies, 0.99),
    max: Number((latencies.at(-1) ?? 0).toFixed(3))
  },
  thresholds: { zeroErrors: errors.length === 0, p95Under500Ms: percentile(latencies, 0.95) < 500 },
  passed: errors.length === 0 && percentile(latencies, 0.95) < 500
};
const directory = resolve("var", "operations");
await mkdir(directory, { recursive: true });
const file = resolve(directory, `${new Date().toISOString().replace(/[:.]/g, "-")}-load.json`);
await writeFile(file, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (!report.passed) process.exitCode = 1;

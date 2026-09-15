#!/usr/bin/env node

const SENTINEL_API = process.env.SENTINEL_API || 'http://localhost:3000';
const SENTINEL_TOKEN = process.env.SENTINEL_TOKEN || '';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const PURPLE = '\x1b[35m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${SENTINEL_API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(SENTINEL_TOKEN ? { Authorization: `Bearer ${SENTINEL_TOKEN}` } : {}),
    },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`${RED}API error ${res.status}:${RESET} ${text}`);
    process.exit(1);
  }
  return res.json();
}

async function pollRun(runId: string, timeoutMs = 300000): Promise<any> {
  const start = Date.now();
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;

  while (Date.now() - start < timeoutMs) {
    const run = await apiFetch(`/api/runs/${runId}`);
    process.stdout.write(`\r${PURPLE}${spinner[i % spinner.length]}${RESET} Run status: ${statusColor(run.status)} (${Math.round((Date.now() - start) / 1000)}s)`);
    i++;

    if (run.status === 'completed' || run.status === 'failed') {
      process.stdout.write('\n');
      return run;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  process.stdout.write('\n');
  console.error(`${RED}Timeout waiting for run to complete${RESET}`);
  process.exit(1);
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return `${GREEN}${status}${RESET}`;
    case 'running': return `${PURPLE}${status}${RESET}`;
    case 'failed': return `${RED}${status}${RESET}`;
    default: return `${YELLOW}${status}${RESET}`;
  }
}

function sevColor(sev: string): string {
  switch (sev) {
    case 'critical': return `${RED}${BOLD}${sev.toUpperCase()}${RESET}`;
    case 'high': return `${RED}${sev.toUpperCase()}${RESET}`;
    case 'medium': return `${YELLOW}${sev.toUpperCase()}${RESET}`;
    case 'low': return `${GREEN}${sev.toUpperCase()}${RESET}`;
    default: return sev;
  }
}

async function cmdRun(url: string, opts: { maxSteps?: number; failOn?: string }) {
  console.log(`${CYAN}${BOLD}⬡ Sentinel CLI${RESET}`);
  console.log(`${CYAN}Target:${RESET} ${url}`);
  console.log(`${CYAN}Server:${RESET} ${SENTINEL_API}\n`);

  // Trigger run
  const { runId } = await apiFetch('/api/cli/run', {
    method: 'POST',
    body: JSON.stringify({ url, maxSteps: opts.maxSteps }),
  });
  console.log(`${GREEN}✓ Run queued:${RESET} ${runId}\n`);

  // Poll until done
  const run = await pollRun(runId);

  if (run.status === 'failed') {
    console.error(`\n${RED}${BOLD}✗ Run failed${RESET}`);
    process.exit(1);
  }

  // Fetch findings
  const { findings } = await apiFetch(`/api/runs/${runId}/findings`);

  console.log(`\n${BOLD}── Results ──${RESET}`);
  console.log(`Findings: ${findings.length}`);

  if (findings.length === 0) {
    console.log(`\n${GREEN}${BOLD}✓ Clean run — no issues found${RESET}`);
    process.exit(0);
  }

  // Group by severity
  const critical = findings.filter((f: any) => f.severity === 'critical');
  const high = findings.filter((f: any) => f.severity === 'high');
  const medium = findings.filter((f: any) => f.severity === 'medium');
  const low = findings.filter((f: any) => f.severity === 'low');

  console.log(`  ${RED}Critical: ${critical.length}${RESET} | ${RED}High: ${high.length}${RESET} | ${YELLOW}Medium: ${medium.length}${RESET} | ${GREEN}Low: ${low.length}${RESET}\n`);

  // Print findings
  for (const f of findings) {
    console.log(`  ${sevColor(f.severity)} [${f.type}] ${BOLD}${f.title}${RESET}`);
    if (f.description) console.log(`    ${f.description.slice(0, 120)}`);
    console.log(`    ${CYAN}${f.url}${RESET}\n`);
  }

  // Exit code logic
  const failOn = opts.failOn || 'high';
  const failLevels: Record<string, string[]> = {
    critical: ['critical'],
    high: ['critical', 'high'],
    medium: ['critical', 'high', 'medium'],
    any: ['critical', 'high', 'medium', 'low'],
  };
  const failSeverities = failLevels[failOn] || failLevels.high;
  const hasFailing = findings.some((f: any) => failSeverities.includes(f.severity));

  if (hasFailing) {
    console.error(`${RED}${BOLD}✗ Pipeline failed — findings at or above '${failOn}' severity${RESET}`);
    process.exit(1);
  }

  console.log(`${GREEN}${BOLD}✓ Pass — no findings at or above '${failOn}' severity${RESET}`);
  process.exit(0);
}

// --- CLI parser ---
const args = process.argv.slice(2);
const command = args[0];

if (command === 'run') {
  const url = args.find(a => !a.startsWith('-') && a !== 'run');
  if (!url) {
    console.error('Usage: sentinel run <url> [--max-steps N] [--fail-on critical|high|medium|any]');
    process.exit(1);
  }
  const maxStepsIdx = args.indexOf('--max-steps');
  const maxSteps = maxStepsIdx >= 0 ? parseInt(args[maxStepsIdx + 1]) : undefined;
  const failIdx = args.indexOf('--fail-on');
  const failOn = failIdx >= 0 ? args[failIdx + 1] : 'high';

  if (!SENTINEL_TOKEN) {
    console.warn(`${YELLOW}Warning: SENTINEL_TOKEN not set. API calls may be rejected.${RESET}\n`);
  }

  cmdRun(url, { maxSteps, failOn }).catch(err => {
    console.error(`${RED}Fatal:${RESET}`, err.message);
    process.exit(1);
  });
} else if (command === '--help' || command === '-h' || !command) {
  console.log(`${CYAN}${BOLD}⬡ Sentinel CLI${RESET} — Agentic QA by EdgeIQ Labs\n`);
  console.log('Commands:');
  console.log('  run <url>              Trigger an autonomous crawl and report findings');
  console.log('    --max-steps N        Max agent steps (default: 50)');
  console.log('    --fail-on SEVERITY   Exit 1 if findings at this level+ (critical|high|medium|any)');
  console.log('                         Default: high');
  console.log('\nEnvironment:');
  console.log('  SENTINEL_API           API base URL (default: http://localhost:3000)');
  console.log('  SENTINEL_TOKEN         Bearer token for authentication');
  console.log('\nExamples:');
  console.log('  sentinel run https://myapp.com');
  console.log('  sentinel run https://myapp.com --max-steps 100 --fail-on critical');
  console.log('  SENTINEL_API=https://sentinel.example.com SENTINEL_TOKEN=sk_... sentinel run https://myapp.com');
} else {
  console.error(`Unknown command: ${command}. Run 'sentinel --help'.`);
  process.exit(1);
}

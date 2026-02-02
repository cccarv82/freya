#!/usr/bin/env node

'use strict';

const path = require('path');
const { cmdWeb } = require('../cli/web');

const DEFAULT_PORT = 3872;

function usage() {
  return `
FREYA web

Usage:
  freya [--port <n>] [--dir <path>] [--no-open] [--dev]

Options:
  --port <n>    Port to bind (default: ${DEFAULT_PORT})
  --dir <path>  Workspace directory (default: ./freya)
  --no-open     Do not open the browser automatically
  --dev         Seed demo data for a new/empty workspace

Examples:
  freya
  freya --port 4000
  freya --dir ./freya
  freya --no-open
`;
}

function parseArgs(argv) {
  const args = [];
  const flags = new Set();
  const kv = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') {
      flags.add(a);
      continue;
    }
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        kv[a] = next;
        i++;
      } else {
        flags.add(a);
      }
    } else {
      args.push(a);
    }
  }

  return { args, flags, kv };
}

async function run(argv) {
  const { args, flags, kv } = parseArgs(argv);
  const positionals = args.filter((a) => a !== 'web');

  if (flags.has('--help') || flags.has('-h')) {
    process.stdout.write(usage());
    return;
  }

  if (positionals.length > 0) {
    process.stderr.write(`Unknown arguments: ${positionals.join(' ')}\n`);
    process.stdout.write(usage());
    process.exitCode = 1;
    return;
  }

  const portRaw = kv['--port'];
  const port = portRaw ? Number(portRaw) : DEFAULT_PORT;
  if (!Number.isFinite(port) || port <= 0) {
    process.stderr.write('Invalid --port\n');
    process.exitCode = 1;
    return;
  }

  const dir = kv['--dir'] ? path.resolve(process.cwd(), kv['--dir']) : null;
  const open = !flags.has('--no-open');
  const dev = flags.has('--dev');

  await cmdWeb({ port, dir, open, dev });
}

run(process.argv.slice(2)).catch((err) => {
  const msg = err && err.stack ? err.stack : String(err);
  console.error(msg);
  process.exit(1);
});

'use strict';

const fs = require('fs');
const path = require('path');

const { cmdWeb } = require('./web');

function usage() {
  return `
freya - F.R.E.Y.A. Web

Usage:
  freya [--port <n>] [--dir <path>] [--no-open] [--dev]

Defaults:
  - Workspace defaults to ./freya

Examples:
  freya
  freya --dir ./freya --port 3872
  freya --dev            # seeds demo data/logs for quick testing
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
    fs.writeSync(process.stdout.fd, usage());
    return;
  }

  if (positionals.length > 0) {
    process.stderr.write(`Unknown arguments: ${positionals.join(' ')}\n`);
    fs.writeSync(process.stdout.fd, usage());
    process.exitCode = 1;
    return;
  }

  const port = Number(kv['--port'] || 3872);
  const dir = kv['--dir'] ? path.resolve(process.cwd(), kv['--dir']) : null;
  const open = !flags.has('--no-open');
  const dev = flags.has('--dev');

  if (!Number.isFinite(port) || port <= 0) {
    process.stderr.write('Invalid --port\n');
    process.exitCode = 1;
    return;
  }

  await cmdWeb({ port, dir, open, dev });
}

module.exports = { run };

'use strict';

const fs = require('fs');
const path = require('path');

const { cmdInit } = require('./init');
const { cmdWeb } = require('./web');

function usage() {
  return `
freya - F.R.E.Y.A. CLI

Usage:
  freya init [dir] [--force] [--here|--in-place] [--force-data] [--force-logs]
  freya web [--port <n>] [--dir <path>] [--no-open] [--dev]

Defaults:
  - If no [dir] is provided, creates ./freya
  - Preserves existing data/ and logs/ by default

Examples:
  freya init              # creates ./freya
  freya init my-workspace # creates ./my-workspace
  freya init --here       # installs into current directory
  freya init --here --force          # update agents/scripts, keep data/logs
  freya init --here --force-data     # overwrite data/ too (danger)
  npx @cccarv82/freya init

  freya web
  freya web --dir ./freya --port 3872
  freya web --dev            # seeds demo data/logs for quick testing
`;
}

function parseArgs(argv) {
  const args = [];
  const flags = new Set();
  const kv = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
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
  const command = args[0];

  if (!command || command === 'help' || flags.has('--help') || flags.has('-h')) {
    fs.writeSync(process.stdout.fd, usage());
    return;
  }

  if (command === 'init') {
    const inPlace = flags.has('--here') || flags.has('--in-place');
    const defaultDir = path.join(process.cwd(), 'freya');
    const targetDir = args[1]
      ? path.resolve(process.cwd(), args[1])
      : (inPlace ? process.cwd() : defaultDir);

    const force = flags.has('--force');
    const forceData = flags.has('--force-data');
    const forceLogs = flags.has('--force-logs');

    await cmdInit({ targetDir, force, forceData, forceLogs });
    return;
  }

  if (command === 'web') {
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
    return;
  }

  process.stderr.write(`Unknown command: ${command}\n`);
  fs.writeSync(process.stdout.fd, usage());
  process.exitCode = 1;
}

module.exports = { run };

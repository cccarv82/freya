'use strict';

const path = require('path');

const { cmdInit } = require('./init');

function usage() {
  return `
freya - F.R.E.Y.A. CLI

Usage:
  freya init [dir] [--force] [--here|--in-place] [--force-data] [--force-logs]

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
`;
}

function parseArgs(argv) {
  const args = [];
  const flags = new Set();

  for (const a of argv) {
    if (a.startsWith('--')) flags.add(a);
    else args.push(a);
  }

  return { args, flags };
}

async function run(argv) {
  const { args, flags } = parseArgs(argv);
  const command = args[0];

  if (!command || command === 'help' || flags.has('--help') || flags.has('-h')) {
    process.stdout.write(usage());
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

  process.stderr.write(`Unknown command: ${command}\n`);
  process.stdout.write(usage());
  process.exitCode = 1;
}

module.exports = { run };

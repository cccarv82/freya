'use strict';

const path = require('path');

const { cmdInit } = require('./init');

function usage() {
  return `
freya - F.R.E.Y.A. CLI

Usage:
  freya init [dir] [--force]

Examples:
  freya init
  freya init my-workspace
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
    const targetDir = args[1] ? path.resolve(process.cwd(), args[1]) : process.cwd();
    const force = flags.has('--force');
    await cmdInit({ targetDir, force });
    return;
  }

  process.stderr.write(`Unknown command: ${command}\n`);
  process.stdout.write(usage());
  process.exitCode = 1;
}

module.exports = { run };

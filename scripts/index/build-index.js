const path = require('path');
const { buildIndex } = require('../lib/index-utils');

function main() {
  const workspaceDir = process.cwd();
  const result = buildIndex(workspaceDir);
  const rel = path.relative(workspaceDir, result.indexPath).replace(/\\/g, '/');
  console.log(`Index rebuilt: ${rel}`);
  console.log(`Files: ${result.fileCount}`);
  console.log(`Keys: ${result.keyCount}`);
}

main();

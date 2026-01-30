const path = require('path');
const { updateIndex } = require('../lib/index-utils');

function main() {
  const workspaceDir = process.cwd();
  const result = updateIndex(workspaceDir);
  const rel = path.relative(workspaceDir, result.indexPath).replace(/\\/g, '/');
  console.log(`Index updated: ${rel}`);
  console.log(`Files: ${result.fileCount}`);
  console.log(`Keys: ${result.keyCount}`);
  if (typeof result.changed === 'number') console.log(`Changed: ${result.changed}`);
  if (typeof result.removed === 'number') console.log(`Removed: ${result.removed}`);
}

main();

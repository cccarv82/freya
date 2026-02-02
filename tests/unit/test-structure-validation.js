const { execSync } = require('child_process');
const path = require('path');

const repoRoot = path.join(__dirname, '../..');

try {
  execSync('node scripts/validate-structure.js', { cwd: repoRoot, stdio: 'ignore' });
  console.log('✅ Structure validation passed');
} catch (err) {
  console.error('❌ Structure validation failed');
  process.exit(1);
}

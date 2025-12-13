const fs = require('fs');
const path = require('path');
const assert = require('assert');

const packageJsonPath = path.join(__dirname, '../../package.json');

try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  assert.strictEqual(packageJson.name, 'freya');
  assert.ok(packageJson.scripts, 'scripts object should exist');
  assert.strictEqual(packageJson.scripts.health, 'node scripts/validate-data.js', 'health script matches');
  console.log('✅ Package config validation passed');
} catch (err) {
  console.error('❌ Package config validation failed:', err);
  process.exit(1);
}

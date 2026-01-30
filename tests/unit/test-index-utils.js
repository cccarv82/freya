const fs = require('fs');
const path = require('path');

const { buildIndex, updateIndex, searchIndex, indexPathFor } = require('../../scripts/lib/index-utils');

const tmpRoot = path.join(__dirname, '../tmp-index-utils');

function resetTmp() {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'logs', 'daily'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'data', 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'data', 'Clients', 'acme'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'docs', 'reports'), { recursive: true });
}

try {
  resetTmp();

  const logPath = path.join(tmpRoot, 'logs', 'daily', '2026-01-25.md');
  fs.writeFileSync(logPath, '# Daily Log\n\nINC12345 falhou em produção.\n', 'utf8');
  fs.writeFileSync(
    path.join(tmpRoot, 'data', 'tasks', 'task-log.json'),
    JSON.stringify({ tasks: [{ id: 't1', description: 'Investigar PTI2025-777 no deploy' }] }),
    'utf8'
  );

  buildIndex(tmpRoot);

  const idxPath = indexPathFor(tmpRoot);
  if (!fs.existsSync(idxPath)) throw new Error('Index file was not created');

  const incResults = searchIndex(tmpRoot, 'INC12345', { limit: 3 });
  if (!incResults.length || incResults[0].file !== 'logs/daily/2026-01-25.md') {
    throw new Error('Expected index to return log entry for INC12345');
  }

  fs.writeFileSync(logPath, '# Daily Log\n\nINC12345 falhou em produção.\nCHG777 aberto.\n', 'utf8');
  updateIndex(tmpRoot);

  const chgResults = searchIndex(tmpRoot, 'CHG777', { limit: 2 });
  if (!chgResults.length || chgResults[0].file !== 'logs/daily/2026-01-25.md') {
    throw new Error('Expected index to include updated CHG777 entry');
  }

  fs.unlinkSync(logPath);
  updateIndex(tmpRoot);

  const removedResults = searchIndex(tmpRoot, 'INC12345', { limit: 2 });
  if (removedResults.length !== 0) {
    throw new Error('Expected removed file to be dropped from index');
  }

  console.log('✅ PASS: index-utils build/update/search behave correctly');
} catch (error) {
  console.error('❌ FAIL:', error.message);
  process.exit(1);
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

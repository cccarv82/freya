const fs = require('fs');
const path = require('path');

const { searchWorkspace } = require('../../scripts/lib/search-utils');

const tmpRoot = path.join(__dirname, '../tmp-search-utils');

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

  fs.writeFileSync(
    path.join(tmpRoot, 'logs', 'daily', '2026-01-25.md'),
    '# Daily Log\n\nINC12345 falhou em produção.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(tmpRoot, 'data', 'tasks', 'task-log.json'),
    JSON.stringify({ tasks: [{ id: 't1', description: 'Investigar PTI2025-777 no deploy' }] }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(tmpRoot, 'data', 'Clients', 'acme', 'status.json'),
    JSON.stringify({ currentStatus: 'Projeto Rocket com CHG999 em andamento' }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(tmpRoot, 'docs', 'reports', 'daily-2026-01-24.md'),
    '# Report\n\nNada relevante.\n',
    'utf8'
  );

  const incResults = searchWorkspace(tmpRoot, 'INC12345', { limit: 3 });
  if (!incResults.length) throw new Error('Expected results for INC12345');
  if (incResults[0].file !== 'logs/daily/2026-01-25.md') {
    throw new Error('INC12345 should rank logs/daily/2026-01-25.md first');
  }
  if (incResults[0].date !== '2026-01-25') {
    throw new Error('Expected date inferred from filename');
  }

  const ptiResults = searchWorkspace(tmpRoot, 'PTI2025-777', { limit: 2 });
  if (!ptiResults.length || ptiResults[0].file !== 'data/tasks/task-log.json') {
    throw new Error('Expected PTI match in task-log.json');
  }

  const emptyResults = searchWorkspace(tmpRoot, 'nada-disso-existe', { limit: 2 });
  if (emptyResults.length !== 0) {
    throw new Error('Expected no results for missing query');
  }

  console.log('✅ PASS: search-utils workspace search behaves correctly');
} catch (error) {
  console.error('❌ FAIL:', error.message);
  process.exit(1);
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

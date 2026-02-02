const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function run() {
  const port = 3872 + Math.floor(Math.random() * 2000);
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  const expectedVersion = pkg && pkg.version ? String(pkg.version) : 'unknown';
  const child = spawn(process.execPath, ['bin/freya.js', '--no-open', '--port', String(port)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let out = '';
  const waitReady = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('web server did not start in time')), 8000);
    child.stdout.on('data', (b) => {
      out += b.toString('utf8');
      if (out.includes('FREYA web running at')) {
        clearTimeout(t);
        resolve();
      }
    });
    child.stderr.on('data', (b) => {
      out += b.toString('utf8');
    });
  });

  try {
    await waitReady;

    const base = `http://127.0.0.1:${port}`;
    const html = await get(base + '/');
    assert.equal(html.status, 200);
    assert.ok(html.body.includes('/app.js'), 'HTML should reference /app.js');
    assert.ok(html.body.includes('/app.css'), 'HTML should reference /app.css');
    assert.ok(html.body.includes(`v${expectedVersion}`), 'HTML should include app version badge');

    const js = await get(base + '/app.js');
    assert.equal(js.status, 200);
    assert.ok(js.body.includes('window.doInit'), 'app.js should bind handlers');

    // Ensure the JS parses (avoid shipping SyntaxError that breaks all onclick handlers)
    const vm = require('vm');
    try {
      new vm.Script(js.body);
    } catch (e) {
      throw new Error('app.js is not valid JS: ' + (e && e.message ? e.message : e));
    }

    const css = await get(base + '/app.css');
    assert.equal(css.status, 200);
    assert.ok(css.body.includes(':root'), 'app.css should contain CSS');

    console.log('✅ PASS: web serves static app.js/app.css assets');
  } finally {
    child.kill('SIGTERM');
  }
}

run().catch((e) => {
  console.error('❌ FAIL: web static assets', e);
  process.exit(1);
});

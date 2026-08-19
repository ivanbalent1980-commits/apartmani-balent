const { spawn, spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = spawn(process.execPath, [path.join(__dirname, 'static-server.cjs')], {
  cwd: root,
  stdio: 'inherit'
});

const tests = [
  'public-site-api-test.cjs',
  'dashboard-phase1-test.cjs',
  'dashboard-phase2-test.cjs',
  'dashboard-today-test.cjs',
  'browser-smoke-test.cjs',
  'ux-journey-test.cjs'
];

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:8765/');
      if (response.ok) return;
    } catch (_) {
      // The server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Local test server did not start within 10 seconds.');
}

(async () => {
  let failed = false;
  try {
    await waitForServer();
    for (const test of tests) {
      const result = spawnSync(process.execPath, [path.join(__dirname, test)], {
        cwd: root,
        stdio: 'inherit'
      });
      if (result.status !== 0) {
        failed = true;
        break;
      }
    }
  } finally {
    server.kill('SIGTERM');
  }
  process.exitCode = failed ? 1 : 0;
})().catch(error => {
  console.error(error);
  server.kill('SIGTERM');
  process.exitCode = 1;
});
